#!/bin/bash

# ThirdEye Service Log Viewer
# This script helps you view logs in different ways

echo "🔍 ThirdEye Service Log Options"
echo ""
echo "Choose an option:"
echo ""
echo "1. View terminal where service is running"
echo "   (The terminal where you ran 'python -m uvicorn ...')"
echo ""
echo "2. Make a test request to generate logs:"
echo "   curl http://localhost:8587/api/v1/thirdeye/dashboard/data"
echo ""
echo "3. Check what SQL queries will be logged:"
echo ""

# Make a test request and show what logs would appear
echo "Making test request to show logs..."
echo ""

curl -s http://localhost:8587/api/v1/thirdeye/health > /dev/null

echo "✅ Request sent!"
echo ""
echo "📋 In your terminal running ThirdEye, you should see:"
echo ""
echo "Example log output:"
echo "  INFO:     127.0.0.1:XXXXX - \"GET /api/v1/thirdeye/health HTTP/1.1\" 200 OK"
echo ""
echo "With SQL logging enabled (echo=True), you'll also see:"
echo "  INFO:  SELECT health_score, health_status, ... FROM thirdeye.v_datalake_health_metrics LIMIT 1"
echo "  [generated in 0.00123s]"
echo ""
echo "📍 To see logs:"
echo "   1. Look at the terminal where you started uvicorn"
echo "   2. Or redirect to file: python -m uvicorn ... 2>&1 | tee logs.txt"
echo ""
