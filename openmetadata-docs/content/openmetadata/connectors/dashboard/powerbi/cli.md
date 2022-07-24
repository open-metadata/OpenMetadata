---
title: Run PowerBI Connector using the CLI
slug: /openmetadata/connectors/dashboard/powerbi/cli
---

<ConnectorIntro connector="PowerBI" goal="CLI"/>

<Requirements />

<MetadataIngestionServiceDev service="dashboard" connector="PowerBI" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: URL to the PowerBI instance.
- **clientId**: PowerBI Client ID.
- **clientSecret**: PowerBI Client Secret.
- **tenantId**: PowerBI Tenant ID.
- **authorityUri**: Authority URI for the service.
- **scope**: Service scope. By default `["https://analysis.windows.net/powerbi/api/.default"]`.

<MetadataIngestionConfig service="dashboard" connector="PowerBI" goal="CLI" />
