---
title: Alation
slug: /connectors/metadata/alation
---

{% connectorDetailsHeader
name="Alation"
stage="PROD"
platform="Collate"
availableFeatures=[]
unavailableFeatures=[]
/ %}

The Alation connector is supported to run only externally and not via OpenMetadata UI.
Check the following docs to run the Ingestion Framework in any orchestrator externally.

{% tilesContainer %}
{% tile
    title="Run Connectors from the OpenMetadata UI"
    description="Learn how to manage your deployment to run connectors from the UI"
    link="/deployment/ingestion/openmetadata"
  / %}
{% tile
    title="Run the Connector Externally"
    description="Get the YAML to run the ingestion externally"
    link="/connectors/metadata/alation/yaml"
  / %}
{% tile
    title="External Schedulers"
    description="Get more information about running the Ingestion Framework Externally"
    link="/deployment/ingestion"
  / %}
{% /tilesContainer %}

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
- Utilize the databaseFilterPattern (datasource in Alation), schemaFilterPattern, and tableFilterPattern to apply filters to Alation entities. Provide the `ids` of the datasource, schemas, and tables for the Alation entities in the respective fields.


