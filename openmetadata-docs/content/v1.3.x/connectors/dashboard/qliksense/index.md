---
title: Qlik Sense
slug: /connectors/dashboard/qliksense
---

{% connectorDetailsHeader
  name="Qlik Sense"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Datamodels", "Lineage"]
  unavailableFeatures=["Owners", "Tags", "Projects"]
/ %}

In this section, we provide guides and references to use the Qlik Sense connector.

Configure and schedule Metabase metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/qliksense/yaml"} /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 1.1.1 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "QlikSense", 
    selectServicePath: "/images/v1.3/connectors/qliksense/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/qliksense/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/qliksense/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Qlik Sense Base URL**: This field refers to the base url of your Qlik Sense Portal, will be used for generating the redirect links for dashboards and charts. Example: `https://server.domain.com` or `https://server.domain.com/<proxy-path>`
- **Qlik Engine JSON API Websocket URL**: Enter the websocket url of Qlik Sense Engine JSON API. Refer to [this](https://help.qlik.com/en-US/sense-developer/May2023/Subsystems/EngineAPI/Content/Sense_EngineAPI/GettingStarted/connecting-to-engine-api.htm) document for more details about. Example: `wss://server.domain.com:4747` or `wss://server.domain.com[/virtual proxy]`.

Since we use the Qlik Sense Engine APIs, we need to authenticate to those APIs using certificates generated on Qlik Management Console.

**Qlik Certificate By Values**: In this approach we provide the content of the certificates to the relevant field.
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

**Qlik Certificate By Path**: In this approach we provide the path of the certificates to the certificate stored in the container or environment running the ingestion workflow.
 - **Client Certificate Path**: This field specifies the path of `client.pem` certificate required for authentication. 
 - **Client Key Certificate Value**: This field specifies the path of `client_key.pem` certificate required for authentication. 
 - **Root Certificate Value**: This field specifies the path of `root.pem` certificate required for authentication. 

**User Directory**: This field specifies the user directory of the user.

**User ID**: This field specifies the user id of the user.

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
