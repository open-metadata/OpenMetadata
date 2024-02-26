---
title: Run the Alation Connector Externally
slug: /connectors/metadata/alation/yaml
---

{% connectorDetailsHeader
name="Alation"
stage="PROD"
platform="Collate"
availableFeatures=[]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the Alation connector.

Configure and schedule Alation metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)


{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

Follow the official documentation to generate a API Access Token from [here](https://developer.alation.com/dev/docs/authentication-into-alation-apis)

## Data Mapping and Assumptions

Following entities are supported and will be mapped to the OpenMetadata entities as shown below.

{% multiTablesWrapper %}

| Alation Entity               | OpenMetadata Entity          |
| :----------------------------| :--------------------------- |
| Data Source (OCF and Native) | Database Service             |
| Data Source (OCF and Native) | Database                     |
| Schema                       | Schema                       |
| Table                        | Table                        |
| Columns                      | Columns                      |
| Custom Fields                | Custom Properties            |
| Tags                         | Tags                         |

{% /multiTablesWrapper %}

- Since Alation does not have a concept of Service entity, the Data Sources (OCF and Native) will be mapped to Database Service and Database in OpenMetadata. Hence for each Data Source in Alation there will one Database Service and Database present in OpenMetadata.
- Custom fields will have a 1:1 mapping for all the entities except for Columns since OpenMetadata does not support custom properties for columns.
- Alation has two fields for descriptions i.e. `descriptions` and `comments`. These fields will be combined under one field `description` in OpenMetadata for all the entities.


### Python Requirements

To run the Alation ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[alation]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/alationConnection.json)
you can find the structure to create a connection to Alation.

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

**hostPort**: Host and port of the Alation instance.

{% /codeInfo %}

{% codeInfo srNumber=13 %}

**authType**: Following authentication types are supported:
1. Basic Authentication:
We'll use the user credentials to generate the access token required to authenticate Alation APIs
- username: Username of the user.
- password: Password of the user.

2. Access Token Authentication:
The access token created using the steps mentioned [here](https://developer.alation.com/dev/docs/authentication-into-alation-apis#create-via-ui) can directly be entered. We'll use that directly to authenticate the Alation APIs
- accessToken: Generated access token

{% /codeInfo %}

{% codeInfo srNumber=14 %}

**projectName**: Project Name can be anything. e.g Prod or Demo. It will be used while creating the tokens.

{% /codeInfo %}

{% codeInfo srNumber=15 %}

**paginationLimit**: Pagination limit used for Alation APIs pagination. By default is set to 10.

{% /codeInfo %}

{% codeInfo srNumber=16 %}

**includeUndeployedDatasources**: Specifies if undeployed datasources should be included while ingesting. By default is set to `false`.

{% /codeInfo %}

{% codeInfo srNumber=17 %}

**includeHiddenDatasources**: Specifies if hidden datasources should be included while ingesting. By default is set to `false`.

{% /codeInfo %}

{% codeInfo srNumber=18 %}

**alationTagClassificationName**: Specify the classification name under which the tags from alation will be created in OpenMetadata. By default it is set to `alationTags`.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=20 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}
{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: Alation
  serviceName: local_alation
  serviceConnection:
    config:
      type: Alation
```
```yaml {% srNumber=12 %}
      hostPort: http://localhost:21000
```
```yaml {% srNumber=13 %}
      # Select one authentication type from below
      # For Basic Authentication
      authType:
        username: username
        password: password
      # # For Access Token Authentication
      # authType:
      #   accessToken: api_access_token
```
```yaml {% srNumber=14 %}
      projectName: Test
```
```yaml {% srNumber=15 %}
      paginationLimit: 10
```
```yaml {% srNumber=16 %}
      includeUndeployedDatasources: false # true or false
```
```yaml {% srNumber=17 %}
      includeHiddenDatasources: false # true or false
```
```yaml {% srNumber=18 %}
      alationTagClassificationName: alationTags
```
```yaml {% srNumber=19 %}
  sourceConfig:
    config:
      type: DatabaseMetadata
      # databaseFilterPattern:
      #   includes:
      #     - database_id_1
      #     - database_id_2
      #   excludes:
      #     - database_id_3
      #     - database_id_4
      # schemaFilterPattern:
      #   includes:
      #     - schema_id_1
      #     - schema_id_2
      #   excludes:
      #     - schema_id_3
      #     - schema_id_4
      # tableFilterPattern:
      #   includes:
      #     - table_id_1
      #     - table_id_2
      #   excludes:
      #     - table_id_3
      #     - table_id_4
```
```yaml {% srNumber=20 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
