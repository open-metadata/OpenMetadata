---
title: PowerBI
slug: /openmetadata/connectors/dashboard/powerbi
---

<ConnectorIntro service="dashboard" connector="PowerBI"/>

<Requirements />

<MetadataIngestionService connector="PowerBI"/>

<h4>Connection Options</h4>

- **Host and Port**: URL to the PowerBI instance.
- **Client ID**: PowerBI Client ID.
- **Client Secret**: PowerBI Client Secret.
- **Tenant ID**: PowerBI Tenant ID.
- **Authority URI**: Authority URI for the service.
- **Scope**: Service scope. By default `["https://analysis.windows.net/powerbi/api/.default"]`.

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="PowerBI" />
