---
title: Run the Nifi Connector Externally
slug: /connectors/pipeline/nifi/yaml
---

{% connectorDetailsHeader
name="Nifi"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines"]
unavailableFeatures=["Pipeline Status", "Owners", "Tags", "Lineage"]
/ %}

In this section, we provide guides and references to use the Nifi connector.

Configure and schedule Nifi metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

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


{% partial file="/v1.3/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

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

{% partial file="/v1.3/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}


{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
