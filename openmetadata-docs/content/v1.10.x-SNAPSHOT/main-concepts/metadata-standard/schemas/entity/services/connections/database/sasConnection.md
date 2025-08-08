---
title: sasConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/sasconnection
---

# SASConnection

*SAS Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/sasType*. Default: `SAS`.
- **`username`** *(string)*: Username to connect to SAS Viya.
- **`password`** *(string)*: Password to connect to SAS Viya.
- **`serverHost`** *(string)*: Hostname of SAS Viya deployment.
- **`datatables`** *(boolean)*: Enable datatables for ingestion. Default: `True`.
- **`dataTablesCustomFilter`**: Custom filter for datatables.
- **`reports`** *(boolean)*: Enable report for ingestion. Default: `False`.
- **`reportsCustomFilter`**: Custom filter for reports.
- **`dataflows`** *(boolean)*: Enable dataflow for ingestion. Default: `False`.
- **`dataflowsCustomFilter`**: Custom filter for dataflows.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`sasType`** *(string)*: Service type. Must be one of: `['SAS']`. Default: `SAS`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
