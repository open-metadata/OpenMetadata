---
title: Run Metabase Connector using Airflow SDK
slug: /openmetadata/connectors/dashboard/metabase/airflow
---

<ConnectorIntro connector="Metabase" goal="Airflow"/>

<Requirements />

<PythonMod connector="Metabase" module="metabase" />

<br/>

We have tested Metabase with version -- 0.42.4 and version -- 0.43.4

<MetadataIngestionServiceDev service="dashboard" connector="Metabase" goal="Airflow"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: URL to the Metabase instance.
- **username**: Specify the User to connect to Metabase. It should have enough privileges to read all the metadata.
- **password**: Password for Metabase.

<MetadataIngestionConfig service="dashboard" connector="Metabase" goal="Airflow" />
