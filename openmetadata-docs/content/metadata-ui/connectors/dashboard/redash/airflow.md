---
title: Run Redash Connector using Airflow SDK
slug: /metadata-ui/connectors/dashboard/redash/airflow
---

<ConnectorIntro connector="Redash" goal="Airflow"/>

<Requirements />

<MetadataIngestionServiceDev service="dashboard" connector="Redash" goal="Airflow"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: URL to the Redash instance.
- **username**: Specify the User to connect to Redash. It should have enough privileges to read all the metadata.
- **apiKey**: API key of the redash instance to access.

<MetadataIngestionConfig service="dashboard" connector="Redash" goal="Airflow" />
