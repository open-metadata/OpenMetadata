---
title: Upgrade OpenMetadata
slug: /deployment/upgrade
---

# Upgrade OpenMetadata

## Releases

OpenMetadata community will be doing feature releases and stable releases. 

 - Feature releases are to upgrade your sandbox or POCs to give feedback to the community and any potential bugs that the community needs to fix.
 - Stable releases are to upgrade your production environments and share it with your users.

## 0.13.2 - Stable Release

OpenMetadata 0.13.2 is a stable release. Please check the [release notes](https://github.com/open-metadata/OpenMetadata/releases/tag/0.13.1-release)

If you are upgrading production this is the recommended version to upgrade.

## Breaking Changes for 0.13.2 Stable Release

### EntityName

### Tags API

Tags APIs were coded long before other entities' APIs were added. Due to this, tag API does not follow the API convention 
that all the other entities are following. This issue makes backward incompatible changes to follow the same convention as glossaries.

You can find the full list of API paths changes in the following [issue](https://github.com/open-metadata/OpenMetadata/issues/9259).

### Metabase and Domo Dashboards `name`

With the new restrictions on the `EntityName` and to ensure unicity of the assets, the **Metabase** and **Domo Dashboard** sources
now ingest the `name` of the charts and dashboards with their internal ID value. Their `name` value will be used
as the display name, but not as the OpenMetadata `name` anymore.

The recommended approach here is to create a new service and ingest the metadata again. If you ingest from the same
service, the assets in there will end up being duplicated, as the `name` in OpenMetadata is used to identify each asset.

Let us know if you have any questions around this topic.

### Ingestion Framework sources directory structure

We have converted source modules (e.g., `redshift.py`) into packages containing all the necessary information (e.g., `redshift/metadata.py`).
This has helped us reorganise functionalities and easily focus on each connector independently.

If you're extending any of the sources, you'll need to update your imports. You can take a look at the new
structure [here](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/source).


## 0.13.1 - Stable Release

OpenMetadata 0.13.1 is a stable release. Please check the [release notes](https://github.com/open-metadata/OpenMetadata/releases/tag/0.13.1-release) 

## Breaking Changes for 0.13.1 Stable Release

OpenMetadata Release 0.13.1 introduces below breaking changes -

### Webhooks

Starting from 0.13.1 , OpenMetadata will be deprecating the existing webhooks for Slack, MSTeams.

Before upgrading to 0.13.1 it is recommended to save the existing Webhook configs(like webhook url) to use them later.

We have added Alerts/Notifications , which can be configured to receive customised alerts on updates in OM using Triggers, Filtering Information to different destinations like Slack, MsTeams or even Emails.
Please use the same webhook config that you had saved from previous version to configure the Alerts Destination after upgrading.


OpenMetadata Release 0.13.x introduces below breaking changes:

### Docker Volumes

OpenMetadata Release 0.13.x introduces Default Docker Volumes for Database (MySQL, PostgreSQL) and ElasticSearch with Docker deployment.

- If you are looking for the fresh deployment of 0.13.x - [here](https://docs.open-metadata.org/deployment/docker)
- If you are looking for upgrading of the new version i.e 0.13.x - [here](https://docs.open-metadata.org/deployment/upgrade/docker)

### MySQL Helm Chart Version Updated to 9.2.1

OpenMetadata Helm Chart Release with Application Version `0.13.1` updates the Bitnami MySQL Helm Chart version to `9.2.1` from `8.8.23`. This is not a breaking change but existing user's trying to upgrade will experience a slight delay in OpenMetadata Dependencies Helm Chart Upgrades as it pulls new docker image for MySQL. Please note that OpenMetadata Dependencies Helm Chart is not recommended for production use cases. Please follow the [kubernetes deployment](/deployment/kubernetes) for new installation or [upgrade kubernetes](/deployment/upgrade/kubernetes) for upgrading OpenMetadata in Kubernetes.

### dbt Workflow

dbt ingestion has been separated from the metadata ingestion. It can now be configured as a separate workflow after completing the metadata ingestion workflow.

We will remove the dbt configuration from your existing metadata ingestion pipelines and they will keep working as expected.

After upgrading you will have to create the dbt workflow for the dbt ingestion to start working again.

### Airflow Lineage Backend

- The import for the Airflow Lineage Backend has been updated from `airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend`
  to `airflow_provider_openmetadata.lineage.backend.OpenMetadataLineageBackend`.
- We removed support from Airflow v1.
- The failure callback now only updates the pipeline status if the Pipeline already exists in OpenMetadata.

## 0.13.0 - Feature Release

OpenMetadata 0.13.0 is a **feature release**. 

**Don't upgrade your production with 0.13.0 feature release** 

Explore 0.13.0 by following up [Deployment guides](https://docs.open-metadata.org/deployment) and please give us any feedback on our [community slack](https://slack.open-metadata.org)

## Backup Metadata

Before upgrading your OpenMetadata version we recommend backing up the metadata.

The source of truth is stored in the underlying database (MySQL and Postgres supported). You can refer
to the following guide for our backup utility:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="luggage"
    bold="Backup Metadata"
    href="/deployment/backup-restore-metadata"
  >
    Learn how to back up MySQL data.
  </InlineCallout>
</InlineCalloutContainer>

## Upgrade your installation

Once your metadata is safe, follow the required upgrade instructions:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Upgrade a Kubernetes Deployment"
    href="/deployment/upgrade/kubernetes"
  >
    Upgrade your Kubernetes installation
  </InlineCallout>

  <InlineCallout
    color="violet-70"
    icon="celebration"
    bold="Upgrade a Docker Deployment"
    href="/deployment/upgrade/docker"
  >
    Upgrade your Docker installation
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Upgrade a Bare Metal Deployment"
    href="/deployment/upgrade/bare-metal"
  >
    Upgrade your Bare Metal installation
  </InlineCallout>
</InlineCalloutContainer>

