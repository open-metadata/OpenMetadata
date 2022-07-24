---
title: Druid
slug: /openmetadata/connectors/database/druid
---

<ConnectorIntro connector="Druid" hasProfiler="true" hasDBT="true" />

<Requirements />

<MetadataIngestionService connector="Druid"/>

<h4>Connection Options</h4>

- **Username**: Specify the User to connect to Druid. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Druid.
- **Host and Port**: Enter the fully qualified hostname and port number for your Druid deployment in the Host and Port field.
- **Database**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Druid during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Druid during the connection. These details must be added as Key-Value pairs. 
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
  - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Druid" hasProfiler="true" hasDBT="true" />
