# Cassandra
In this section, we provide guides and references to use the Cassandra connector. You can view the full documentation for Cassandra [here](https://docs.open-metadata.org/connectors/database/cassandra).

## Requirements
To extract metadata using the Cassandra connector, ensure the user in the connection has the following permissions:
- Read Permissions: The ability to query tables and perform data extraction.
- Schema Operations: Access to list and describe keyspaces and tables.
You can find further information on the Cassandra connector in the [here](https://docs.open-metadata.org/connectors/database/cassandra).

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
  
  Configuration for connecting to DataStax Astra DB in the cloud.

  - connectTimeout: Timeout in seconds for establishing new connections to Cassandra.
  - requestTimeout: Timeout in seconds for individual Cassandra requests.
  - token: The Astra DB application token used for authentication.
  - secureConnectBundle: File path to the Secure Connect Bundle (.zip) used for a secure connection to DataStax Astra DB.
$$

$$section
### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of Cassandra, we won't have a Keyspace/Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$
