# Roadmap

Here is the OpenMetadata Roadmap for the next 3 releases.

We are doing a monthly release and we are going to evolve fast and adapt to community needs. Below roadmap is subject to change based on community needs and feedback. our roadmap yet, please file an Issue [Github](https://github.com/open-metadata/OpenMetadata/issues) or ping us on [Slack](https://slack.open-metadata.org)

If you would like to prioritize any feature or would like to add a new feature that is not in our roadmap yet, please file an Issue on [Github](https://github.com/open-metadata/OpenMetadata/issues) or ping us on [Slack](https://slack.open-metadata.org).

## Roadmap

## 0.9.2 Release - Apr 20th, 2022

### Collaboration

* Support for Micro workflows and tasks
* Users can request for description which becomes a task on owner of a dataset
* Resolve threads and Pin threads around activity
* Glossary approval workflow

### Data Quality

* Support for GreatExpectations to push the test result
* Support for all the tests in GreatExpectations as JsonSchemas
* Test Event notifications such as test success or failure
* UX improvements to tests

### Lineage

* Spark Lineage support
* Column level lineage API support
* Provide versioning support to Lineage

### Security

* Improvements to UI login&#x20;
* Support for AWS SSO and LDAP
* Fine grained policy and operations approach which will give option to restrict per entity and tag based policy enforcement

## 0.9.3 Release - May 25th, 2022

### Data Insights

* Show users/teams how their data doing
* Cost analysis
* How to improve Data culture

### Data Quality

* Data SLAs
* Freshness and completeness
* Ability to deploy GE tests from OpenMetadata UI

### Lineage

* Column Level Lineage support
* Incident detection through Lineage

### Collaboration

* Tiering Report on how to improve data assets and data culture
* Email notifications
* Webbrowser notifications

### ML Features

* support ML feature UI
* Sagemake connector

## Latest Release - 0.9.0 - March 10th , 2022

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

## 0.4 Release - Sep 20th, 2021

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

## 0.5 Release - Oct 19th, 2021

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

## 0.6 Release - Nov 17th, 2021

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

## 0.7 Release - Dec 15th, 2021

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

## 0.8 Release - Jan 22nd, 2022



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

## 1.0

### Data culture / Data quality

* Tier suggestion
* Data dashboard/Insights
  * Suggested tiers, created, deleted last week, descriptions added, ownership with/without number

### ML Features/ML

* Models UI
* ML Service

### Collaboration

* Tag suggest/accept/approve
* Expiry time
* Remind me later
* Data deleting report

### DBT

* Capture Lineage

## 1.1

### User feedback&#x20;

* Tiering report & nudges
* Badges
* Top datasets as positive feedback

### Freshness/completeness workflows and metadata

* SLA

### Collaboration

* Feature requests for datasets

### Integration

* Alation integration to fetch metadata

## 1.2

### Lineage

* Search for a column and show the entire DAG from origin to see how that column/table is generated&#x20;
* Lineage-based freshness and debugging

## 1.3

### Lineage

* Lineage based description, tag, attribute propagation
* Kafka lineage from services
* Periodic Reviews - Such as Tag Review
* Cost Analysis
