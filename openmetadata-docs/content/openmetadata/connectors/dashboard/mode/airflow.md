---
title: Run Mode Connector using Airflow SDK
slug: /openmetadata/connectors/dashboard/mode/airflow
---

<ConnectorIntro connector="Mode" goal="Airflow"/>

<Requirements />

<PythonMod connector="Mode" module="mode" />

<br/>


<MetadataIngestionServiceDev service="dashboard" connector="Mode" goal="Airflow"/>

<h4>Source Configuration - Service Connection</h4>

- **accessToken**: Access Token for Mode Dashboard.
- **accessTokenPassword**: Access Token Password for Mode Dashboard.
- **workspaceName**: Mode Workspace Name.


<MetadataIngestionConfig service="dashboard" connector="Mode" goal="Airflow" />
