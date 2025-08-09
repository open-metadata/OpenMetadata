---
title: airflowConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/airflowconnection
---

# AirflowConnection

*Airflow Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/AirflowType*. Default: `Airflow`.
- **`hostPort`** *(string)*: Pipeline Service Management/UI URI.
- **`numberOfStatus`** *(integer)*: Pipeline Service Number Of Status. Default: `10`.
- **`connection`**: Underlying database connection. See https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html for supported backends.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`AirflowType`** *(string)*: Service type. Must be one of: `['Airflow']`. Default: `Airflow`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
