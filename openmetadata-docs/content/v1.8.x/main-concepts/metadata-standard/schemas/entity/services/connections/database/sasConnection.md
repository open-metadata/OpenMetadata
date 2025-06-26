---
title: sasConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/sasconnection
---

# SASConnection

*SAS Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/sasType](#definitions/sasType)*. Default: `"SAS"`.
- **`username`** *(string)*: Username to connect to SAS Viya.
- **`password`** *(string, format: password)*: Password to connect to SAS Viya.
- **`serverHost`** *(string, format: uri)*: Hostname of SAS Viya deployment.
- **`datatables`** *(boolean)*: Enable datatables for ingestion. Default: `true`.
- **`dataTablesCustomFilter`**: Custom filter for datatables.
  - **One of**
    - *object*: Don't include custom filter when ingesting metadata for datatables.
    - *string*: Include custom filter when ingesting metadata for datatables.
- **`reports`** *(boolean)*: Enable report for ingestion. Default: `false`.
- **`reportsCustomFilter`**: Custom filter for reports.
  - **One of**
    - *object*: Don't include custom filter when ingesting metadata for reports.
    - *string*: Include custom filter when ingesting metadata for reports.
- **`dataflows`** *(boolean)*: Enable dataflow for ingestion. Default: `false`.
- **`dataflowsCustomFilter`**: Custom filter for dataflows.
  - **One of**
    - *object*: Don't include custom filter when ingesting metadata for dataflows.
    - *string*: Include custom filter when ingesting metadata for dataflows.
## Definitions

- **`sasType`** *(string)*: Service type. Must be one of: `["SAS"]`. Default: `"SAS"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
