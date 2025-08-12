---
title: Run the Alation Sink Connector Externally
description: Use YAML to configure AlationSink metadata ingestion and push terms to Alation catalogs.
slug: /connectors/metadata/alationsink/yaml
---

{% connectorDetailsHeader
name="AlationSink"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the Alation Sink connector.

Configure and schedule Alation Sink metadata using the yaml:

- [Requirements](#requirements)
- [Data Mapping and Assumptions](#data-mapping-and-assumptions)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.10/connectors/external-ingestion-deployment.md" /%}

## Requirements

The connector uses `POST` requests to write the data into Alation.
Hence, an user credentials or an access token with `Source Admin` or `Catalog Admin` or `Server Admin` permissions will be required.

Follow the link [here](https://developer.alation.com/dev/docs/authentication-into-alation-apis#create-via-ui) to create the access token.

## Data Mapping and Assumptions

Following entities are supported and will be mapped to the from OpenMetadata to the entities in Alation.

{% multiTablesWrapper %}

| Alation Entity               | OpenMetadata Entity          |
| :----------------------------| :--------------------------- |
| Data Source (OCF)            | Database                     |
| Schema                       | Schema                       |
| Table                        | Table                        |
| Columns                      | Columns                      |

{% /multiTablesWrapper %}

### Python Requirements

{% partial file="/v1.10/connectors/python-requirements.md" /%}

To run the Alation Sink ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[alationsink]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/alationSinkConnection.json)
you can find the structure to create a connection to Alation Sink.

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

**hostPort**: Host and port of the Alation service.

{% /codeInfo %}

{% codeInfo srNumber=13 %}
**authType**:

Following authentication types are supported:
1. Basic Authentication: We'll use the user credentials to generate the access token required to authenticate Alation APIs.
- username: Username of the user.
- password: Password of the user.

2. Access Token Authentication: The access token created using the steps mentioned [here](https://developer.alation.com/dev/docs/authentication-into-alation-apis#create-via-ui) can directly be entered. We'll use that directly to authenticate the Alation APIs
- accessToken: Generated access token

{% /codeInfo %}

{% codeInfo srNumber=14 %}

**projectName**: Project name to create the refreshToken. Can be anything.

{% /codeInfo %}

{% codeInfo srNumber=16 %}

**paginationLimit**: Pagination limit used for Alation APIs pagination

{% /codeInfo %}

{% codeInfo srNumber=17 %}

**datasourceLinks**: Add a custom mapping between OpenMetadata databases and Alation DataSources.
If this mapping is present the connector will only look for the datasource in Alation to create other entities inside it. It will not create the datasource in Alation and it'll need to be created beforehand.

The mapping needs to be of the format `alation_datasource_id: openmetadata_database_fqn`
Here `alation_datasource_id` corresponds to the numerical id of the datasource in alation.
And `openmetadata_database_fqn` corresponds to the fullyQualifiedName of the database in OpenMetadata.

Below is an example of the mapping:
```yaml
datasourceLinks: {
    "23": "sample_data.ecommerce_db",
    "15": "mysql_prod.customers_db",
}
```

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=18 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.10/connectors/yaml/workflow-config-def.md" /%}
{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: AlationSink
  serviceName: local_alation_sink
  serviceConnection:
    config:
      type: AlationSink
```
```yaml {% srNumber=12 %}
      hostPort: https://alation.example.com
```
```yaml {% srNumber=13 %}
      # Select one authentication type from below
      # For Basic Authentication
      authType:
        username: user_name
        password: password
      # # For Access Token Authentication
      # authType:
      #   accessToken: access_token
```
```yaml {% srNumber=14 %}
      projectName: Test
```
```yaml {% srNumber=15 %}
      paginationLimit: 10
```
```yaml {% srNumber=16 %}
      # datasourceLinks: {
      #   "23": "om_service_name.om_db_name",
      #   "24": "om_service_name_two.om_db_name_two",
      # }
```
```yaml {% srNumber=17 %}
  sourceConfig:
    config:
      type: DatabaseMetadata
```
```yaml {% srNumber=18 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.10/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.10/connectors/yaml/ingestion-cli.md" /%}
