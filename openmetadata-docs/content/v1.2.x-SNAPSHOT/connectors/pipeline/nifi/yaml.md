---
title: Run the Nifi Connector Externally
slug: /connectors/pipeline/nifi/yaml
---

# Run the Nifi Connector Externally

In this section, we provide guides and references to use the Nifi connector.

Configure and schedule Nifi metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.2/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{% /inlineCallout %}



### Python Requirements

To run the Nifi ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[nifi]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/nifiConnection.json)
you can find the structure to create a connection to Nifi.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Nifi:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: Pipeline Service Management UI URL
**nifiConfig**: one of
  **1.** Using Basic authentication  
    - **username**: Username to connect to Nifi. This user should be able to send request to the Nifi API and access the `Resources` endpoint.
    - **password**: Password to connect to Nifi.
    - **verifySSL**: Whether SSL verification should be perform when authenticating.
  **2.** Using client certificate authentication
    - **certificateAuthorityPath**: Path to the certificate authority (CA) file. This is the certificate used to store and issue your digital certificate. This is an optional parameter. If omitted SSL verification will be skipped; this can present some sever security issue.
    **important**: This file should be accessible from where the ingestion workflow is running. For example, if you are using OpenMetadata Ingestion Docker container, this file should be in this container.
    - **clientCertificatePath**: Path to the certificate client file.
    **important**: This file should be accessible from where the ingestion workflow is running. For example, if you are using OpenMetadata Ingestion Docker container, this file should be in this container.
    - **clientkeyPath**: Path to the client key file.
    **important**: This file should be accessible from where the ingestion workflow is running. For example, if you are using OpenMetadata Ingestion Docker container, this file should be in this container.


{% /codeInfo %}


#### Source Configuration - Source Config

{% codeInfo srNumber=2 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/pipelineServiceMetadataPipeline.json):

**dbServiceNames**: Database Service Name for the creation of lineage, if the source supports it.

**includeTags**: Set the 'Include Tags' toggle to control whether to include tags as part of metadata ingestion.

**markDeletedPipelines**: Set the Mark Deleted Pipelines toggle to flag pipelines as soft-deleted if they are not present anymore in the source system.

**pipelineFilterPattern** and **chartFilterPattern**: Note that the `pipelineFilterPattern` and `chartFilterPattern` both support regex as include or exclude.

{% /codeInfo %}


#### Sink Configuration

{% codeInfo srNumber=3 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.2/connectors/workflow-config.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: nifi
  serviceName: nifi_source
  serviceConnection:
    config:
      type: Nifi
      hostPort: my_host:8433
      nifiConfig:
        username: my_username
        password: my_password
        verifySSL: <true or false>
        ## client certificate authentication
        # certificateAuthorityPath: path/to/CA
        # clientCertificatePath: path/to/clientCertificate
        # clientkeyPath: path/to/clientKey
```
```yaml {% srNumber=1 %}
      hostPort: http://localhost:8000
```
```yaml {% srNumber=2 %}
  sourceConfig:
    config:
      type: PipelineMetadata
      # markDeletedPipelines: True
      # includeTags: True
      # includeLineage: true
      # pipelineFilterPattern:
      #   includes:
      #     - pipeline1
      #     - pipeline2
      #   excludes:
      #     - pipeline3
      #     - pipeline4
```
```yaml {% srNumber=3 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.2/connectors/workflow-config-yaml.md" /%}

{% /codeBlock %}

{% /codePreview %}

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```bash
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration,
you will be able to extract metadata from different sources.
