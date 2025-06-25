---
title: mlflowConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/mlmodel/mlflowconnection
---

# MlflowConnection

*MlFlow Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/mlflowType](#definitions/mlflowType)*. Default: `"Mlflow"`.
- **`trackingUri`** *(string)*: Mlflow Experiment tracking URI. E.g., http://localhost:5000.
- **`registryUri`** *(string)*: Mlflow Model registry backend. E.g., mysql+pymysql://mlflow:password@localhost:3307/experiments.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`mlflowType`** *(string)*: Service type. Must be one of: `["Mlflow"]`. Default: `"Mlflow"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
