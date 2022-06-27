---
title: Run Looker Connector using Airflow SDK
slug: /metadata-ui/connectors/dashboard/looker/airflow
---

<ConnectorIntro connector="Looker" goal="Airflow"/>

<Requirements />

<MetadataIngestionServiceDev service="dashboard" connector="Looker" goal="Airflow"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: URL to the Looker instance.
- **username**: Specify the User to connect to Looker. It should have enough privileges to read all the metadata.
- **password**: Password to connect to Looker.
- **env**: Looker Environment.

<MetadataIngestionConfig service="dashboard" connector="Looker" goal="Airflow" />
