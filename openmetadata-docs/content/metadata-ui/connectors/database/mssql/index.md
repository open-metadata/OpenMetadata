---
title: MSSQL
slug: /metadata-ui/connectors/database/mssql
---

<ConnectorIntro connector="MSSQL" hasUsage="true" hasProfiler="true" hasDBT="true" />

<Requirements />

<MetadataIngestionService connector="MSSQL"/>

<h4>Connection Options</h4>

- **Connection Scheme**: Defines how to connect to MSSQL. We support `mssql+pytds`, `mssql+pyodbc`, and `mssql+pymssql`.
- **Username**: Specify the User to connect to MSSQL. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to MSSQL.
- **Host and Port**: Enter the fully qualified hostname and port number for your MSSQL deployment in the Host and Port field.
- **URI String**: In case of a `pyodbc` connection.
- **Database (Optional)**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to MSSQL during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to MSSQL during the connection. These details must be added as Key-Value pairs. 
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
  - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="MSSQL" hasUsage="true" hasProfiler="true" hasDBT="true" />
