#### Connection Details

- **username**: Specify the User to connect to Impala. It should have enough privileges to read all the metadata.
- **password**: Password to connect to Impala.
- **hostPort**: Enter the fully qualified hostname and port number for your Impala deployment in the Host and Port field.
- **authMechanism**: This parameter specifies the authentication method to use when connecting to the Impala server. Possible values are `NOSASL`, `PLAIN`, `GSSAPI`, `LDAP`, `JWT`. If you are using Kerberos authentication, you should set auth to `GSSAPI`. 
- **kerberosServiceName**: This parameter specifies the Kerberos service name to use for authentication. This should only be specified if using Kerberos authentication.
- **databaseSchema**: Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **databaseName**: In OpenMetadata, the Database Service hierarchy works as follows:
`Database Service > Database > Schema > Table`. In the case of Impala, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
- **useSSL**: Establish secure connection with Impala. Enables SSL for the connector.
- **authOptions**: Enter the auth options string for impala connection.