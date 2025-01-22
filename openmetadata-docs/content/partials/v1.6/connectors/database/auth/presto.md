#### Connection Options

- **Username**: Specify the User to connect to Presto. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Presto.
- **Host and Port**: Enter the fully qualified hostname and port number for your Presto deployment in the Host and Port field.
- **Catalog**: Presto offers a catalog feature where all the databases are stored.
- **DatabaseSchema**: DatabaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.