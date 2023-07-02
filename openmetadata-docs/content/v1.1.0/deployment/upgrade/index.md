---
title: Upgrade OpenMetadata
slug: /deployment/upgrade
---

# Upgrade OpenMetadata

## Prerequisites

Everytime that you plan on upgrading OpenMetadata to a newer version, make sure to go over all these steps:

### 1. Backup your Metadata

Before upgrading your OpenMetadata version we strongly recommend backing up the metadata.

The source of truth is stored in the underlying database (MySQL and Postgres supported). You can refer
to the following guide for our backup utility:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="luggage"
    bold="Backup Metadata"
    href="/deployment/backup-restore-metadata" %}
      Learn how to back up MySQL data.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

This is important because if we face any unexpected issues during the upgrade process, you will be able to get back
to the previous version without any loss.

### 2. Review the Deprecation Notice and Breaking Changes

Releases might introduce deprecations and breaking changes that you should be aware of and understand before moving forward.

Below in this page you will find the details for the latest release, and you can find older release notes [here](/deployment/upgrade/versions).

The goal is to answer questions like:
- *Do I need to update my configurations?*
- *If I am running connectors externally, did their service connection change?*

Carefully reviewing this will prevent easy errors.

### 3. Update your OpenMetadata Ingestion Client

If you are running the ingestion workflows **externally**, you need to make sure that the Python Client you use is aligned
with the OpenMetadata server version.

For example, if you are upgrading the server to the version `x.y.z`, you will need to update your client with

```
pip install openmetadata-ingestion[<plugin>]==x.y.z
```

The `plugin` parameter is a list of the sources that we want to ingest. An example would look like this `openmetadata-ingestion[mysql,snowflake,s3]==1.1.0`.
You will find specific instructions for each connector [here](/connectors).

## Upgrade your installation

Once your metadata is safe, follow the required upgrade instructions:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Upgrade a Kubernetes Deployment"
    href="/deployment/upgrade/kubernetes" %}
      Upgrade your Kubernetes installation
  {% /inlineCallout %}

  {% inlineCallout
    color="violet-70"
    icon="celebration"
    bold="Upgrade a Docker Deployment"
    href="/deployment/upgrade/docker" %}
      Upgrade your Docker installation
  {% /inlineCallout %}

  {% inlineCallout
    color="violet-70"
    icon="storage"
    bold="Upgrade a Bare Metal Deployment"
    href="/deployment/upgrade/bare-metal" %}
      Upgrade your Bare Metal installation
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

## 1.1 - Stable Release 🎉

OpenMetadata 1.1 is a stable release. Please check the [release notes](/releases/latest-release).

If you are upgrading production this is the recommended version to upgrade to.

## Deprecation Notice

