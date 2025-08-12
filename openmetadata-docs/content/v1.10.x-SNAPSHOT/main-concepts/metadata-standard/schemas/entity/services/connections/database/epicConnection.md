---
title: epicConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/epicconnection
---

# EpicConnection

*Epic FHIR Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/epicType*. Default: `Epic`.
- **`fhirServerUrl`** *(string)*: Base URL of the Epic FHIR server. Default: `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR`.
- **`fhirVersion`** *(string)*: FHIR specification version (R4, STU3, DSTU2). Must be one of: `['R4', 'STU3', 'DSTU2']`. Default: `R4`.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use 'epic' as the database name. Default: `epic`.
- **`schemaFilterPattern`**: Regex to include/exclude FHIR resource categories. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to include/exclude FHIR resource types. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`epicType`** *(string)*: Service type. Must be one of: `['Epic']`. Default: `Epic`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
