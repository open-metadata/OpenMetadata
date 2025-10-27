#!/bin/bash

# ThirdEye Python Service Startup Script
# Run this in a separate terminal

cd "$(dirname "$0")"

echo "🚀 Starting ThirdEye Python Service..."
echo ""
echo "Service will run on: http://localhost:8587"
echo "Press Ctrl+C to stop"
echo ""

export PYTHONPATH=src
python -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload
