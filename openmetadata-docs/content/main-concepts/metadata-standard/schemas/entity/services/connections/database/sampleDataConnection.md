---
title: sampleDataConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/sampledataconnection
---

# SampleDataConnection

*Sample Data Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/sampleDataType*. Default: `SampleData`.
- **`sampleDataFolder`** *(string)*: Sample Data File Path.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
## Definitions

- **`sampleDataType`** *(string)*: Service type. Must be one of: `['SampleData']`. Default: `SampleData`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
