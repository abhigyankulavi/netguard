#!/bin/bash
celery -A tasks worker --loglevel=info --concurrency=1 &

#Start the FastAPI server in the foreground
uvicorn main:app --host 0.0.0.0 --port $PORT
