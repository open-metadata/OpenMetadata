---
title: sapHanaSQLConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/saphana/saphanasqlconnection
---

# SapHanaSQLConnection

*Sap Hana Database SQL Connection Config*

## Properties

- **`hostPort`** *(string)*: Host and port of the Hana service.
- **`username`** *(string)*: Username to connect to Hana. This user should have privileges to read all the metadata.
- **`password`** *(string, format: password)*: Password to connect to Hana.
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`database`** *(string)*: Database of the data source.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