- The 1.1 Release will be the last one with support for Python 3.7 since it is already [EOL](https://devguide.python.org/versions/).
  OpenMetadata 1.2 will support Python version 3.8 to 3.10.
- In 1.2 we will completely remove the Bots configured with SSO. Only JWT will be available then. Please, upgrade your
  bots if you haven't done so. Note that the UI already does not allow creating bots with SSO.
- 1.1 is the last release that will allow ingesting Impala from the Hive connector. In the next release we will
  only support the Impala scheme from the Impala Connector.

## Breaking Changes for 1.1 Stable Release

### OpenMetadata Helm Chart Values

With `1.1.0` we are moving away from `global.*` helm values under openmetadata helm charts to `openmetadata.config.*`. 
This change is introduce as helm reserves global chart values across all the helm charts. This conflicted the use of 
OpenMetadata helm charts along with other helm charts for organizations using common helm values yaml files.

You can find more information on how to update your `values.yaml` when upgrading to 1.1 [here](/deployment/upgrade/kubernetes)

### Elasticsearch and OpenSearch

We now support ES version up to 7.16. However, this means that we need to handle the internals a bit differently
for Elasticsearch and OpenSearch. In the server configuration, we added the following key:

```yaml
elasticsearch:
  searchType: ${SEARCH_TYPE:- "elasticsearch"} # or opensearch
```

If you use Elasticsearch there's nothing to do. However, if you use OpenSearch, you will need to pass the new
parameter as `opensearch`.

### Elasticsearch and OpenSearch

We now support ES version up to 7.16. However, this means that we need to handle the internals a bit differently
for Elasticsearch and OpenSearch. In the server configuration, we added the following key:

```yaml
elasticsearch:
  searchType: ${SEARCH_TYPE:- "elasticsearch"} # or opensearch
```

If you use Elasticsearch there's nothing to do. However, if you use OpenSearch, you will need to pass the new
parameter as `opensearch`.

### Pipeline Service Client Configuration

If reusing an old YAML configuration file, make sure to add the following inside `pipelineServiceClientConfiguration`:

```yaml
pipelineServiceClientConfiguration:
  # ...
  # Secrets Manager Loader: specify to the Ingestion Framework how to load the SM credentials from its env
  # Supported: noop, airflow, env
  secretsManagerLoader: ${PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER:-"noop"}
  healthCheckInterval: ${PIPELINE_SERVICE_CLIENT_HEALTH_CHECK_INTERVAL:-300}
```

### Secrets Manager YAML config

If you are using the Secrets Manager and running ingestions via the CLI or Airflow, your workflow config looked
as follows:

```yaml
workflowConfig:
  openMetadataServerConfig:
    secretsManagerProvider: <Provider>
    secretsManagerCredentials:
      awsAccessKeyId: <aws access key id>
      awsSecretAccessKey: <aws secret access key>
      awsRegion: <aws region>
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

We are removing the `secretsManagerCredentials` key as a whole, so instead you'll need to configure:

```yaml
workflowConfig:
  openMetadataServerConfig:
    secretsManagerProvider: aws
    secretsManagerLoader: airflow  # if running on Airflow, otherwise `env`
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

You can find further details on this configuration [here](/deployment/secrets-manager/supported-implementations/aws-secrets-manager).

## Service Connection Changes

### MySQL and Postgres Connection

Adding IAM role support for their auth requires a slight change on their JSON Schemas:

#### From

```yaml
...
  serviceConnection:
    config: Mysql # or Postgres
    password: Password
```

#### To

If we want to use the basic authentication:

```yaml
...
  serviceConnection:
    config: Mysql # or Postgres
    authType:
      password: Password
```

Or if we want to use the IAM auth:

```yaml
...
  serviceConnection:
    config: Mysql # or Postgres
    authType:
      awsConfig:
        awsAccessKeyId: ...
        wsSecretAccessKey: ...
        awsRegion: ...
```

### Looker Connection

Now support GitHub and BitBucket as repositories for LookML models.

#### From

```yaml
...
  serviceConnection:
    config:
      type: Looker
      clientId: ...
      clientSecret: ...
      hostPort: ...
      githubCredentials:
        repositoryOwner: ...
        repositoryName: ...
        token: ...
```

#### To

```yaml
...
  serviceConnection:
    config:
      type: Looker
      clientId: ...
      clientSecret: ...
      hostPort: ...
      gitCredentials:
        type: GitHub # or BitBucket
        repositoryOwner: ...
        repositoryName: ...
        token: ...
```

### From GCS to GCP

We are renaming the `gcsConfig` to `gcpConfig` to properly define their role as generic Google Cloud configurations. This
impacts BigQuery, Datalake and any other source where you are directly passing the GCP credentials to connect to.

#### From

```yaml
...
  credentials:
    gcsConfig:
...
```

#### To

```yaml
...
  credentials:
    gcpConfig:
...
```

### Other changes

- Glue now supports custom database names via `databaseName`.
- Snowflake supports the `clientSessionKeepAlive` parameter to keep the session open for long processes.
- Kafka and Redpanda now have the `saslMechanism` based on enum values `["PLAIN", "GSSAPI", "SCRAM-SHA-256", "SCRAM-SHA-512", "OAUTHBEARER"]`.
- OpenMetadata Server Docker Image now installs the OpenMetadata Libraries under `/opt/openmetadata` directory
- Bumped up ElasticSearch version for Docker and Kubernetes OpenMetadata Dependencies Helm Chart to `7.16.3`