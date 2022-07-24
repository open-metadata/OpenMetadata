---
title: Run Presto Connector using the CLI
slug: /openmetadata/connectors/database/presto/cli
---

<ConnectorIntro connector="Presto" goal="CLI" hasProfiler="true" hasDBT="true" />

<Requirements />

<MetadataIngestionServiceDev service="database" connector="Presto" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **username**: Specify the User to connect to Presto. It should have enough privileges to read all the metadata.
- **password**: Password to connect to Presto.
- **hostPort**: Enter the fully qualified hostname and port number for your Presto deployment in the Host and Port field.
- **catalog**: Presto offers a catalog feature where all the databases are stored. Providing the Catalog is mandatory.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Presto during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Presto during the connection. These details must be added as Key-Value pairs. 
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
  - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

<MetadataIngestionConfig service="database" connector="Presto" goal="CLI" hasProfiler="true" hasDBT="true"/>
