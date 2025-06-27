---
title: Run the Alation Connector Externally
slug: /connectors/metadata/alation/yaml
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

Configure and schedule Alation metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)


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
The access token created using the steps mentioned [here](https://developer.alation.com/dev/docs/authentication-into-alation-apis#create-an-api-access-token) can directly be entered. We'll use that directly to authenticate the Alation APIs
- accessToken: Generated access token

{% /codeInfo %}

{% codeInfo srNumber=25 %}

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

{% codeInfo srNumber=26 %}

**ingestUsersAndGroups**: Specifies if users and groups should be included while ingesting. By default is set to `true`.

{% /codeInfo %}

{% codeInfo srNumber=27 %}

**ingestKnowledgeArticles**: Specifies if knowledge articles should be included while ingesting. By default is set to `true`.

{% /codeInfo %}

{% codeInfo srNumber=28 %}

**ingestDatasources**: Specifies if databases, schemas and tables should be included while ingesting. By default is set to `true`.

{% /codeInfo %}

{% codeInfo srNumber=29 %}

**ingestDomains**: Specifies if hidden domains and subdomains should be included while ingesting. By default is set to `true`.

{% /codeInfo %}

{% codeInfo srNumber=30 %}

**ingestDashboards**: Specifies if hidden BI sources and dashboards should be included while ingesting. By default is set to `true`.

{% /codeInfo %}

{% codeInfo srNumber=18 %}

**alationTagClassificationName**: Specify the classification name under which the tags from alation will be created in OpenMetadata. By default it is set to `alationTags`.

{% /codeInfo %}

{% codeInfo srNumber=21 %}

**connectionArguments**: These are additional parameters for Alation. If not specified the ingestion will use the predefined pagination logic.
The following arguments are intended to be used in conjunction and are specifically for Alation DataSource APIs:
- skip: This parameter determines the count of records to bypass at the start of the dataset. When set to 0, as in this case, it means that no records will be bypassed. If set to 10, it will bypass the first 10 records.

- limit: This argument specifies the maximum number of records to return. Here, it's set to 10, meaning only the first 10 records will be returned.

To perform incremental ingestion, these arguments should be used together. For instance, if there are a total of 30 datasources in Alation, the ingestion can be configured to execute three times, with each execution ingesting 10 datasources. 
- 1st execution: {"skip": 0, "limit": 10}
- 2nd execution: {"skip": 10, "limit": 10}
- 3rd execution: {"skip": 20, "limit": 10}
{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=20 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.9/connectors/yaml/workflow-config-def.md" /%}
{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
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
```yaml {% srNumber=25 %}
      connection:
        # For Postgres DB
        type: Postgres
        username: myuser
        authType:
          password: mypassword
        hostPort: localhost:5432
        database: postgres
      #   # For MySQL DB
      #   type: Mysql
      #   username: openmetadata_user
      #   authType:
      #     password: openmetadata_password
      #   hostPort: localhost:3306
      #   databaseSchema: openmetadata_db
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
```yaml {% srNumber=26 %}
      ingestUsersAndGroups: true # true or false
```
```yaml {% srNumber=27 %}
      ingestKnowledgeArticles: false # true or false
```
```yaml {% srNumber=28 %}
      ingestDatasources: false # true or false
```
```yaml {% srNumber=29 %}
      ingestDomains: false # true or false
```
```yaml {% srNumber=30 %}
      ingestDashboards: false # true or false
```
```yaml {% srNumber=18 %}
      alationTagClassificationName: alationTags
```
```yaml {% srNumber=21 %}
      connectionArguments: {
        "skip": 0,
        "limit": 10,
      }
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

{% partial file="/v1.9/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.9/connectors/yaml/ingestion-cli.md" /%}
