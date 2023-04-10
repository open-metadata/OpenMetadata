# Hive

In this section, we provide guides and references to use the Hive connector.

# Requirements

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

## Connection Details

### Scheme $(id="scheme")

SQLAlchemy driver scheme options.

### Username $(id="username")

Username to connect to Hive. This user should have privileges to read all the metadata in Hive.

### Password $(id="password")

Password to connect to Hive.

### Host Port $(id="hostPort")

The hostPort parameter specifies the host and port of the Hive server. This should be specified as a string in the format 'hostname:port'. For example, you might set the hostPort parameter to `myhivehost:10000`.

### Auth $(id="auth")

 The auth parameter specifies the authentication method to use when connecting to the Hive server. Possible values are 'LDAP', 'NONE', 'CUSTOM', or 'KERBEROS'. If you are using Kerberos authentication, you should set auth to 'KERBEROS'. If you are using custom authentication, you should set auth to 'CUSTOM' and provide additional options in the authOptions parameter.

### Kerberos Service Name $(id="kerberosServiceName")

The kerberosServiceName parameter specifies the Kerberos service name to use for authentication. This should only be specified if using Kerberos authentication. The default value is 'hive'.

### Database Schema $(id="databaseSchema")

databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.

### Database Name $(id="databaseName")

Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

### Auth Options $(id="authOptions")

Authentication options to pass to Hive connector. These options are based on SQLAlchemy.

### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection. The connectionOptions parameter is specific to the connection method being used. For example, if you are using SSL encryption, you might set the connectionOptions parameter to {'ssl': 'true', 'sslTrustStore': '/path/to/truststore'}.
<!-- connectionOptions to be updated -->

### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
<!-- connectionArguments to be updated -->

