# Roadmap

Here is the OpenMetadata Roadmap for the next 3 releases.

We are doing a monthly release and we are going to evolve fast and adapt to community needs. Below roadmap is subject to change based on community needs and feedback. our roadmap yet, please file an Issue [Github](https://github.com/open-metadata/OpenMetadata/issues) or ping us on [Slack](https://slack.open-metadata.org)

If you would like to prioritize any feature or would like to add a new feature that is not in our roadmap yet, please file an Issue on [Github](https://github.com/open-metadata/OpenMetadata/issues) or ping us on [Slack](https://slack.open-metadata.org).

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

### Data Quality

* Data Quality Tests support with Json Schemas and APIs
* UI Integration to enable user to write tests and run them on Airflow
* Store the test results and provide notifications via eventing apis
* Provide integration of DBT tests into OpenMetadata

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
