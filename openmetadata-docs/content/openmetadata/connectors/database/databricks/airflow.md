---
title: Run Databricks Connector using Airflow SDK
slug: /openmetadata/connectors/database/databricks/airflow
---

<ConnectorIntro connector="Databricks" goal="Airflow" hasProfiler="true" hasDBT="true" />

<Requirements />

<MetadataIngestionServiceDev service="database" connector="Databricks" goal="Airflow"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: Enter the fully qualified hostname and port number for your Databricks deployment in the Host and Port field.
- **token**: Generated Token to connect to Databricks.
- **httpPath**: Databricks compute resources URL.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Databricks during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Databricks during the connection. These details must be added as Key-Value pairs. 
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
  - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

<MetadataIngestionConfig service="database" connector="Databricks" goal="Airflow" hasProfiler="true" hasDBT="true"/>
