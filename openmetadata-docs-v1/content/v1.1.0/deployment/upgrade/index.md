---
title: Upgrade OpenMetadata
slug: /deployment/upgrade
---

# Upgrade OpenMetadata

## Releases

The OpenMetadata community will be doing feature releases and stable releases. 

 - Feature releases are to upgrade your sandbox or POCs to give feedback to the community and any potential bugs that the community needs to fix.
 - Stable releases are to upgrade your production environments and share it with your users.

## Backup Metadata

Before upgrading your OpenMetadata version we recommend backing up the metadata.

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

## Breaking Changes for 1.1 Stable Release

### Pipeline Service Client Configuration

If reusing an old YAML configuration file, make sure to add the following inside `pipelineServiceClientConfiguration`:

```yaml
pipelineServiceClientConfiguration:
  # ...
  # Secrets Manager Loader: specify to the Ingestion Framework how to load the SM credentials from its env
  # Supported: noop, airflow, env
  secretsManagerLoader: ${PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER:-"noop"}
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
