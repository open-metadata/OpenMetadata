---
title: Releases
slug: /overview/releases
---

# Releases

<Note>

The OpenMetadata community is on a monthly release cadence. At every 4-5 weeks we will be releasing a new
version. To see what's coming in next releases, please check our [Roadmap](/overview/roadmap) section.

</Note>

## Latest Release - 0.11.0 Release - June 30th 2022

### Data Collaboration - Tasks and Emojis

Data Collaboration has been the prime focus of the 0.11 Release, the groundwork for which has been laid in the past
several releases. In the 0.9 release, we introduced Activity Feeds, Conversation Threads, and the ability to request
descriptions. In this release, we’ve added Tasks, as an extension to the ability to create conversations and post
replies. We are particularly excited about the ability to suggest tasks. This brings the collaboration to the next level
where an organization can crowdsource the knowledge and continuously improve descriptions.

### Column Level Lineage [#2931](https://github.com/open-metadata/OpenMetadata/issues/2931)

In OpenMetadata, we primarily compute column-level lineage through SQL query analysis. Lineage information is
consolidated from various sources, such as ETL pipelines, DBT, query analysis, and so on. In the backend, we’ve added
column-level lineage API support. The UI now supports exploring this rich column-level lineage for understanding the
relationship between tables and performing impact analysis. While exploring the lineage, users can manually edit both
the table and column level lineage to capture any information that is not automatically surfaced.

### Custom Properties

The key goal of the OpenMetadata project is to define Open Metadata Standards to make metadata centralized, easily
shareable, and make tool interoperability easier. We take a schema-first approach for strongly typed metadata types and
entities modeled using JSON schema as follows:

OpenMetadata now supports adding new types and extending entities when organizations need to capture custom metadata.
New types and custom fields can be added to entities either using API or in OpenMetadata UI. This extensibility is based
on JSON schema and hence has all the benefits of strong typing, rich constraints, documentation, and automatic
validation similar to the core OpenMetadata schemas.

### Advanced Search 

Users can search by multiple parameters to narrow down the search results. Separate advanced search
options are available for Tables, Topics, Dashboards, Pipelines, and ML Models. All these entities are searchable by
common search options such as Owner, Tag, and Service.

### Glossary UI Updates

The Glossary UI has been upgraded. However, the existing glossary functionality remains the same, with the ability 
to add Glossary, Terms, Tags, Descriptions, Reviewers etc... 

On the UI, the arrangement displaying the Summary, Related Terms, Synonyms, and References has been
changed. The Reviewers are shown on the right panel with an option to add or remove existing reviewers. 

### Profiler and Data Quality Improvements 

Profiling data and communicating quality across the organization is core to OpenMetadata.
While numerous tools exist, they are often isolated and require users to navigate multiple interfaces. In OpenMetadata,
these tests and data profiles are displayed alongside your assets (tables, views) and allow you to get a 360-degree view
of your data.

### Great Expectations Integration

While OpenMetadata allows you to set up and run data quality tests directly from the UI, we understand certain
organizations already have their own data quality tool. That’s why we have developed a direct integration between Great
Expectations and OpenMetadata. Using our `openmetadata-ingestion[great-expectations]` python submodule, you can now add
custom actions to your Great Expectations checkpoints file that will automatically ingest your data quality test results
into OpenMetadata at the end of your checkpoint file run.

### ML Models

