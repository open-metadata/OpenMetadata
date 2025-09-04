# Cassandra
In this section, we provide guides and references to use the Cassandra connector. You can view the full documentation for Cassandra <a href="https://docs.open-metadata.org/connectors/database/cassandra" target="_blank">here</a>.

## Requirements
To extract metadata using the Cassandra connector, ensure the user in the connection has the following permissions:
- Read Permissions: The ability to query tables and perform data extraction.
- Schema Operations: Access to list and describe keyspaces and tables.
You can find further information on the Cassandra connector in the <a href="https://docs.open-metadata.org/connectors/database/cassandra" target="_blank">here</a>.

## Connection Details

$$section
### Username $(id="username")
Username to connect to Cassandra. This user must have the necessary permissions to perform metadata extraction and table queries.
$$

$$section
### Password $(id="password")
Password to connect to Cassandra.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the Cassandra instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:9042`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:9042` as the value.
$$

$$section
### Cloud Config $(id="cloudConfig")
Configuration settings required when connecting to DataStax Astra DB in the cloud environment. These settings help establish and maintain secure connections to your cloud-hosted Cassandra database.
$$

$$section
### Connect Timeout $(id="connectTimeout")
Specifies the timeout duration in seconds for establishing new connections to Cassandra. This setting helps control how long the system should wait when attempting to create a new connection before timing out.
$$

$$section
### Request Timeout $(id="requestTimeout")
Defines the timeout duration in seconds for individual Cassandra requests. This setting determines how long each query or operation should wait for a response before timing out.
$$

$$section
### Token $(id="token")
The authentication token required for connecting to DataStax Astra DB. This token serves as the security credential for accessing your cloud database instance.
$$

$$section
### Secure Connect Bundle $(id="secureConnectBundle")
The file path to the Secure Connect Bundle (.zip) file. This bundle contains the necessary certificates and configuration files required to establish a secure connection to your DataStax Astra DB instance.
$$

$$section
### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of Cassandra, we won't have a Keyspace/Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments that can be sent to the service during connection.
$$

$$section
### SSL Mode $(id="sslMode")
SSL Mode to connect to Cassandra instance. By default, SSL is disabled.
$$

$$section
### SSL Configuration $(id="sslConfig")
SSL Configuration for the Cassandra connection. This is required when SSL Mode is enabled.
- `CA Certificate`: Path to the CA certificate file.
- `SSL Certificate`: Path to the client certificate file.
- `SSL Key`: Path to the client private key file.
$$