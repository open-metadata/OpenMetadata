#### Connection Details

- **Username**: Specify the User to connect to Hive. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Hive.
- **Host and Port**: This parameter specifies the host and port of the Hive server instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `myhivehost:10000`.
- **Auth Options (Optional)**: The auth parameter specifies the authentication method to use when connecting to the Hive server. Possible values are `LDAP`, `NONE`, `CUSTOM`, or `KERBEROS`. If you are using Kerberos authentication, you should set auth to `KERBEROS`. If you are using custom authentication, you should set auth to `CUSTOM` and provide additional options in the `authOptions` parameter.
- **Kerberos Service Name**: This parameter specifies the Kerberos service name to use for authentication. This should only be specified if using Kerberos authentication. The default value is `hive`.
- **Database Schema**: Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **Database Name**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.


#### For MySQL Metastore Connection

You can also ingest the metadata using Mysql metastore. This step is optional if metastore details are not provided then we will query the hive server directly.

- **Username**: Specify the User to connect to MySQL Metastore. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to MySQL.
- **Host and Port**: Enter the fully qualified hostname and port number for your MySQL Metastore deployment in the Host and Port field in the format `hostname:port`.
- **databaseSchema**: Enter the database schema which is associated with the metastore.

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}

#### For Postgres Metastore Connection

You can also ingest the metadata using Postgres metastore. This step is optional if metastore details are not provided then we will query the hive server directly.

- **Username**: Specify the User to connect to Postgres Metastore. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Postgres.
- **Host and Port**: Enter the fully qualified hostname and port number for your Postgres deployment in the Host and Port field in the format `hostname:port`.
- **Database**: Initial Postgres database to connect to. Specify the name of database associated with metastore instance.