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

## 1.0 - Stable Release 🎉

OpenMetadata 1.0 is a stable release. Please check the [release notes](/releases/latest-release).

If you are upgrading production this is the recommended version to upgrade to.

## Breaking Changes for 1.0 Stable Release

### JWT Authentication Public Keys URL Change

With Release 1.0.0, JWT Authentication endpoint needs to be updated from `{OPENMETADATA_HOST_NAME}/api/v1/config/jwks` to `{OPENMETADATA_HOST_NAME}/api/v1/system/config/jwks`. This is required as part of [API Endpoints](/deployment/upgrade#api-endpoint-changes). The Environment variable name is `AUTHENTICATION_PUBLIC_KEYS`. It expects list of URLs. One of the URL will be for OpenMetadata JWT Authentication Endpoint.

### Airflow Configuration & Pipeline Service Client

The new section on the `openmetadata.yaml` configuration for the Pipeline Service Client has been updated.

We now have a `pipelineServiceClientConfiguration`, instead of the old [airflowConfiguration](https://github.com/open-metadata/OpenMetadata/blob/0.13.3/conf/openmetadata.yaml#L214).

```yaml
pipelineServiceClientConfiguration:
  className: ${PIPELINE_SERVICE_CLIENT_CLASS_NAME:-"org.openmetadata.service.clients.pipeline.airflow.AirflowRESTClient"}
  apiEndpoint: ${PIPELINE_SERVICE_CLIENT_ENDPOINT:-http://localhost:8080}
  metadataApiEndpoint: ${SERVER_HOST_API_URL:-http://localhost:8585/api}
  hostIp: ${PIPELINE_SERVICE_CLIENT_HOST_IP:-""}
  verifySSL: ${PIPELINE_SERVICE_CLIENT_VERIFY_SSL:-"no-ssl"} # Possible values are "no-ssl", "ignore", "validate"
  sslConfig:
    validate:
      certificatePath: ${PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH:-""} # Local path for the Pipeline Service Client

  # Default required parameters for Airflow as Pipeline Service Client
  parameters:
    username: ${AIRFLOW_USERNAME:-admin}
    password: ${AIRFLOW_PASSWORD:-admin}
    timeout: ${AIRFLOW_TIMEOUT:-10}

    # If using 1.0.1 or later
    truststorePath: ${AIRFLOW_TRUST_STORE_PATH:-""}
    truststorePassword: ${AIRFLOW_TRUST_STORE_PASSWORD:-""}
```

Most existing environment variables remain the same, except for these three:
- `AIRFLOW_HOST_IP` → `PIPELINE_SERVICE_CLIENT_HOST_IP`
- `AIRFLOW_VERIFY_SSL` → `PIPELINE_SERVICE_CLIENT_VERIFY_SSL`
- `AIRFLOW_SSL_CERT_PATH` → `PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH`

When upgrading, make sure to update the environment variables and, if working on Bare Metal, make sure to use the updated `openmetadata.yaml`.

### Deprecation Notice

- When configuring Bots, **JWT** tokens will be the preferred method of authentication. Any existing SSO-based service accounts
will continue to work on 1.0, but will be fully deprecated on future releases.
- As we added the new Impala connector, We will remove the `impala` scheme from Hive in the next release.

### API Endpoint Changes
The following endpoints have been renamed in 1.0

|Previous Endpoint|New Endpoint|
|---|---|
|`api/v1`|**Removed**|
|`api/v1/services`|**Removed**|
|`api/v1/version`|`api/v1/system/version`|
|`api/v1/util/entities/count`|`api/v1/system/entities/count`|
|`api/v1/util/services/count`|`api/v1/system/services/count`|
|`api/v1/settings`|`api/v1/system/settings`|
|`api/v1/config`|`api/v1/system/config`|
|`api/v1/testSuite`|`api/v1/dataQuality/testSuites`|
|`api/v1/testCase`|`api/v1/dataQuality/testCases`|
|`api/v1/testDefinition`|`api/v1/dataQuality/testDefinitions`|
|`api/v1/automations/workflow`|`api/v1/automations/workflows`|
|`api/v1/events/subscription`|`api/v1/events/subscriptions`|
|`api/v1/analytic/reportData`|`api/v1/analytics/dataInsights/data`|
|`api/v1/analytics/webAnalyticEvent/`|`api/v1/analytics/web/events/`|
|`api/v1/indexResource/reindex`|`api/v1/search/reindex`|
|`api/v1/indexResource/reindex/status/{runMode}`|`api/v1/search/reindex/status/{runMode}`|

### Sample Data Deprecation

The `SampleData` service has been deprecated. It is now a `CustomConnector`. If you have some entities in `SampleData`, please DELETE the service if you don’t want to keep them, or we can help you migrate them to a Custom Connector.

Note that this service type was mostly used on quickstarts and tests to add some example assets into OpenMetadata. This should be transparent for most of the users.

### Location Entity

We are deprecating the `Location` Entity in favor of the Containers and new Storage Service:
- Dropping the `location_entity` table,
- Removing the `Location` APIs.

If you did not have any custom implementation, this was partially used in the Glue Database connector. However, the information was not being actively shown.

If you had custom implementations on top of the `Location` APIs, reach out to us, and we can help migrate to the new Storage Services.

### AWS Connectors

The `endpointURL` property is now formatted as a proper URI, e.g., `http://something.com`. If you have added this configuration
in your connectors, please update the `endpointURL` format with the right scheme.

Note that this property is OPTIONAL, and for the most cases it will either be left blank or already configured with the right format for it to work properly, e.g., `s3://...`.

### Python SDK Submodules name change
- **`metadata.test_suite.*`**: this submodule has been renamed `metadata.data_quality.*`. You can view the full change [here](https://github.com/open-metadata/OpenMetadata/pull/10890/files)
- **`metadata.orm_profiler.*`**: this submodule has been renamed `metadata.profiler.*`. You can view the full change [here](https://github.com/open-metadata/OpenMetadata/pull/10350/files)
