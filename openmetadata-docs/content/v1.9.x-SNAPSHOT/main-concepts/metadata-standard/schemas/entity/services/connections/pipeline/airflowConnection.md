---
title: airflowConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/airflowconnection
---

# AirflowConnection

*Airflow Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/AirflowType](#definitions/AirflowType)*. Default: `"Airflow"`.
- **`hostPort`** *(string, format: uri)*: Pipeline Service Management/UI URI.
- **`numberOfStatus`** *(integer)*: Pipeline Service Number Of Status. Default: `"10"`.
- **`connection`**: Underlying database connection. See https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html for supported backends.
  - **One of**
    - : Refer to *[backendConnection.json](#ckendConnection.json)*.
    - : Refer to *[../database/mysqlConnection.json](#/database/mysqlConnection.json)*.
    - : Refer to *[../database/postgresConnection.json](#/database/postgresConnection.json)*.
    - : Refer to *[../database/sqliteConnection.json](#/database/sqliteConnection.json)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`AirflowType`** *(string)*: Service type. Must be one of: `["Airflow"]`. Default: `"Airflow"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
