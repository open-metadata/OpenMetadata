---
title: mlflowConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/mlmodel/mlflowconnection
---

# MlflowConnection

*MlFlow Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/mlflowType*. Default: `Mlflow`.
- **`trackingUri`** *(string)*: Mlflow Experiment tracking URI. E.g., http://localhost:5000.
- **`registryUri`** *(string)*: Mlflow Model registry backend. E.g., mysql+pymysql://mlflow:password@localhost:3307/experiments.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`mlflowType`** *(string)*: Service type. Must be one of: `['Mlflow']`. Default: `Mlflow`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
