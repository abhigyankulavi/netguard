import os
import time
import pandas as pd
import numpy as np
import joblib
from celery import Celery
from groq import Groq 
from supabase import create_client
from dotenv import load_dotenv

from pcap_extractor import extract_from_pcap
from csv_validator import process_uploaded_csv
from feature_config import EXPECTED_FEATURES

# Prevent macOS Celery openMP deadlock
os.environ['OMP_NUM_THREADS'] = '1'
os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['MKL_NUM_THREADS'] = '1'
os.environ['KMP_DUPLICATE_LIB_OK'] = 'True'

load_dotenv()

redis_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
celery_app = Celery("threat_analyzer", broker=redis_url, backend=redis_url)

# Load ML Models Globally for Celery Worker
try:
    model = joblib.load("models/netguard_xgb_model_v03.pkl")
    encoder = joblib.load("models/netguard_v03_label_encoder.pkl")
except Exception as e:
    model = None
    encoder = None
    print(f"Worker ML Error: {e}")

@celery_app.task(bind=True)
def analyze_network_traffic(self, file_path, file_type, original_filename):
    # Note: Initialize network clients INSIDE the task to prevent 
    # socket corruption when the macOS Celery worker forks the process.
    # This error prevented the worker from processing any tasks after the first one, 
    # which is why it seemed like a "hang" during prediction.
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    supabase = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None

    groq_key = os.environ.get("GROQ_API_KEY")
    groq_client = Groq(api_key=groq_key) if groq_key else None

    def get_ai_explanation(attack_type: str) -> str:
        if not groq_client: return "AI disabled. No Groq API Key found."
        
        prompt = f"You are an AI SOC Analyst. Traffic classified as '{attack_type}'. In 2 sentences, explain the threat in a concise manner and suggest a specific firewall rule in a professional tone."
        
        try:
            time.sleep(2)
            chat_completion = groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                temperature=0.3, 
            )
            return chat_completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"Groq Inference Error: {e}")
            return "AI analysis temporarily offline."

    try:
        self.update_state(state='PROCESSING', meta={'status': 'Extracting custom features...'})
        
        if file_type in ["pcap", "pcapng"]:
            extraction_result = extract_from_pcap(file_path)
        elif file_type == "csv":
            extraction_result = process_uploaded_csv(file_path)
        else:
            return {"error": "Unsupported file type"}

        if extraction_result["status"] == "error":
            return {"error": extraction_result["message"], "missing_features": extraction_result.get("missing_features", [])}
            
        df = extraction_result["data"]
        ml_input_df = df[EXPECTED_FEATURES].astype('float32')

        self.update_state(state='PREDICTING', meta={'status': f'Classifying {len(ml_input_df)} flows...'})
        
        threats = []
        status = "Secure"
        total_flows = len(df)
        
        if model and encoder:
            batch_size = 10000 
            numeric_preds = []
            probs_list = []
            
            for i in range(0, len(ml_input_df), batch_size):
                chunk = ml_input_df.iloc[i : i + batch_size]
                chunk_array = np.ascontiguousarray(chunk.values, dtype=np.float32)
                
                numeric_preds.extend(model.predict(chunk_array))
                probs_list.extend(model.predict_proba(chunk_array))
                self.update_state(state='PREDICTING', meta={'status': f'Classifying batch {min(i + batch_size, len(ml_input_df))} of {len(ml_input_df)}...'})
            
            text_preds = encoder.inverse_transform(numeric_preds)
            unique_attacks = set()
            explanations = {}

            src_ips = df.get('Source IP', pd.Series(['Unknown'] * total_flows)).tolist()
            dst_ips = df.get('Destination IP', pd.Series(['Unknown'] * total_flows)).tolist()

            for i, attack in enumerate(text_preds):
                if attack != "Normal Traffic":
                    confidence = round(max(probs_list[i]) * 100, 2)
                    
                    # Ask the LLM once per attack type to save on API calls
                    if attack not in unique_attacks:
                        unique_attacks.add(attack)
                        explanations[attack] = get_ai_explanation(attack)

                    threats.append({
                        "source_ip": str(src_ips[i]),
                        "target_ip": str(dst_ips[i]),
                        "attack_type": attack,
                        "confidence": confidence,
                        "ai_insight": explanations[attack]
                    })
                    
            if threats:
                status = "Critical"

        self.update_state(state='SAVING', meta={'status': 'Logging to SIEM database...'})
        if supabase:
            scan_res = supabase.table("scans").insert({
                "filename": original_filename, 
                "total_flows": total_flows, 
                "threats_detected": len(threats), 
                "status": status
            }).execute()
            
            if threats:
                scan_id = scan_res.data[0]['id']
                for t in threats: 
                    t["scan_id"] = scan_id
                
                for i in range(0, len(threats), 500):
                    supabase.table("threats").insert(threats[i:i+500]).execute()

        return {
            "status": "success",
            "warning": extraction_result.get("warning"), 
            "missing_features": extraction_result.get("missing_features", []),
            "total_flows": total_flows,
            "threats_detected": len(threats),
            "threat_details": threats[:200] 
        }

    except Exception as e:
        return {"error": f"Task failed: {str(e)}"}
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
