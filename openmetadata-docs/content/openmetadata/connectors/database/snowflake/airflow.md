---
title: Run Snowflake Connector using Airflow SDK
slug: /openmetadata/connectors/database/snowflake/airflow
---

<ConnectorIntro connector="Snowflake" goal="Airflow" hasUsage="true" hasProfiler="true" hasDBT="true" />

<Requirements />

<MetadataIngestionServiceDev service="database" connector="Snowflake" goal="Airflow"/>

<h4>Source Configuration - Service Connection</h4>

- **username**: Specify the User to connect to Snoflake. It should have enough privileges to read all the metadata.
- **password**: Password to connect to Snowflake.
- **account**: Enter the details for the Snowflake Account.
- **role**: Enter the details of the Snowflake Account Role. This is an optional detail.
- **warehouse**: Warehouse name.
- **database**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **privateKey**: Connection to Snowflake instance via Private Key.
- **snowflakePrivatekeyPassphrase**: Snowflake Passphrase Key used with Private Key.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Snowflake during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Snowflake during the connection. These details must be added as Key-Value pairs.
    - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
    - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

<MetadataIngestionConfig service="database" connector="Snowflake" goal="Airflow" hasUsage="true" hasProfiler="true" hasDBT="true"/>
