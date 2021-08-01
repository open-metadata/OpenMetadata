#!/usr/bin/env bash
set -euo pipefail
source env/bin/activate
echo "Ingesting Data using scheduler"
python ingestion_scheduler/scheduler.py
