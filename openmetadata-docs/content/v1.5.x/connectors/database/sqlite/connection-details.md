---
title: Connection Details
slug: /connectors/database/sqlite/connections
---

#### Connection Details

- **Username**: Username to connect to SQLite. Blank for in-memory database.
- **Password**: Password to connect to SQLite. Blank for in-memory database.
- **Host and Port**: Enter the fully qualified hostname and port number for your SQLite deployment in the Host and Port field.
- **Database**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **Database Mode**: How to run the SQLite database. :memory: by default.

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}