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

## Deprecation Notice

- The 1.1 Release will be the last one with support for Python 3.7 since it is already [EOL](https://devguide.python.org/versions/).
  OpenMetadata 1.2 will support Python version 3.8 to 3.10.
- In 1.2 we will completely remove the Bots configured with SSO. Only JWT will be available then. Please, upgrade your
  bots if you haven't done so. Note that the UI already does not allow creating bots with SSO.
- 1.1 is the last release that will allow ingesting Impala from the Hive connector. In the next release we will
  only support the Impala scheme from the Impala Connector.

## Breaking Changes for 1.1 Stable Release

### OpenMetadata Helm Chart Values

With `1.1.0` we are moving away from `global.*` helm values under openmetadata helm charts to `openmetadata.config.*`. This change is introduce as helm reserves global chart values across all the helm charts. This conflicted the use of OpenMetadata helm charts along with other helm charts for organizations using common helm values yaml files.

For example, with `1.0.X` Application version Releases, helm values would look like below -
```yaml
global:
  ...
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins:
      - "user1"
    botPrincipals:
      - "<service_application_client_id>"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "google"
    publicKeys:
      - "https://www.googleapis.com/oauth2/v3/certs"
      - "http://openmetadata:8585/api/v1/system/config/jwks"
    authority: "https://accounts.google.com"
    clientId: "{client id}"
    callbackUrl: "http://localhost:8585/callback"
  ...
```

With OpenMetadata Application version `1.1.0` and above, the above config will need to be updated as
```yaml
openmetadata:
  config:
    authorizer:
      className: "org.openmetadata.service.security.DefaultAuthorizer"
      containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
      initialAdmins:
        - "user1"
        - "user2"
      botPrincipals:
        - "<service_application_client_id>"
      principalDomain: "open-metadata.org"
    authentication:
      provider: "google"
      publicKeys:
        - "https://www.googleapis.com/oauth2/v3/certs"
        - "http://openmetadata:8585/api/v1/system/config/jwks"
      authority: "https://accounts.google.com"
      clientId: "{client id}"
      callbackUrl: "http://localhost:8585/callback"
```

A quick and easy way to update the config is to use [yq](https://mikefarah.gitbook.io/yq/) utility to manipulate YAML files.

```bash
yq -i -e '{"openmetadata": {"config": .global}}' openmetadata.values.yml
```

The above command will update `global.*` with `openmetadata.config.*` yaml config. Please note, the above command is only recommended for users with custom helm values file explicit for OpenMetadata Helm Charts.

For more information, visit the official helm docs for [global chart values](https://helm.sh/docs/chart_template_guide/subcharts_and_globals/#global-chart-values).

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