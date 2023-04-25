# Hive
In this section, we provide guides and references to use the Hive connector. You can view the full documentation for Hive [here](https://docs.open-metadata.org/connectors/database/hive).

## Requirements
To extract metadata, the user used in the connection needs to be able to perform `SELECT`, `SHOW`, and `DESCRIBE` operations in the database/schema where the metadata needs to be extracted from.

### Profiler & Data Quality
Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler) and data quality tests [here](https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality).

You can find further information on the Hive connector in the [docs](https://docs.open-metadata.org/connectors/database/hive).

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value. OpenMetadata supports both `Hive` and `Impala`.
$$

$$section
### Username $(id="username")
Username to connect to Hive. This user should have the necessary privileges described in the section above.
$$

$$section
### Password $(id="password")
Password to connect to Hive.
$$

$$section
### Host Port $(id="hostPort")
The hostPort parameter specifies the host and port of the Hive server. This should be specified as a string in the format `hostname:port`. E.g., `myhivehost:10000`.
$$

$$section
### Auth $(id="auth")
The auth parameter specifies the authentication method to use when connecting to the Hive server. Possible values are `LDAP`, `NONE`, `CUSTOM`, or `KERBEROS`. If you are using Kerberos authentication, you should set auth to `KERBEROS`. If you are using custom authentication, you should set auth to `CUSTOM` and provide additional options in the `authOptions` parameter.
$$

$$section
### Kerberos Service Name $(id="kerberosServiceName")
This parameter specifies the Kerberos service name to use for authentication. This should only be specified if using Kerberos authentication. The default value is `hive`.
$$

$$section
### Database Schema $(id="databaseSchema")
Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
$$

$$section
### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of Hive, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$

$$section
### Auth Options $(id="authOptions")
Authentication options to pass to Hive connector. These options are based on SQLAlchemy.
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection. The connectionOptions parameter is specific to the connection method being used. For example, if you are using SSL encryption, you might set the connectionOptions parameter to {'ssl': 'true', 'sslTrustStore': '/path/to/truststore'}.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$