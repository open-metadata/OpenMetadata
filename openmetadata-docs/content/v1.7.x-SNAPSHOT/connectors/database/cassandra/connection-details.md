---
title: Connection Details
slug: /connectors/database/cassandra/connections
---

#### Connection Details

- **Username**: Username to connect to Cassandra. This user must have the necessary permissions to perform metadata extraction and table queries.
- **Host Port**: When using the `cassandra` connecion schema, the hostPort parameter specifies the host and port of the Cassandra. This should be specified as a string in the format `hostname:port`. E.g., `localhost:9042`.- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

**Auth Type**: Following authentication types are supported:
1. **Basic Authentication**:
We'll use the user credentials to connect to Cassandra
- **password**: Password of the user.

2. **DataStax Astra DB Configuration**: 
Configuration for connecting to DataStax Astra DB in the cloud.
  - **connectTimeout**: Timeout in seconds for establishing new connections to Cassandra.
  - **requestTimeout**: Timeout in seconds for individual Cassandra requests.
  - **token**: The Astra DB application token used for authentication.
  - **secureConnectBundle**: File path to the Secure Connect Bundle (.zip) used for a secure connection to DataStax Astra DB.

