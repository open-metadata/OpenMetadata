---
title: Run Redash Connector using the CLI
slug: /metadata-ui/connectors/dashboard/redash/cli
---

<ConnectorIntro connector="Redash" goal="CLI"/>

<Requirements />

<MetadataIngestionServiceDev service="dashboard" connector="Redash" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: URL to the Redash instance.
- **username**: Specify the User to connect to Redash. It should have enough privileges to read all the metadata.
- **apiKey**: API key of the redash instance to access.

<MetadataIngestionConfig service="dashboard" connector="Redash" goal="CLI" />
