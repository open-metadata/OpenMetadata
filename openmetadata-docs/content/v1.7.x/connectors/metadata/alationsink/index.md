---
title: Alation Sink | OpenMetadataMetadata Integration
description: Connect Alation to OpenMetadataseamlessly with our AlationSink connector. Complete setup guide, configuration steps, and metadata sync instructions.
slug: /connectors/metadata/alationsink
---

{% connectorDetailsHeader
name="AlationSink"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=[]
/ %}

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/metadata/alationsink/yaml"} /%}

{% note %}
The connector will ingest data from OpenMetadata into Alation.
{% /note %}

Configure and schedule Alation Sink metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Data Mapping and Assumptions](#data-mapping-and-assumptions)
- [Metadata Ingestion](#metadata-ingestion)
- [Troubleshooting](/connectors/metadata/alationsink/troubleshooting)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

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

## Metadata Ingestion

Then, prepare the Alation Sink Service and configure the Ingestion:

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md"
  variables={
    connector: "AlationSink", 
    selectServicePath: "/images/v1.7/connectors/alationsink/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/alationsink/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/alationsink/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: Host and port of the Alation service.
- **Authentication Types**:
    1. Basic Authentication
    - Username: The name of the user whose credentials will be used to sign in.
    - Password: The password of the user.
    2. Access Token Authentication
    The access token created using the steps mentioned [here](https://developer.alation.com/dev/docs/authentication-into-alation-apis#create-via-ui) can directly be entered. We'll use that directly to authenticate the Alation APIs
    - accessToken: Generated access token
- **Project Name**: Project name to create the refreshToken. Can be anything.
- **Pagination Limit**: Pagination limit used for Alation APIs pagination
- **DataSource Links**: Add a custom mapping between OpenMetadata databases and Alation DataSources.
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

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/metadata/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
