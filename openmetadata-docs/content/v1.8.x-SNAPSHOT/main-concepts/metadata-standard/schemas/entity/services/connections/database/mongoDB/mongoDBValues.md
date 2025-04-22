---
title: mongoDBValues
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/mongodb/mongodbvalues
---

# Mongo Connection Values

*Azure Datalake Storage will ingest files in container*

## Properties

- **`scheme`**: Mongo connection scheme options. Refer to *#/definitions/mongoDBScheme*. Default: `mongodb`.
- **`username`** *(string)*: Username to connect to MongoDB. This user should have privileges to read all the metadata in MongoDB.
- **`password`** *(string)*: Password to connect to MongoDB.
- **`hostPort`** *(string)*: Host and port of the MongoDB service.
- **`connectionOptions`**: Refer to *../../connectionBasicType.json#/definitions/connectionOptions*.
## Definitions

- **`mongoDBScheme`** *(string)*: Mongo connection scheme options. Must be one of: `['mongodb', 'mongodb+srv']`. Default: `mongodb`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
