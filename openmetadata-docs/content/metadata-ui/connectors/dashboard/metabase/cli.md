---
title: Run Metabase Connector using the CLI
slug: /metadata-ui/connectors/dashboard/metabase/cli
---

<ConnectorIntro connector="Metabase" goal="CLI"/>

<Requirements />

<MetadataIngestionServiceDev service="dashboard" connector="Metabase" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: URL to the Metabase instance.
- **username**: Specify the User to connect to Metabase. It should have enough privileges to read all the metadata.
- **password**: Password for Metabase.
- **dbServiceName**: Optionally, add the name of the database service to add lineage.

<MetadataIngestionConfig service="dashboard" connector="Metabase" goal="CLI" />