In this release, we are happy to share the addition of ML Model Entities to the UI. This will allow users to describe,
and share models and their features as any other data asset. The UI support also includes the ingestion through the UI
from [MLflow](https://mlflow.org/). In future releases, we will add connectors to other popular ML platforms. 
This is just the beginning. We want to learn about the use cases from the community and connect with people that 
want to help us shape the vision and roadmap. Do not hesitate to reach out!

### Connectors

In every release, OpenMetadata has maintained its focus on adding new connectors. In the 0.11 release, five new
connectors have been added - [Airbyte](https://airbyte.com/), [Mode](https://mode.com/), 
[AWS Data Lake](https://aws.amazon.com/big-data/datalakes-and-analytics/what-is-a-data-lake/),
[Google Cloud Data Lake](https://cloud.google.com/learn/what-is-a-data-lake#section-6), and [Apache Pinot](https://pinot.apache.org/).

## 0.10.1 Release - May 17th, 2022

- Support for Postgres as OpenMetadata Store [#4601](https://github.com/open-metadata/OpenMetadata/issues/4601)
- UI Improvements in 0.10.1 Release [#4600](https://github.com/open-metadata/OpenMetadata/issues/4600)
- Support JWT Token Generation for Bot Accounts [#4637](https://github.com/open-metadata/OpenMetadata/issues/4637)
- UI Ingestion Improvements - Support for Dashboards & Messaging Services [#4843](https://github.com/open-metadata/OpenMetadata/issues/4843)
- Security: Fix Azure SSO and support refresh tokens in [#4989](https://github.com/open-metadata/OpenMetadata/issues/4989)

## 0.10.0 Release - Apr 27th, 2022

### Support for Database Schema

OpenMetadata supports databases, service name databases, and tables. We’ve added Database Schema as part of the FQN. 
For each external data source, we ingest the database, as well as the tables that are contained underneath the schemas.

### Support for Hard Delete

OpenMetadata supported soft deletions. Now, we also support the hard deletion of entities through the UI, APIs,
and ingestion. Hard deleting an entity removes the entity and all of its relationships. This will also generate a change event.

### Deploy Ingestion from UI

OpenMetadata has refactored the service connections to simplify the ingestion jobs from both the ingestion framework 
and the UI. We now use the pydantic models automatically generated from the JSON schemas for the connection
definition. The ‘Add Service’ form is automatically generated in the UI based on the JSON schema specifications for the
various connectors that are supported in OpenMetadata.

### Download DBT Manifest Files from Amazon S3 or Google Cloud Storage

Previously, when ingesting the models and lineage from DBT, we passed the path of the DBT manifest and catalog files 
directly into the workflow. We’ve worked on improving the quality of life of DBT. Now, we can dynamically download 
these files from Amazon S3 or Google Cloud Storage. This way we can have any other process to connect to the DBT, 
extract the catalog, and put it into any cloud service. We just need the path name and workflow job details from the 
metadata extraction to be able to ingest metadata.

### JSON Schema based Connection Definition

Each service (database, dashboard, messaging, or pipeline service) has its own configuration specifications, with some 
unique requirements for some services. Instead of the ad hoc definitions of the source module in Python for each 
connector, we’ve worked on the full refactoring of the ingestion framework. We now use the pydantic models automatically
generated from the JSON schemas for the connection definition.

### Airflow Rest APIs

The Airflow REST APIs have been refactored. With our API centric model, we are creating a custom airflow rest API 
directly on top of Airflow using plugins. This passes the connection information to automatically generate all the dags
and prepares handy methods to help us test the connection to the source before creating the service.

### UI Changes

- The UI improvements are directed toward providing a consistent user experience.
- Hard Deletion of Entities: With the support for the hard deletion of entities, we can permanently delete tables, 
  topics, or services. When the entity is hard deleted, the entity and all its relationships are removed. 
  This generates an ‘EntityDeleted’ change event.
- Dynamic “Add Service” Forms: The ‘Add Service’ form is automatically generated in the UI based on the JSON 
  schema specifications for the various connectors that are supported in OpenMetadata.
- UI Support for Database Schema as part of FQN: The database schema has been introduced in the 0.10 release. All the
  entity pages now support Database Schema in the UI.
- Lineage Editor: Improvements have been made to the lineage editor.
- Teams: While signing up in OpenMetadata, the teams with restricted access are hidden and only the joinable teams are displayed.
- Team Owner: An Owner field has been added to the Team entity. Only team owners can update the teams.
- Activity Feeds: The Activity Feeds UI supports infinite scrolling.
- Add User: A user can be added from the Users page.

### Security Changes
- **Support Refresh Tokens for Auth0 and Okta SSO**: The JWT tokens generated by the SSO providers expire by default 
  in about an hour, making the user re-login often. In this release, we’ve added support for refresh tokens for Auth0 
  and Okta SSO. The tokens are refreshed silently behind the scenes to provide an uninterrupted user experience.
  In future releases, we’ll continue to stabilize authentication and add refresh tokens for the other SSO providers.
- **Custom OIDC SSO**: OpenMetadata now supports integration with your custom-built OIDC SSO for authentication. 
  This is supported both on the front end for user authentication and on the ingestion side.
- **Azure SSO**: Support has been added for Azure SSO on Airflow.

## 0.9.0 - March 10th, 2022

### Collaboration

- Conversations in the main feed.
- Users can ask each other questions, add suggestions and replies.
- Turn some threads into tasks and provide it in MyData as number of tasks.
- Glossary.
- Table details - Click through on usage to see who or what services are using it, what queries are pulling from it.

### Data Quality
- Ability to create and monitor the test cases.
- Data Quality Tests support with Json Schemas and APIs.
- UI Integration to enable user to write tests and run them on Airflow.

### Glossary

- Glossaries are a Controlled Vocabulary in an organization used to define the concepts and terminologies specific to a
  particular domain.
- API & Schemas to support Glossary.
- UI support to add Glossary and Glossary Terms. 
- Support for using Glossary terms to annotate Entities and Search using Glossary Terms.

### Connectors
- Apache Iceberg
- Azure SQL
- Clickhouse
- Clickhouse Usage
- Databricks
- Databricks Usage
- Delta Lake
- DynamoDB
- IBM DB2
- Power BI
- MSSQL Usage
- SingleStore
- Apache Atlas ,Import Metadata from Apache Atlas into OpenMetadata
- Amundsen, Import Metadata from Amundsen into OpenMetadata

### Lineage
- DataSource SQL Parsing support to extract Lineage
- View Lineage support

### Pipeline
- Capture pipeline status as it happens

### Security

- Security policies through the UI.
- Configuration personas and authorization based on policies.
- AWS SSO support.

## 0.8 Release - Jan 22nd, 2022

### Access Control Policies
- Design of Access Control Policies.
- Provide Role based access control with community feedback.

### Eventing Webhook

- Register webhooks to get metadata event notifications.
- Metadata Change Event integration into Slack and framework for integration into other services such as 
  Kafka or other Notification frameworks

### Connectors
- Delta Lake
- Iceberg
- PowerBI
- Azure SQL

## 0.7 Release - Dec 15th, 2021

### UI - Activity Feed, Improved UX for Search
- Users will have access to Activity Feed of all the changes to the Metadata.
- New and Improved UX for Search and Landing page.

### Support for Table Location
- Extract Location information from Glue, Redshift.
- Show Location details on the Table Page.

### ElasticSearch Improvements
- Support SSL (including self-signed certs) enabled ElasticSearch.
- New entities will be indexed into ElasticSearch directly

### Connectors
- Metabase
- Apache Druid
- Glue Improvements
- MSSQL - SSL support
- Apache Atlas Import connector
- Amundsen Import connector

### Other features
- Metadata Change Event integration into Slack and framework for integration into other services such as Kafka or
  other Notification frameworks
- Delta Lake support, Databricks, Iceberg

## 0.6 Release - Nov 17th, 2021

### Metadata Versioning and Eventing Framework
- Capture changes to Entity Metadata from source and user interactions as versions.
- Versioned changes will be published as events for clients to consume to take actions on.

### Data Reliability
- Improvements to Data Reliability library.
- Capture custom measurements through user provided SQL.

### Airflow APIs
- Airflow APIs to deploy DAGS and manage them.
- UI integration to deploy ingestion workflows.

### Connectors
- AWS Glue
- DBT
- MariaDB

## 0.5 Release - Oct 19th, 2021

### Support for Lineage
- Lineage related schemas and APIs.
- Lineage metadata integration from AirFlow for tables.
- UI changes to show lineage information to the users.

### Data Reliability
- Improvements to Data Profiler.
- UI integration with Data Profiler to show how the table profile looks over the period of time.

### Complex Types
- Support complex types such as Struct, Array with nested fields.
- UI support to add expand complex types and tag, add description for nested fields.

### Connectors
- Trino
- Redash

### Other features
- Pipeline Entities are supported.
- Integration with Airflow to extract Pipeline details.

## 0.4 Release - Sep 20th, 2021

### Support for Kafka (and Pulsar WIP)
- Support for Message Service and Topic entities in schemas, APIs, and UI.
- Kafka connector and ingestion support for Confluent Schema Registry.

### Support for Dashboards
- Support for Dashboard services, Dashboards, and Charts entities in schemas, APIs, and UI.
- Looker, Superset, Tableau connector, and ingestion support.

### User Interface
- Sort search results based on Usage, Relevance, and Last updated time.
- Search string highlighted in search results.
- Support for Kafka and Dashboards from Looker, Superset, and Tableau.

### Other features
- Pluggable SSO integration - Auth0 support.
- Support for Presto.

### Work in progress
- Salesforce CRM connector.
- Data profiler to profile tables in ingestion framework and show it table details page.
