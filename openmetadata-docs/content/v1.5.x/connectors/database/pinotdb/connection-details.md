---
title: Connection Details
slug: /connectors/database/pinotdb/connections
---

#### Connection Details

- **Username**: Specify the User to connect to PinotDB. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to PinotDB.
- **Host and Port**: Enter the fully qualified hostname and port number for your PinotDB deployment in the Host and Port field. Unlike broker host, prefix http:// or https:// must be added to contoller host. For example, pinot broker host can be set to `localhost:8099` and pinot controller host can be set to `http://localhost:9000`.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **databaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **caCertificate**: Provide the path to ssl ca file.
- **sslCertificate**: Provide the path to ssl client certificate file (ssl_cert).
- **sslKey**: Provide the path to ssl client certificate file (ssl_key).

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}