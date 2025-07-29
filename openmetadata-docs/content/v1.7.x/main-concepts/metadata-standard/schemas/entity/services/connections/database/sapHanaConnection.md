---
title: SAP HANA Connection | OpenMetadata SAP HANA
description: Schema for connecting to SAP HANA database to ingest schema, view, and system metadata.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/saphanaconnection
---

# SapHanaConnection

*Sap Hana Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/sapHanaType](#definitions/sapHanaType)*. Default: `"SapHana"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/sapHanaScheme](#definitions/sapHanaScheme)*. Default: `"hana"`.
- **`connection`**: Choose between Database connection or HDB User Store connection.
  - **One of**
    - : Refer to *[sapHana/sapHanaSQLConnection.json](#pHana/sapHanaSQLConnection.json)*.
    - : Refer to *[sapHana/sapHanaHDBConnection.json](#pHana/sapHanaHDBConnection.json)*.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsLineageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsLineageExtraction](#/connectionBasicType.json#/definitions/supportsLineageExtraction)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
- **`sampleDataStorageConfig`**: Refer to *[../connectionBasicType.json#/definitions/sampleDataStorageConfig](#/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
- **`supportsDataDiff`**: Refer to *[../connectionBasicType.json#/definitions/supportsDataDiff](#/connectionBasicType.json#/definitions/supportsDataDiff)*.
## Definitions

- **`sapHanaType`** *(string)*: Service type. Must be one of: `["SapHana"]`. Default: `"SapHana"`.
- **`sapHanaScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["hana"]`. Default: `"hana"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
