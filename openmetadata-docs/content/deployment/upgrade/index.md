---
title: Upgrade OpenMetadata
slug: /deployment/upgrade
---

# Upgrade OpenMetadata

## Releases

OpenMetadata community will be doing feature releases and stable releases. 

 - Feature releases are to upgrade your sandbox or POCs to give feedback to the community and any potential bugs that the community needs to fix.
 - Stable releases are to upgrade your production environments and share it with your users.

## 0.13.1 - Stable Release

OpenMetadata 0.13.1 is a stable release. Please check the [release notes](https://github.com/open-metadata/OpenMetadata/releases/tag/0.13.1-release) 

If you are upgrading production this is the recommended version to upgrade.

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


## 0.12.3 - Stable release
 
 OpenMetadata 0.12.3 is a stable release. Please check the [release notes](https://github.com/open-metadata/OpenMetadata/releases/tag/0.12.3-release) 

If you are upgrading production this is the recommended version to upgrade.
## Breaking Changes from 0.12.x Stable Release

OpenMetadata Release 0.12.x introduces below breaking changes -

### Change of OpenMetadata Service Namespace

Under the [openmetadata.yaml](https://github.com/open-metadata/OpenMetadata/blob/main/conf/openmetadata.yaml), all the class names are updated from `org.openmetadata.catalog.*` to `org.openmetadata.service.*`.

- If you are using a previous version of openmetadata.yaml config file with [bare metal](/deployment/bare-metal) installation, make sure to migrate all these values as per new openmetadata.yaml configurations. Check the below example code snippet from openmetadata.yaml configuration

```yaml
...
authorizerConfiguration:
  className: ${AUTHORIZER_CLASS_NAME:-org.openmetadata.service.security.DefaultAuthorizer}
  containerRequestFilter: ${AUTHORIZER_REQUEST_FILTER:-org.openmetadata.service.security.JwtFilter}
...
```

- If you are using [docker](/deployment/docker) installation with your custom env file, update all the environement variables from `org.openmetadata.catalog.*` to `org.openmetadata.service.*`.

```
AUTHORIZER_CLASS_NAME=org.openmetadata.service.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.service.security.JwtFilter
```

- If you are running openmetadata on [kubernetes with helm charts](/deployment/kubernetes), make sure to update `global.authorizer.className` and `global.authorizer.containerRequestFilter` with below values for your custom openmetadata helm chart values file.

```yaml
global:
  ...
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
  ...
```

### Centralising of openmetadata/ingestion and openmetadata/airflow docker images

Starting 0.12.1 Release, we have centralized openmetadata/airflow and openmetadata/ingestion docker images 
with openmetadata/ingestion docker image which will be used with docker compose installation and kubernetes helm chart installation. This docker image is based on apache-airflow 2.3.3 image with python 3.9.9. This will be a rootless docker image for enhanced security.

- There is no change or effect with docker installation

- This is a breaking change if you are using a custom openmetadata-dependencies kubernetes helm chart values file.
You will need to manually update the airflow image and tag with openmetadata/ingestion:0.13.1

```yaml
...
airflow:
  airflow:
    image:
      repository: openmetadata/ingestion
      tag: 0.13.1
      pullPolicy: "IfNotPresent"
  ...
```

<p>
If you are extending openmetadata/airflow docker image with 0.13.1 release, you can safely replace that with openmetadata/ingestion:0.13.1 Docker Image.
</p>

```Dockerfile
FROM openmetadata/ingestion:0.13.1
USER airflow
...
```

### Basic Authentication enabled by default

We have deprecated and removed no-auth as the authentication mechanism starting 0.12.1 Release with OpenMetadata.

The default Authentication mechanism will be basic authentication. You can login to OpenMetadata UI with below default credentials -

```
Username - admin
Password - admin
```

### Enabled JWT Token Configuration by default

Starting 0.12.1 Release, OpenMetadata Installation will provide a default configuration that will enable JWT Token Configuration for the OpenMetadata Instance.

If you want to setup a production Open Metadata instance, it is recommended to follow [enable jwt tokens](/deployment/security/enable-jwt-tokens) to setup and configure your own JWT Token configurations.

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

