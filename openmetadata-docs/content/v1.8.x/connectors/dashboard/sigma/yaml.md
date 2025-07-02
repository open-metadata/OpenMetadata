---
title: Run the Sigma Connector Externally
description: Configure Sigma dashboard connector for OpenMetadata using YAML. Step-by-step setup guide with examples to integrate your Sigma analytics platform.
slug: /connectors/dashboard/sigma/yaml
---

{% connectorDetailsHeader
name="Sigma"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Dashboards", "Charts", "Lineage", "Owners"]
unavailableFeatures=["Tags", "Datamodels", "Projects"]
/ %}

In this section, we provide guides and references to use the Sigma connector.

Configure and schedule Sigma metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

OpenMetadata relies on Sigma's REST API. To know more you can read the [Sigma API Get Started docs](https://help.sigmacomputing.com/reference/get-started-sigma-api#about-the-api). To [generate API client credentials](https://help.sigmacomputing.com/reference/generate-client-credentials#user-requirements), you must be assigned the Admin account type.


## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/sigmaConnection.json)
you can find the structure to create a connection to Mode.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Sigma:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**:  Host and Port Sigma REST API.

The hostPort parameter specifies the host and port of the Sigma's API request URL. This should be specified as a string in the format `https://aws-api.sigmacomputing.com`. Sigma's API request URL varies according to the sigma cloud. you can determine your API url by following the docs [here](https://help.sigmacomputing.com/reference/get-started-sigma-api#identify-your-api-request-url)

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**clientId**: Client Id for Sigma REST API.
Get the Client Id and client Secret by following below steps:
- Navigate to your Sigma homepage.
- Click on Administration in the lower left corner.
- Click on Developer Access on the left side.
- To generate a new Client Id and client Secret, On upper left corner click `Create New`.
- Enter the required details asked and click `Create`.
- Copy the generated access token and password.

For detailed information visit [here](https://help.sigmacomputing.com/reference/generate-client-credentials#generate-api-client-credentials).

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**clientSecret**: Client Secret for Sigma REST API.
Copy the access token password from the step above where a new token is generated.

For detailed information visit [here](https://help.sigmacomputing.com/reference/generate-client-credentials#generate-api-client-credentials).

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**apiVersion**: Sigma REST API Version.
Version of the Sigma REST API by default `v2`.

To get to know the Sigma REST API Version visit [here](https://help.sigmacomputing.com/reference/get-started-sigma-api#identify-your-api-request-url) and look into the `Token URL` section.

{% /codeInfo %}

{% partial file="/v1.8/connectors/yaml/dashboard/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: sigma
  serviceName: local_sigma
  serviceConnection:
    config:
      type: Sigma
```
```yaml {% srNumber=1 %}
      hostPort: https://api.sigmacomputing.com
```
```yaml {% srNumber=2 %}
      clientId: client_id
```
```yaml {% srNumber=3 %}
      clientSecret: client_secret
```
```yaml {% srNumber=4 %}
      apiVersion: v2
```

{% partial file="/v1.8/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}

