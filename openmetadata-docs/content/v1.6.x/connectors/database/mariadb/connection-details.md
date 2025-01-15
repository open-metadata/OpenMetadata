---
title: Connection Details
slug: /connectors/database/mariadb/connections
---

#### Connection Details

- **Username**: Specify the User to connect to MariaDB. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to MariaDB.
- **Host and Port**: Enter the fully qualified hostname and port number for your MariaDB deployment in the Host and Port field.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **databaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}