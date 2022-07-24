---
title: Run Looker Connector using the CLI
slug: /openmetadata/connectors/dashboard/looker/cli
---

<ConnectorIntro connector="Looker" goal="CLI"/>

<Requirements />

<MetadataIngestionServiceDev service="dashboard" connector="Looker" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: URL to the Looker instance.
- **username**: Specify the User to connect to Looker. It should have enough privileges to read all the metadata.
- **password**: Password to connect to Looker.
- **env**: Looker Environment.

<MetadataIngestionConfig service="dashboard" connector="Looker" goal="CLI" />
