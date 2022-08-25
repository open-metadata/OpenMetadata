---
title: Run Mode Connector using the CLI
slug: /openmetadata/connectors/dashboard/mode/cli
---

<ConnectorIntro connector="Mode" goal="CLI"/>

<Requirements />

<PythonMod connector="Mode" module="mode" />

<br/>


<MetadataIngestionServiceDev service="dashboard" connector="Mode" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **accessToken**: Access Token for Mode Dashboard.
- **accessTokenPassword**: Access Token Password for Mode Dashboard.
- **workspaceName**: Mode Workspace Name.

<MetadataIngestionConfig service="dashboard" connector="Mode" goal="CLI" />
