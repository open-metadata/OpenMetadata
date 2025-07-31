---
title: Run the Epic FHIR Connector Externally
description: Configure Epic FHIR ingestion using YAML to automate FHIR resource metadata collection.
slug: /connectors/database/epic/yaml
Collate: true
---

{% connectorDetailsHeader
name="Epic FHIR"
stage="BETA"
platform="Collate"
availableFeatures=["Metadata"]
unavailableFeatures=["Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Query Usage", "Owners", "Tags", "Sample Data", "Reverse Metadata (Collate Only)", "Auto-Classification", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Epic FHIR connector.

Configure and schedule Epic metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/epic/yaml"} /%}

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

To run the Epic ingestion, install the Python package:

```bash
pip3 install "openmetadata-ingestion[epic]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.  
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/epicConnection.json) you can find the structure to create a connection to Epic.

The ingestion workflow itself follows the general [workflow schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Define the YAML Config

This is a minimal sample config for Epic:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**fhirServerUrl**: Base URL of the Epic FHIR server.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**fhirVersion**: FHIR specification version supported (`R4`, `STU3`, or `DSTU2`).

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**databaseName**: Optional name for the database in OpenMetadata. Defaults to `epic`.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**schemaFilterPattern / tableFilterPattern**: Regex filters to limit which FHIR resource categories (schemas) or resource types (tables) are ingested.

{% /codeInfo %}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="epic_sample.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: epic
  serviceName: epic_fhir
  serviceConnection:
    config:
      type: Epic
      fhirServerUrl: https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
      fhirVersion: R4
      # Optional:
      # databaseName: epic
```
```yaml {% srNumber=1 %}
# Optional filters
sourceConfig:
  config:
    # schemaFilterPattern:
    #   includes:
    #     - Clinical
    #   excludes:
    #     - Archived
    # tableFilterPattern:
    #   includes:
    #     - Patient
    #   excludes:
    #     - ".*Test.*"
```
```yaml {% srNumber=2 %}
sink:
  type: metadata-rest
  config: {}
```

{% /codeBlock %}

{% /codePreview %} 