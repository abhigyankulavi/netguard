# main.py
import os
import uuid
import pandas as pd
from io import StringIO
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from celery.result import AsyncResult
from contextlib import asynccontextmanager
from supabase import create_client, Client
from dotenv import load_dotenv

from tasks import celery_app, analyze_network_traffic
from csv_validator import process_uploaded_csv
from feature_config import EXPECTED_FEATURES
import joblib

load_dotenv()

ml_components = {}
connected_clients = [] 

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception:
    supabase = None
    print("API Warning: Supabase not configured.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing NetGuard API Core...")
    try:
        ml_components['model'] = joblib.load('models/netguard_xgb_model_v03.pkl')
        ml_components['encoder'] = joblib.load('models/netguard_v03_label_encoder.pkl')
    except Exception as e:
        print(f"API ML Warning: {e}")
    yield
    ml_components.clear()

app = FastAPI(title="NetGuard SIEM Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/upload")
async def upload_capture_file(file: UploadFile = File(...)):
    file_ext = file.filename.split('.')[-1].lower()
    if file_ext not in ['pcap', 'pcapng', 'csv']:
        raise HTTPException(status_code=400, detail="Only PCAP and CSV files are supported.")

    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    task = analyze_network_traffic.delay(file_path, file_ext, file.filename)

    return JSONResponse(status_code=202, content={"message": "File accepted for processing.", "task_id": task.id})

@app.get("/api/status/{task_id}")
async def get_task_status(task_id: str):
    task_result = AsyncResult(task_id, app=celery_app)
    response = {"task_id": task_id, "status": task_result.status}

    if task_result.status == 'SUCCESS':
        response["result"] = task_result.result
    elif task_result.status in ['PROCESSING', 'PREDICTING', 'SAVING']:
        response["message"] = task_result.info.get('status', 'Processing...')
    elif task_result.status == 'FAILURE':
        response["error"] = str(task_result.info)

    return response

@app.get("/api/history")
async def get_history():
    if not supabase: return []
    res = supabase.table("scans").select("*").order("created_at", desc=True).limit(50).execute()
    return res.data

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    if websocket not in connected_clients:
        connected_clients.append(websocket)
        
    try:
        while True:
            data = await websocket.receive_text()
            df = pd.read_json(StringIO(data), orient='records')
            
            missing_features = [feat for feat in EXPECTED_FEATURES if feat not in df.columns]
            if missing_features:
                await websocket.send_json({"error": f"Live stream missing {len(missing_features)} required features."})
                continue
                
            ml_input_df = df[EXPECTED_FEATURES]
            
            if 'model' in ml_components and 'encoder' in ml_components:
                preds = ml_components['model'].predict(ml_input_df)
                text_preds = ml_components['encoder'].inverse_transform(preds)

                threat_count = sum([1 for p in text_preds if p != "Normal Traffic"])
                results = {"total_flows": len(df), "threats_detected": threat_count, "status": "Critical" if threat_count > 0 else "Secure"}
            else:
                results = {"error": "ML Model not loaded in API context."}

            for client in connected_clients.copy():
                try:
                    await client.send_json(results)
                except Exception:
                    connected_clients.remove(client)
                    
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)

