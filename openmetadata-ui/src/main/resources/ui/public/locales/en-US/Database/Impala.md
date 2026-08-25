# Impala
In this section, we provide guides and references to use the Impala connector. You can view the full documentation for Impala <a href="https://docs.open-metadata.org/connectors/database/impala" target="_blank">here</a>.

## Requirements
To extract metadata, the user used in the connection needs to be able to perform `SELECT`, `SHOW`, and `DESCRIBE` operations in the database/schema where the metadata needs to be extracted from.

### Profiler & Data Quality
Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

You can find further information on the Impala connector in the <a href="https://docs.open-metadata.org/connectors/database/impala" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value. OpenMetadata supports `Impala`.
$$

$$section
### Username $(id="username")
Username to connect to Impala. This user should have the necessary privileges described in the section above.
$$


$$section
### Password $(id="password")
Password to connect to Impala.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the Impala instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `myimpalahost:21050`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:21050` as the value.
$$

$$section
### Auth Mechanism$(id="authMechanism")
This parameter specifies the authentication method to use when connecting to the Impala server. Possible values are `NOSASL`, `PLAIN`, `GSSAPI`, `LDAP`, `JWT`. If you are using Kerberos authentication, you should set auth to `GSSAPI`. 
$$

$$section
### Kerberos Service Name $(id="kerberosServiceName")
This parameter specifies the Kerberos service name to use for authentication. This should only be specified if using Kerberos authentication.
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
In the case of Impala, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$

$$section
### Auth Options $(id="authOptions")
Authentication options to pass to Impala connector. These options are based on SQLAlchemy.
$$

$$section
### Use SSL $(id="useSSL")
Enables SSL for the connector.
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection. The connectionOptions parameter is specific to the connection method being used.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.For example, if you are using SSL encryption, update the parameters to {'use_ssl': 'true', 'ssl_cert': '/path/to/ca/cert'}.
Ensure that the certificate is accessible by the server. If you use a Docker or Kubernetes deployment, update the CA certificate in the Open Metadata server.
$$
