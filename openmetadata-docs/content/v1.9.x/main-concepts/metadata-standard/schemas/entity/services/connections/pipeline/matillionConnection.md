---
title: Matillion Connection | OpenMetadata Matillion
description: Configure Matillion pipelines using this schema to capture transformation logic, task metadata, and orchestration flows.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/matillionconnection
---

# MatillionConnection

*Matillion Connection*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/matillionType](#definitions/matillionType)*. Default: `"Matillion"`.
- **`connection`**: Matillion Auth Configuration.
  - **One of**
    - : Refer to *[#/definitions/matillionETL](#definitions/matillionETL)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`matillionType`** *(string)*: Service type. Must be one of: `["Matillion"]`. Default: `"Matillion"`.
- **`matillionETL`** *(object)*: Matillion ETL Auth Config.
  - **`type`** *(string)*: Must be one of: `["MatillionETL"]`. Default: `"MatillionETL"`.
  - **`hostPort`** *(string, required)*: Matillion Host. Default: `"localhost"`.
  - **`username`** *(string, required)*: Username to connect to the Matillion. This user should have privileges to read all the metadata in Matillion.
  - **`password`** *(string, format: password, required)*: Password to connect to the Matillion.
  - **`sslConfig`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
