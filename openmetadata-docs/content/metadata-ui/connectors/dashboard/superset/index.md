---
title: Superset
slug: /metadata-ui/connectors/dashboard/superset
---

<ConnectorIntro service="dashboard" connector="Superset"/>

<Requirements />

<MetadataIngestionService connector="Superset"/>

<h4>Connection Options</h4>

- **Host and Port**: URL to the Superset instance.
- **Username**: Specify the User to connect to Superset. It should have enough privileges to read all the metadata.
- **Password**: Password for Superset.
- **Database Service Name**: Optionally, add the name of the database service to add lineage.

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Superset" />
