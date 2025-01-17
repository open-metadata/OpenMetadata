#### Connection Details

- **Username**: Specify the User to connect to MySQL. It should have enough privileges to read all the metadata.
- **Auth Type**: Basic Auth or IAM based auth to connect to instances / cloud rds.
  - **Basic Auth**: 
    - **Password**: Password to connect to MySQL.
  - **IAM Based Auth**: 
    {% partial file="/v1.5/connectors/database/aws.md" /%}
    
- **Host and Port**: Enter the fully qualified hostname and port number for your MySQL deployment in the Host and Port field.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **databaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **caCertificate**: Provide the path to ssl ca file.
- **sslCertificate**: Provide the path to ssl client certificate file (ssl_cert).
- **sslKey**: Provide the path to ssl client certificate file (ssl_key).