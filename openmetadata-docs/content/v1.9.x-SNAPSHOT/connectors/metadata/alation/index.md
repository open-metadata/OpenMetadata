---
title: Alation
slug: /connectors/metadata/alation
collate: true
---

{% connectorDetailsHeader
name="Alation"
stage="PROD"
platform="Collate"
availableFeatures=["Metadata"]
unavailableFeatures=[]
/ %}


In this section, we provide guides and references to use the Alation connector.

Configure and schedule Alation metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Data Mapping and Assumptions](#data-mapping-and-assumptions)
- [Metadata Ingestion](#metadata-ingestion)
- [Troubleshooting](/connectors/metadata/alation/troubleshooting)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/metadata/alation/yaml"} /%}

{% partial file="/v1.9/connectors/external-ingestion-deployment.md" /%}

## Requirements

Follow the official documentation to generate a API Access Token from [here](https://developer.alation.com/dev/docs/authentication-into-alation-apis#create-an-api-access-token)

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
| BI Servers                   | Dashboard Services           |
| Dashboard DataSource         | Dashboard DataModel          |
| Folder                       | Dashboard                    |
| Report                       | Chart                        |
| Users/Groups                 | Users/Teams                  |
| Domains/Subdomains           | Domains/Subdomains           |
| Knowledge Articles           | Knowledge Center Articles    |

{% /multiTablesWrapper %}

- Since Alation does not have a concept of Service entity, the Data Sources (OCF and Native) will be mapped to Database Service and Database in OpenMetadata. Hence for each Data Source in Alation there will one Database Service and Database present in OpenMetadata.
- Custom fields will have a 1:1 mapping for all the entities except for Columns since OpenMetadata does not support custom properties for columns.
- Alation has two fields for descriptions i.e. `descriptions` and `comments`. These fields will be combined under one field `description` in OpenMetadata for all the entities.
- Utilize the databaseFilterPattern (datasource in Alation), schemaFilterPattern, and tableFilterPattern to apply filters to Alation entities. Provide the `ids` of the datasource, schemas, and tables for the Alation entities in the respective fields.

## Metadata Ingestion

{% partial
  file="/v1.9/connectors/metadata-ingestion-ui.md"
  variables={
    connector: "Alation",
    selectServicePath: "/images/v1.9/connectors/alation/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/alation/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/alation/service-connection.png",
  }
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

**hostPort**: Host and port of the Alation instance.

**authType**: Following authentication types are supported:
1. **Basic Authentication**:
We'll use the user credentials to generate the access token required to authenticate Alation APIs
- **username**: Username of the user.
- **password**: Password of the user.

2. **Access Token Authentication**:
The access token created using the steps mentioned [here](https://developer.alation.com/dev/docs/authentication-into-alation-apis#create-an-api-access-token) can directly be entered. We'll use that directly to authenticate the Alation APIs
- **accessToken**: Generated access token

#### For Alation backend database Connection:

Alation APIs do not provide us with some of the metadata. This metadata we extract directly from the alation's backend database by query the tables directly.
Note that this is a optional config and if it is not provided primary metadata will still be ingested.
Below is the metadata fetched from alation database:
`1. User and Group Relationships`

Choose either postgres or mysql connection depending on the db:
1. Postgres Connection
- **username**: Specify the User to connect to Postgres. Make sure the user has select privileges on the tables of the alation schema.
**password**: Password to connect to Postgres.
**hostPort**: Enter the fully qualified hostname and port number for your Postgres deployment in the Host and Port field.
- **database**: Initial Postgres database to connect to. Specify the name of database associated with Alation instance.

1. MySQL Connection
- **username**: Specify the User to connect to MySQL. Make sure the user has select privileges on the tables of the alation schema.
**password**: Password to connect to MySQL.
**hostPort**: Enter the fully qualified hostname and port number for your MySQL deployment in the Host and Port field.
- **databaseSchema**: Initial MySQL database to connect to. Specify the name of database schema associated with Alation instance.

**projectName**: Project Name can be anything. e.g Prod or Demo. It will be used while creating the tokens.

**paginationLimit**: Pagination limit used for Alation APIs pagination. By default is set to 10.

**includeUndeployedDatasources**: Specifies if undeployed datasources should be included while ingesting. By default is set to `false`.

**includeHiddenDatasources**: Specifies if hidden datasources should be included while ingesting. By default is set to `false`.

**ingestUsersAndGroups**: Specifies if users and groups should be included while ingesting. By default is set to `true`.

**ingestKnowledgeArticles**: Specifies if knowledge articles should be included while ingesting. By default is set to `true`.

**ingestDatasources**: Specifies if databases, schemas and tables should be included while ingesting. By default is set to `true`.

**ingestDomains**: Specifies if domains and subdomains should be included while ingesting. By default is set to `true`.

**ingestDashboards**: Specifies if BI sources and dashboards should be included while ingesting. By default is set to `true`.

**alationTagClassificationName**: Specify the classification name under which the tags from alation will be created in OpenMetadata. By default it is set to `alationTags`.

**connectionArguments**: These are additional parameters for Alation. If not specified the ingestion will use the predefined pagination logic.
The following arguments are intended to be used in conjunction and are specifically for Alation DataSource APIs:
- skip: This parameter determines the count of records to bypass at the start of the dataset. When set to 0, as in this case, it means that no records will be bypassed. If set to 10, it will bypass the first 10 records.

- limit: This argument specifies the maximum number of records to return. Here, it's set to 10, meaning only the first 10 records will be returned.

To perform incremental ingestion, these arguments should be used together. For instance, if there are a total of 30 datasources in Alation, the ingestion can be configured to execute three times, with each execution ingesting 10 datasources. 
- 1st execution: {"skip": 0, "limit": 10}
- 2nd execution: {"skip": 10, "limit": 10}
- 3rd execution: {"skip": 20, "limit": 10}


{% partial file="/v1.9/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/metadata/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
