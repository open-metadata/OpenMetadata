---
title: Run the dbt Cloud Connector Externally
description: Learn how to configure OpenMetadata's dbt Cloud connector using YAML. Step-by-step setup guide for seamless data pipeline integration and metadata extraction.
slug: /connectors/pipeline/dbtcloud/yaml
---

{% connectorDetailsHeader
name="dbt Cloud"
stage="PROD"
platform="Collate"
availableFeatures=["Pipelines", "Pipeline Status", "Tags", "Usage"]
unavailableFeatures=["Owners", "Lineage"]
/ %}


In this section, we provide guides and references to use the dbt Cloud connector.

Configure and schedule dbt Cloud metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/dbtCloudConnection.json)
you can find the structure to create a connection to DBT cloud.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for dbt Cloud:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**host**: DBT cloud Access URL eg.`https://abc12.us1.dbt.com`. Go to your dbt cloud account settings to know your Access URL.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**discoveryAPI**: DBT cloud Access URL eg. `https://metadata.cloud.getdbt.com/graphql`. Go to your dbt cloud account settings to know your Discovery API url.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**accountId**: The Account ID of your DBT cloud Project. Go to your dbt cloud account settings to know your Account Id. This will be a numeric value but in openmetadata we parse it as a string.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**jobIds**: Optional. Job IDs of your DBT cloud Jobs in your Project to fetch metadata for. Look for the segment after "jobs" in the URL. For instance, in a URL like `https://cloud.getdbt.com/accounts/123/projects/87477/jobs/73659994`, the job ID is `73659994`. This will be a numeric value but in openmetadata we parse it as a string. If not passed all Jobs under the Account id will be ingested.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**projectIds**: Optional.  Project IDs of your DBT cloud Account to fetch metadata for. Look for the segment after "projects" in the URL. For instance, in a URL like `https://cloud.getdbt.com/accounts/123/projects/87477/jobs/73659994`, the job ID is `87477`. This will be a numeric value but in openmetadata we parse it as a string. If not passed all Projects under the Account id will be ingested.

Note that if both `Job Ids` and `Project Ids` are passed then it will filter out the jobs from the passed projects. any `Job Ids` not belonging to the `Project Ids` will also be filtered out.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**token**: The Authentication Token of your DBT cloud API Account. To get your access token you can follow the docs [here](https://docs.getdbt.com/docs/dbt-cloud-apis/authentication).
Make sure you have the necessary permissions on the token to run graphql queries and get job and run details. 

{% /codeInfo %}


{% partial file="/v1.8/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml {% isCodeBlock=true %}
source:
  type: dbtcloud
  serviceName: dbtcloud_source
  serviceConnection:
    config:
      type: DBTCloud
```
```yaml {% srNumber=1 %}
      host: "https://account_prefix.account_region.dbt.com"
```
```yaml {% srNumber=2 %}
      discoveryAPI: "https://metadata.cloud.getdbt.com/graphql"
```
```yaml {% srNumber=3 %}
      accountId: "numeric_account_id"
```
```yaml {% srNumber=4 %}
      # jobIds: ["job_id_1", "job_id_2", "job_id_3"]
```
```yaml {% srNumber=5 %}
      # projectIds: ["project_id_1", "project_id_2", "project_id_3"]
```
```yaml {% srNumber=6 %}
      token: auth_token
```

{% partial file="/v1.8/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}
