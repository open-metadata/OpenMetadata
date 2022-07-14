---
title: datalakeConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/datalakeconnection
---

# DatalakeConnection

*Datalake Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/datalakeType*. Default: `Datalake`.
- **`configSource`**: Available sources to fetch files.
- **`bucketName`** *(string)*: Bucket Name of the data source. Default: ``.
- **`prefix`** *(string)*: Prefix of the data source. Default: ``.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`datalakeType`** *(string)*: Service type. Must be one of: `['Datalake']`. Default: `Datalake`.
- **`GCSConfig`**: DataLake Catalog and Manifest files in GCS storage. We will search for catalog.json and manifest.json.
  - **`securityConfig`**: Refer to *../../../../security/credentials/gcsCredentials.json*.
- **`S3Config`**: DataLake Catalog and Manifest files in S3 bucket. We will search for catalog.json and manifest.json.
  - **`securityConfig`**: Refer to *../../../../security/credentials/awsCredentials.json*.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
