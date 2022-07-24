---
title: Oracle
slug: /openmetadata/connectors/database/oracle
---

<ConnectorIntro connector="Oracle" hasProfiler="true" hasDBT="true" />

<Requirements />

<MetadataIngestionService connector="Oracle"/>

<h4>Connection Options</h4>

- **Username**: Specify the User to connect to Oracle. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Oracle.
- **Host and Port**: Enter the fully qualified hostname and port number for your Oracle deployment in the Host and Port field.
- **Oracle Service Name**: The Oracle Service name is the TNS alias that you give when you remotely connect to your database and this Service name is recorded in tnsnames.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Oracle during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Oracle during the connection. These details must be added as Key-Value pairs. 
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
  - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Oracle" hasProfiler="true" hasDBT="true" />
