---
title: Run Superset Connector using Airflow SDK
slug: /openmetadata/connectors/dashboard/superset/airflow
---

<ConnectorIntro connector="Superset" goal="Airflow"/>

<Requirements />

<MetadataIngestionServiceDev service="dashboard" connector="Superset" goal="Airflow"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: URL to the Superset instance.
- **username**: Specify the User to connect to Superset. It should have enough privileges to read all the metadata.
- **password**: Password for Superset.
- **dbServiceName**: Optionally, add the name of the database service to add lineage.

<MetadataIngestionConfig service="dashboard" connector="Superset" goal="Airflow" />
