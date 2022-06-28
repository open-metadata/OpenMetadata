---
title: Tableau
slug: /metadata-ui/connectors/dashboard/tableau
---

<ConnectorIntro service="dashboard" connector="Tableau"/>

<Requirements />

<MetadataIngestionService connector="Tableau"/>

<h4>Connection Options</h4>

- **Host and Port**: URL to the Tableau instance.
- **Username**: Specify the User to connect to Tableau. It should have enough privileges to read all the metadata.
- **Password**: Password for Tableau.
- **API Version**: Tableau API version.
- **Site Name**: Tableau Site Name.
- **Personal Access Token**: Access token. To be used if not logging in with user/password.
- **Personal Access Token Secret**: Access token Secret. To be used if not logging in with user/password.
- **Environment**: Tableau Environment.

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Tableau" />
