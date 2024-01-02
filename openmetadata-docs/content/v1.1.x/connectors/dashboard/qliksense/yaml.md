---
title: Run the Qlik Sense Connector Externally
slug: /connectors/dashboard/qliksense/yaml
---

# Run the PowerBI Connector Externally

| Stage      | PROD                         |
|------------|------------------------------|
| Dashboards | {% icon iconName="check" /%} |
| Charts     | {% icon iconName="check" /%} |
| Owners     | {% icon iconName="cross" /%} |
| Tags       | {% icon iconName="cross" /%} |
| Datamodels | {% icon iconName="check" /%} |
| Lineage    | {% icon iconName="check" /%} |

In this section, we provide guides and references to use the PowerBI connector.

Configure and schedule PowerBI metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.1/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

### Python Requirements

To run the PowerBI ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[qliksense]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/qlikSenseConnection.json)
you can find the structure to create a connection to QlikSense.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Qlik Sense:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: Qlik Engine JSON API Websocket URL

Enter the websocket url of Qlik Sense Engine JSON API. Refer to [this](https://help.qlik.com/en-US/sense-developer/May2023/Subsystems/EngineAPI/Content/Sense_EngineAPI/GettingStarted/connecting-to-engine-api.htm) document for more details about 

Example: `wss://server.domain.com:4747` or `wss://server.domain.com[/virtual proxy]`

**Note:** Notice that you have to provide the websocket url here which would begin with either `wss://` or `ws://`

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**displayUrl**: Qlik Sense Base URL

This field refers to the base url of your Qlik Sense Portal, will be used for generating the redirect links for dashboards and charts. 

Example: `https://server.domain.com` or `https://server.domain.com/<virtual-proxy-path>`

{% /codeInfo %}

{% codeInfo srNumber=3 %}

Since we use the Qlik Sense Engine APIs, we need to authenticate to those APIs using certificates generated on Qlik Management Console.

In this approach we provide the path of the certificates to the certificate stored in the container or environment running the ingestion workflow.

- **clientCertificate**: This field specifies the path of `client.pem` certificate required for authentication. 
- **clientKeyCertificate**: This field specifies the path of `client_key.pem` certificate required for authentication. 
- **rootCertificate**: This field specifies the path of `root.pem` certificate required for authentication. 

{% /codeInfo %}

{% codeInfo srNumber=4 %}

In this approach we provide the content of the certificates to the relevant field.

- **Client Certificate Value**: This field specifies the value of `client.pem` certificate required for authentication.
- **Client Key Certificate Value**: This field specifies the value of `client_key.pem` certificate required for authentication.
- **Root Certificate Value**: This field specifies the value of `root.pem` certificate required for authentication.
- **Staging Directory Path**: This field specifies the path to temporary staging directory, where the certificates will be stored temporarily during the ingestion process, which will de deleted once the ingestion job is over. 

when you are using this approach make sure you are passing the key in a correct format. If your certificate looks like this:

```
-----BEGIN CERTIFICATE-----
MII..
MBQ...
CgU..
8Lt..
...
h+4=
-----END CERTIFICATE-----
```

You will have to replace new lines with `\n` and the final private key that you need to pass should look like this:

```
-----BEGIN CERTIFICATE-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END CERTIFICATE-----\n
```


{% /codeInfo %}

{% codeInfo srNumber=5 %}

**userId**: This field specifies the user directory of the user.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**userDirectory**: This field specifies the user directory of the user.

{% /codeInfo %}

#### Source Configuration - Source Config

{% codeInfo srNumber=9 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/dashboardServiceMetadataPipeline.json):

- **dbServiceNames**: Database Service Names for ingesting lineage if the source supports it.
- **dashboardFilterPattern**, **chartFilterPattern**, **dataModelFilterPattern**: Note that all of them support regex as include or exclude. E.g., "My dashboard, My dash.*, .*Dashboard".
- **includeOwners**: Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten.
- **includeTags**: Set the 'Include Tags' toggle to control whether to include tags in metadata ingestion.
- **includeDataModels**: Set the 'Include Data Models' toggle to control whether to include tags as part of metadata ingestion.
- **markDeletedDashboards**: Set the 'Mark Deleted Dashboards' toggle to flag dashboards as soft-deleted if they are not present anymore in the source system.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=10 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.1/connectors/workflow-config.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: qliksense
  serviceName: local_qliksense
  serviceConnection:
    config:
      type: QlikSense
```
```yaml {% srNumber=1 %}
      hostPort: wss://localhost:4747
```
```yaml {% srNumber=2 %}
      displayUrl: https://localhost
```
```yaml {% srNumber=3 %}
      certificates:
        # pass certificate paths
        clientCertificate: /path/to/client.pem
        clientKeyCertificate: /path/to/client_key.pem
        rootCertificate: /path/to/root.pem
```
```yaml {% srNumber=4 %}
        # pass certificate values
        # clientCertificateData: -----BEGIN CERTIFICATE-----\n....\n.....\n-----END CERTIFICATE-----\n
        # clientKeyCertificateData: -----BEGIN RSA PRIVATE KEY-----\n....\n....\n-----END RSA PRIVATE KEY-----\n
        # rootCertificateData: -----BEGIN CERTIFICATE-----\n....\n...-----END CERTIFICATE-----\n
        # stagingDir: /tmp/stage
```
```yaml {% srNumber=5 %}
      userId: user_id
```
```yaml {% srNumber=6 %}
      userDirectory: user_dir
```
```yaml {% srNumber=7 %}
  sourceConfig:
    config:
      type: DashboardMetadata
      # dbServiceNames:
      #   - service1
      #   - service2
      # dashboardFilterPattern:
      #   includes:
      #     - dashboard1
      #     - dashboard2
      #   excludes:
      #     - dashboard3
      #     - dashboard4
      # chartFilterPattern:
      #   includes:
      #     - chart1
      #     - chart2
      #   excludes:
      #     - chart3
      #     - chart4
```
```yaml {% srNumber=8 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.1/connectors/workflow-config-yaml.md" /%}

{% /codeBlock %}

{% /codePreview %}

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```bash
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration,
you will be able to extract metadata from different sources.
