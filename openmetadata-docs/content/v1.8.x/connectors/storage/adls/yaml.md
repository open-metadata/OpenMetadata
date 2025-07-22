---
title: Run the ADLS Connector Externally
description: Use YAML to ingest metadata from Azure Data Lake Storage including file paths, structures, and governance rules.
slug: /connectors/storage/adls/yaml
collate: true
---

{% connectorDetailsHeader
name="ADLS"
stage="PROD"
platform="Collate"
availableFeatures=["Metadata"]
unavailableFeatures=[]
/ %}

This page contains the setup guide and reference information for the Azure connector.

Configure and schedule Azure metadata workflows from the CLI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 1.0 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To run the metadata ingestion, we need the following permissions in ADLS:

### ADLS Permissions

To extract metadata from Azure ADLS (Storage Account - StorageV2), you will need an **App Registration** with the following permissions on the Storage Account:
- Storage Blob Data Contributor
- Storage Queue Data Contributor

### OpenMetadata Manifest

In any other connector, extracting metadata happens automatically. In this case, we will be able to extract high-level
metadata from buckets, but in order to understand their internal structure we need users to provide an `openmetadata.json`
file at the bucket root.

`Supported File Formats: [ "csv",  "tsv", "avro", "parquet", "json", "json.gz", "json.zip" ]`

You can learn more about this [here](/connectors/storage). Keep reading for an example on the shape of the manifest file.

{% partial file="/v1.8/connectors/storage/manifest.md" /%}

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/storage/adlsConnection.json)
you can find the structure to create a connection to Athena.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Athena:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% partial file="/v1.8/connectors/yaml/common/azure-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/storage/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=6 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to storage service during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to storage service during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: ADLS
  serviceName: local_adls
  serviceConnection:
    config:
      type: ADLS
      credentials:
```

{% partial file="/v1.8/connectors/yaml/common/azure-config.md" /%}

```yaml {% srNumber=6 %}
      # connectionOptions:
        # key: value
```
```yaml {% srNumber=7 %}
      # connectionArguments:
        # key: value
```

{% partial file="/v1.8/connectors/yaml/storage/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}



{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}

## Related

{% tilesContainer %}

{% tile
   icon="mediation"
   title="Configure Ingestion Externally"
   description="Deploy, configure, and manage the ingestion workflows externally."
   link="/deployment/ingestion"
 / %}

{% /tilesContainer %}
