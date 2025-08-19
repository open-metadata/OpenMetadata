---
title: Run the Azure Data Factory Connector Externally
description: Configure Azure Data Factory ingestion via YAML to extract ETL job metadata, lineage, and schedule logic.
slug: /connectors/pipeline/datafactory/yaml
collate: true
---

{% connectorDetailsHeader
name="Azure Data Factory"
stage="PROD"
platform="Collate"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage"]
unavailableFeatures=["Owners", "Tags"]
/ %}


In this section, we provide guides and references to use the Azure Data Factory connector.

Configure and schedule Azure Data Factory metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
    - [Data Factory Versions](#data-factory-versions)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.10/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Data Factory Versions

The Ingestion framework uses [Azure Data Factory APIs](https://learn.microsoft.com/en-us/rest/api/datafactory/v2) to connect to the Data Factory and fetch metadata.

You can find further information on the Azure Data Factory connector in the [docs](/connectors/pipeline/datafactory).

## Permissions

Ensure that the service principal or managed identity you’re using has the necessary permissions in the Data Factory resource (Reader, Contributor or Data Factory Contributor role at minimum).

### Python Requirements

{% partial file="/v1.10/connectors/python-requirements.md" /%}

To run the Data Factory ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[datafactory]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/datafactoryConnection.json)
you can find the structure to create a connection to Data Factory.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Data Factory:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% partial file="/v1.10/connectors/yaml/common/azure-config-def.md" /%}

{% codeInfo srNumber=5 %}

**subscription_id**: Your Azure subscription’s unique identifier. In the Azure portal, navigate to Subscriptions > Your Subscription > Overview. You’ll see the subscription ID listed there.

{% /codeInfo %}


{% codeInfo srNumber=6 %}

**resource_group_name**: This is the name of the resource group that contains your Data Factory instance. In the Azure portal, navigate to Resource Groups. Find your resource group, and note the name.

{% /codeInfo %}


{% codeInfo srNumber=7 %}

**factory_name**: The name of your Data Factory instance. In the Azure portal, navigate to Data Factories and find your Data Factory. The Data Factory name will be listed there.

{% /codeInfo %}


{% codeInfo srNumber=8 %}

**run_filter_days**: The days range when filtering pipeline runs. It specifies how many days back from the current date to look for pipeline runs, and filter runs within the given period of days. Default is `7` days. `Optional`

{% /codeInfo %}


{% partial file="/v1.10/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.10/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.10/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml {% isCodeBlock=true %}
source:
  type: datafactory
  serviceName: datafactory_source
  serviceConnection:
    config:
      type: DataFactory
      configSource: 
```

{% partial file="/v1.10/connectors/yaml/common/azure-config.md" /%}

```yaml {% srNumber=5 %}
      subscription_id: subscription_id
```
```yaml {% srNumber=6 %}
      resource_group_name: resource_group_name
```
```yaml {% srNumber=7 %}
      factory_name: factory_name
```
```yaml {% srNumber=8 %}
      run_filter_days: 7
```

{% partial file="/v1.10/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.10/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.10/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.10/connectors/yaml/ingestion-cli.md" /%}
