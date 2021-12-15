"""
This is a simple script for testing the environment.

You can run it as `python experiment.py`, and a new
experiment should appear in the remote server.
"""

import mlflow

# Create experiment to the remote server
mlflow_uri = "http://localhost:5000"
mlflow.set_tracking_uri(mlflow_uri)

mlflow.set_experiment("mlflow_test1")

mlflow.log_param("param1", "value1")
mlflow.log_param("param2", "value2")

for i in range(10):
    mlflow.log_metric("metric1", value=1 / (i + 1), step=i)

mlflow.end_run()
