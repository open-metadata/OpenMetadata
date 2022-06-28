---
title: Run DeltaLake Connector using Airflow SDK
slug: /metadata-ui/connectors/database/deltalake/airflow
---

<ConnectorIntro connector="DeltaLake" goal="Airflow" hasDBT="true" />

<Requirements />

<MetadataIngestionServiceDev service="database" connector="DeltaLake" goal="Airflow"/>

<h4>Source Configuration - Service Connection</h4>

- **metastoreHostPort**: Enter the Host & Port of Hive Metastore to establish a sparks session. Either of metastoreHostPort or metastoreFilePath is required.
- **metastoreFilePath**: Enter the file path to local Metastore incase sparks cluster is running locally. Either of metastoreHostPort or metastoreFilePath is required.
- **appName (Optional)**: Enter the app name of spark session.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to DeltaLake during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to DeltaLake during the connection. These details must be added as Key-Value pairs. 
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
  - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

<MetadataIngestionConfig service="database" connector="DeltaLake" goal="Airflow" hasDBT="true"/>
