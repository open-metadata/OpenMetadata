---
title: Run Superset Connector using the CLI
slug: /metadata-ui/connectors/dashboard/superset/cli
---

<ConnectorIntro connector="Superset" goal="CLI"/>

<Requirements />

<MetadataIngestionServiceDev service="dashboard" connector="Superset" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: URL to the Superset instance.
- **username**: Specify the User to connect to Superset. It should have enough privileges to read all the metadata.
- **password**: Password for Superset.
- **dbServiceName**: Optionally, add the name of the database service to add lineage.

<MetadataIngestionConfig service="dashboard" connector="Superset" goal="CLI" />
