---
title: Run Mlflow Connector using the CLI
slug: /openmetadata/connectors/ml-model/mlflow/cli
---

<ConnectorIntro connector="Mlflow" goal="CLI"/>

<Requirements />

<PythonMod connector="Mlflow" module="mlflow" />

<MetadataIngestionServiceDev service="ml-model" connector="Mlflow" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **trackingUri**: Mlflow Experiment tracking URI. E.g., http://localhost:5000
- **registryUri**: Mlflow Model registry backend. E.g., mysql+pymysql://mlflow:password@localhost:3307/experiments

<MetadataIngestionConfig service="ml-model" connector="Mlflow" goal="CLI" />
