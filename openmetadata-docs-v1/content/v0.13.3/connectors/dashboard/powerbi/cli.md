---
title: Run PowerBI Connector using the CLI
slug: /connectors/dashboard/powerbi/cli
---

# Run PowerBI using the metadata CLI

| Stage      | PROD                         |
|------------|------------------------------|
| Dashboards | {% icon iconName="check" /%} |
| Charts     | {% icon iconName="check" /%} |
| Owners     | {% icon iconName="cross" /%} |
| Tags       | {% icon iconName="cross" /%} |
| Lineage    | {% icon iconName="check" /%} |

In this section, we provide guides and references to use the PowerBI connector.

Configure and schedule PowerBI metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

### Python Requirements

To run the PowerBI ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[powerbi]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/powerBIConnection.json)
you can find the structure to create a connection to PowerBI.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)


### 1. Define the YAML Config

This is a sample config for PowerBI:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**clientId**: PowerBI Client ID.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**clientSecret**: PowerBI Client Secret.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**tenantId**: PowerBI Tenant ID.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**scope**: Service scope. By default `["https://analysis.windows.net/powerbi/api/.default"]`.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**authorityUri**: Authority URI for the service.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**hostPort**: URL to the PowerBI instance.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**Pagination Entity Per Page**: Entity Limit set here will be used to paginate the PowerBi APIs. PowerBi API do not allow more than 100 workspaces to be inputed at a time. This field sets the limit of entities used for paginating the powerbi APIs. By default 100

{% /codeInfo %}

#### Source Configuration - Source Config

{% codeInfo srNumber=8 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/dashboardServiceMetadataPipeline.json):

**dbServiceNames**: Database Service Name for the creation of lineage, if the source supports it.
**dashboardFilterPattern**, **chartFilterPattern**: Note that the they support regex as include or exclude. E.g.,
**includeTags**: Set the Include tags toggle to control whether or not to include tags as part of metadata ingestion.
**markDeletedDashboards**: Set the Mark Deleted Dashboards toggle to flag dashboards as soft-deleted if they are not present anymore in the source system.


{% /codeInfo %}


#### Sink Configuration

{% codeInfo srNumber=9 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

#### Workflow Configuration

{% codeInfo srNumber=10 %}

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: powerbi
  serviceName: local_powerbi
  serviceConnection:
    config:
      type: PowerBI
```
```yaml {% srNumber=1 %}
      clientId: clientId
```
```yaml {% srNumber=2 %}
      clientSecret: secret
```
```yaml {% srNumber=3 %}
      tenantId: tenant
```
```yaml {% srNumber=4 %}
      # scope:
      #    - https://analysis.windows.net/powerbi/api/.default (default)
```
```yaml {% srNumber=5 %}
      # authorityURI: https://login.microsoftonline.com/ (default)
```
```yaml {% srNumber=6 %}
      # hostPort: https://analysis.windows.net/powerbi (default)
```
```yaml {% srNumber=7 %}
      # pagination_entity_per_page: 100 (default)
```
```yaml {% srNumber=8 %}
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
```yaml {% srNumber=9 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=10 %}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

{% /codeBlock %}

{% /codePreview %}

### Workflow Configs for Security Provider

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).

## Openmetadata JWT Auth

- JWT tokens will allow your clients to authenticate against the OpenMetadata server. To enable JWT Tokens, you will get more details [here](/deployment/security/enable-jwt-tokens).

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

- You can refer to the JWT Troubleshooting section [link](/deployment/security/jwt-troubleshooting) for any issues in your JWT configuration. If you need information on configuring the ingestion with other security providers in your bots, you can follow this doc [link](/deployment/security/workflow-config-auth).

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```bash
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration,
you will be able to extract metadata from different sources.
