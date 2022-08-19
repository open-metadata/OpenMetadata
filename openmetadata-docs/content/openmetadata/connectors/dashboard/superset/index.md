---
title: Superset
slug: /openmetadata/connectors/dashboard/superset
---

<ConnectorIntro service="dashboard" connector="Superset"/>

<Requirements />

The ingestion also works with Superset 2.0.0 🎉

<MetadataIngestionService connector="Superset"/>

<h4>Connection Options</h4>

- **Host and Port**: URL to the Superset instance.
- **Username**: Specify the User to connect to Superset. It should have enough privileges to read all the metadata.
- **Password**: Password for Superset.
- **Provider**: Authentication provider for the Superset service. For basic user/password authentication, the default value `db` can be used. This parameter is used internally to connect to Superset's REST API.

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Superset" />
