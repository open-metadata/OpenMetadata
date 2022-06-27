---
title: Metabase
slug: /metadata-ui/connectors/dashboard/metabase
---

<ConnectorIntro service="dashboard" connector="Metabase"/>

<Requirements />

<MetadataIngestionService connector="Metabase"/>

<h4>Connection Options</h4>

- **Host and Port**: URL to the Metabase instance.
- **Username**: Specify the User to connect to Metabase. It should have enough privileges to read all the metadata.
- **Password**: Password for Metabase.
- **Database Service Name**: Optionally, add the name of the database service to add lineage.

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Metabase" />
