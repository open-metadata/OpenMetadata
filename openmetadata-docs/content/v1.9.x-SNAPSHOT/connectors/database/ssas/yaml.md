---
title: Run the SSAS Connector Externally
slug: /connectors/database/ssas/yaml
---

{% connectorDetailsHeader
name="SSAS"
stage="BETA"
platform="Collate"
availableFeatures=["Metadata", "Lineage"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the SSAS connector.

Configure and schedule SSAS metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the SSAS ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[ssas]"
```


## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/ssasConnection.json)
you can find the structure to create a connection to SSAS.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for SSAS:


{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**httpConnection**: HTTP Link for SSAS ACCESS. Provide the HTTP endpoint used to access your SSAS instance.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**username**: Username to connect to SSAS. This user should have sufficient privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**password**: Password to connect to SSAS.

{% /codeInfo %}


{% partial file="/v1.8/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: ssas
  serviceName: local_ssas
  serviceConnection:
    config:
      type: SSAS
      httpConnection: http://xxx.xxx.x.xx/test/msmdpump.dll
      username: username
      password: password
```

{% partial file="/v1.8/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}
> **Note for SSAS Lineage:**  
> - The SSAS connector does **not** support view or query-based lineage extraction.  
> - Instead, it supports **cross-database lineage**.  
> - To enable cross-database lineage, you need to set the following options in your YAML under `sourceConfig.config`:
>   - `processCrossDatabaseLineage: true`
>   - `crossDatabaseServiceNames: [<list_of_other_database_service_names>]`
> 
> Example:
> 
> ```yaml
> sourceConfig:
>   config:
>     type: DatabaseLineage
>     processCrossDatabaseLineage: true
>     crossDatabaseServiceNames: [local_mssql]
> ```



{% partial file="/v1.8/connectors/yaml/lineage.md" variables={connector: "ssas"} /%}



You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).
