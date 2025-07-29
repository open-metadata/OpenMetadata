---
title: GCS Connection | OpenMetadata Google Cloud Storage Connection
description: Configure Google Cloud Storage connection settings to extract metadata and manage cloud-hosted datasets.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/storage/gcsconnection
---

# GCS Connection

*GCS Connection.*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/gcsType](#definitions/gcsType)*. Default: `"GCS"`.
- **`credentials`**: GCP Credentials. Refer to *[../../../../security/credentials/gcpCredentials.json](#/../../../security/credentials/gcpCredentials.json)*.
- **`bucketNames`** *(array)*: Bucket Names of the data source. Default: `null`.
  - **Items** *(string)*
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`gcsType`** *(string)*: Gcs service type. Must be one of: `["GCS"]`. Default: `"GCS"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
