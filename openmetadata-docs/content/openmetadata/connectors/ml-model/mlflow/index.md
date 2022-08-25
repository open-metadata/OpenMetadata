---
title: Mlflow
slug: /openmetadata/connectors/ml-model/mlflow
---

<ConnectorIntro service="ml-model" connector="Mlflow"/>

<Requirements />

<MetadataIngestionService connector="Mlflow"/>

<h4>Connection Options</h4>

- **trackingUri**: Mlflow Experiment tracking URI. E.g., http://localhost:5000
- **registryUri**: Mlflow Model registry backend. E.g., mysql+pymysql://mlflow:password@localhost:3307/experiments

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Mlflow" />
