# MlFlow Integration Test

We have prepared a small test to check the MlFlow ingestion.

We have used a decoupled architecture for MlFlow with:
- `mlflow` running in a remote server
- `minio` as the artifact store
- `mysql` as the registry

To run this test:

- `cd` into this directory
- `make build`
- `pip install mlflow-skinny sklearn`. We use the skinny one for the client.
- `python experiment.py` should show new experiments in http://localhost:5000
- `python train.py` will register a new model
- `metadata ingest -c examples/workflows/mlflow.json` will run the workflow.
