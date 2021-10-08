#!/bin/bash

while ! curl --http0.9 -o - localhost:8585; do sleep 5; done
pip install --upgrade setuptools '.[sample-data, elasticsearch]'
metadata ingest -c pipelines/sample_data.json
metadata ingest -c pipelines/sample_users.json
metadata ingest -c pipelines/sample_usage.json
metadata ingest -c pipelines/metadata_to_es.json