---
title: Run PowerBI Connector using Airflow SDK
slug: /metadata-ui/connectors/dashboard/powerbi/airflow
---

<ConnectorIntro connector="PowerBI" goal="Airflow"/>

<Requirements />

<MetadataIngestionServiceDev service="dashboard" connector="PowerBI" goal="Airflow"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: URL to the PowerBI instance.
- **clientId**: PowerBI Client ID.
- **clientSecret**: PowerBI Client Secret.
- **tenantId**: PowerBI Tenant ID.
- **authorityUri**: Authority URI for the service.
- **scope**: Service scope. By default `["https://analysis.windows.net/powerbi/api/.default"]`.

<MetadataIngestionConfig service="dashboard" connector="PowerBI" goal="Airflow" />
