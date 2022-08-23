---
title: Run Superset Connector using the CLI
slug: /openmetadata/connectors/dashboard/superset/cli
---

<ConnectorIntro connector="Superset" goal="CLI"/>

<Requirements />

The ingestion also works with Superset 2.0.0 🎉

<PythonMod connector="Superset" module="superset" />

<MetadataIngestionServiceDev service="dashboard" connector="Superset" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: URL to the Superset instance.
- **username**: Specify the User to connect to Superset. It should have enough privileges to read all the metadata.
- **password**: Password for Superset.
- **provider**: Authentication provider for the Superset service. For basic user/password authentication, the default value `db` can be used. This parameter is used internally to connect to Superset's REST API.

<MetadataIngestionConfig service="dashboard" connector="Superset" goal="CLI" />
