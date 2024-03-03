---
title: Run the SAS Connector Externally
slug: /connectors/database/sas/yaml
---

{% connectorDetailsHeader
name="SAS"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Stored Procedures", "Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the SAS connector.

Configure and schedule SAS metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)


{% partial file="/v1.2/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 1.3.0 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}


### Python Requirements

To run the SAS ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[sas]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/sasConnection.json)
you can find the structure to create a connection to SAS.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=12 %}

**serverHost**: Host and port of the SAS Viya deployment.

{% /codeInfo %}

{% codeInfo srNumber=13 %}

**username**: Username to connect to SAS Viya. This user should have privileges to read all the metadata in SAS Information Catalog.

{% /codeInfo %}

{% codeInfo srNumber=14 %}

**password**: Password to connect to SAS Viya.

{% /codeInfo %}

{% codeInfo srNumber=15 %}

**filter**: A filter expression specifying items for import. For more information [see](https://developer.sas.com/apis/rest/DataManagement/#catalog-search)

{% /codeInfo %}


#### Sink Configuration

{% codeInfo srNumber=18 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.2/connectors/yaml/workflow-config-def.md" /%}
{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: SAS
  serviceName: local_sas
  serviceConnection:
    config:
      type: SAS
```
```yaml {% srNumber=12 %}
      serverHost: http://localhost:10000
```
```yaml {% srNumber=13 %}
      username: username
```
```yaml {% srNumber=14 %}
      password: password
```
```yaml {% srNumber=15 %}
      datatables: True
      dataTablesCustomFilter: None
      reports: False
      reportsCustomFilter: None
      dataflows: False
      dataflowsCustomFilter: None
```
```yaml
  sourceConfig:
    config:
      type: DatabaseMetadata
```
```yaml {% srNumber=18 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.2/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.2/connectors/yaml/ingestion-cli.md" /%}
