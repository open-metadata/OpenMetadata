# Releases

OpenMetadata community is on a monthly release cadence. At every 4-5 weeks we will be releasing a new version. To see whats coming in next please check our Roadmap section.

Here are the releases so far



## Latest Release - 0.9.0 - March 10th , 2022

{% embed url="https://github.com/open-metadata/OpenMetadata/releases/tag/0.9.0-release" %}

### Collaboration

* Conversations in the main feed
* Users can ask each other questions, add suggestions and replies
* Turn some of the threads into tasks and provide it in MyData as number of tasks
* Glossary
* Table details - Click through on usage to see who or what services are using it, what queries are pulling from it.

### Data QualityAbility to create and monitor the test cases&#x20;

* Data Quality Tests support with Json Schemas and APIs
* UI Integration to enable user to write tests and run them on Airflow

### Glossary

* Glossaries are a Controlled Vocabulary in an organization used to define the concepts and terminologies specific to a particular domain.
* API & Schemas to support Glossary
* UI support to add Glossary and Glossary Terms .
* Support for using Glossary terms to annotate Entities and Search using Glossary Terms

### Connectors

* Apache Iceberg
* Azure SQL
* Clickhouse
* Clickhouse Usage
* Databricks
* Databricks Usage
* Delta Lake
* DynamoDB
* IBM DB2
* Power BI
* MSSQL Usage
* SingleStore
* Apache Atlas ,Import Metadata from Apache Atlas into OpenMetadata
* Amundsen, Import Metadata from Amundsen into OpenMetadata

### Lineage

* DataSource SQL Parsing support to extract Lineage
* View Lineage support

### Pipeline

* Capture pipeline status as it happens

### Security

* Security policies through the UI
* Configuration personas and authorization based on policies
* AWS SSO support



## 0.8 Release - Jan 22nd, 2022

{% embed url="https://github.com/open-metadata/OpenMetadata/releases/tag/0.8.0-release" %}

### Access Control Policies

* Design of Access Control Policies
* Provide Role based access control with community feedback

### Eventing Webhook

* Register webhooks to get metadata event notifications
* Metadata Change Event integration into Slack and framework for integration into other services such as Kafka or other Notification frameworks

### Connectors

* Delta Lake
* Iceberg
* PowerBI
* Azure SQL

## 0.7 Release - Dec 15th, 2021

{% embed url="https://github.com/open-metadata/OpenMetadata/releases/tag/0.7.0-release" %}

#### Theme: Data Collaboration - Activity Feeds,

### UI - Activity Feed, Improved UX for Search

* Users will have access to Activity Feed of all the changes to the Metadata
* New and Improved UX for Search and Landing page

### Support for Table Location

* Extract Location information from Glue, Redshift
* Show Location details on the Table Page

### Elastic Search - Improvements

* Support SSL (including self-signed certs) enabled ElasticSearch
* New entities will be indexed into ElasticSearch directly

### Connectors

* Metabase
* Apache Druid
* Glue Improvements
* MSSQL - SSL support
* Apache Atlas Import connector
* Amundsen Import connector

### Other features

* Metadata Change Event integration into Slack and framework for integration into other services such as Kafka or other Notification frameworks
* Delta Lake support, Databricks, Iceberg

## 0.6 Release - Nov 17th, 2021

{% embed url="https://github.com/open-metadata/OpenMetadata/releases/tag/0.6.0" %}

#### Theme: Metadata Versioning & Eventing

### Metadata Versioning and Eventing Framework

* Capture changes to Entity Metadata from source and user interactions as versions
* Versioned changes will be published as events for clients to consume to take actions on

### Data Reliability

* Improvements to Data Reliablity library
* Capture custom measurements through user provided SQL

### Airflow APIs

* Airflow APIs to deploy DAGS and manage them
* UI integration to deploy ingestion workflows

### Connectors

* AWS Glue
* DBT
* MariaDB

## 0.5 Release - Oct 19th, 2021

{% embed url="https://github.com/open-metadata/OpenMetadata/releases/tag/0.5.0" %}

#### Theme: Data quality and Lineage

### Support for Lineage

* Lineage related schemas and APIs
* Lineage metadata integration from AirFlow for tables
* UI changes to show lineage information to the users

### Data Reliability

* Improvements to Data Profiler
* UI integration with Data Profiler to show how the table profile looks over the period of time

### Complex Types

* Support complex types such as Struct, Array with nested fields
* UI support to add expand complex types and tag , add description for nested fields

### Connectors

* Trino
* Redash

### Other features

* Pipeline Entities are supported
* Integration with Airflow to extract Pipeline details

## 0.4 Release - Sep 20th, 2021

{% embed url="https://github.com/open-metadata/OpenMetadata/releases/tag/0.4.0" %}

#### Theme: Topics, Dashboards, and Data Profiler

### Support for Kafka (and Pulsar WIP)

* Support for Message Service and Topic entities in schemas, APIs, and UI
* Kafka connector and ingestion support for Confluent Schema Registry

### Support for Dashboards

* Support for Dashboard services, Dashboards, and Charts entities in schemas, APIs, and UI
* Looker, Superset, Tableau connector, and ingestion support

### User Interface

* Sort search results based on Usage, Relevance, and Last updated time
* Search string highlighted in search results
* Support for Kafka and Dashboards from Looker, SuperSet, and Tableau

### Other features

* Pluggable SSO integration - Auth0 support
* Support for Presto

### Work in progress

* Salesforce CRM connector
* Data profiler to profile tables in ingestion framework and show it table details page

