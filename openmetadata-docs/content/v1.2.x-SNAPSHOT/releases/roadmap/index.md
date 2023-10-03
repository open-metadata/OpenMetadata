---
title: Roadmap
slug: /releases/roadmap
---

# Roadmap

Here is the OpenMetadata Roadmap for the next 3 releases. We are doing a monthly release, and we are going to evolve fast
and adapt to the community needs.

The below roadmap is subject to change based on community needs and feedback. Please file an Issue on [GitHub](https://github.com/open-metadata/OpenMetadata/issues) 
or ping us on [Slack](https://slack.open-metadata.org/) if you would like to prioritize any feature or would like to add a new feature.

You can check the latest release [here](/releases/all-releases).


## 1.1 Release - June 29th, 2023

{% tilesContainer %}

{% tile title="Entities" %}
- We will be adding support for NoSQL DB entities and Services with APIs
- Support for Long Entity Names such as S3 paths
- Import/Export support at all entities
- Tag Propagation using Import/Export
- Thumbs up & down to capture popularity of the Entities
{% /tile %}

{% tile title="Ingestion" %}
- ElasticSearch Connector
- MongoDB Connector
- SAP HANA Connector
- Support for manifest file to describe a bucket schema in DataLake
- Ingestion bug fixes reported from community
- Support for Tableau & Looker data models
{% /tile %}

{% tile title="Alerts & Notifications" %}
- Durable queue to store ChangeEvents guaranteeing  at-least-once semantics
- Live BulkActions on ElasticSearch to handle Tag category deletion, owner chagne propagation etc..
- Support to get notifications  via email when a user is mentioned 
{% /tile %}

{% tile title="Search" %}
- Enable search for custom properties 
- Upgrade ElasticSearch client
{% /tile %}

{% tile title="Security" %}
- User Personal Access Token to access APIs as a user
{% /tile %}

{% tile title="UI & UX" %}
- Complete overhaul of OpenMetadata UI 
- Improved Landing page 
- Tours to learn and understand the features of OpenMetadata
{% /tile %}

{% tile title="Data Quality" %}
- Overhaul of Data Quality landing page to showcase Test suites and summary for the users
- Table Diff test to compare two tables
- Number Passed/failed rows for a test 
- Profiler to capture system level metrics when available
{% /tile %}

{% tile title="Data Insights" %}
- Data Insight UI improvements
- Data Insight report to show most unused  data assets
{% /tile %}

{% tile title="Lineage" %}
- Support for parsing complex sql queries from community feedback
- Tableau Custom SQL parsing for Lineage
{% /tile %}

{% /tilesContainer %}


## 1.2 Release - Oct 13th 2023

{% tilesContainer %}

{% tile title="Entities" %}
- Asset Deprecation, owners can mark assets as deprecated along with a notice of whats the new asset to use. Search will exclude deprecated assets
{% /tile %}

{% tile title="Data Quality" %}
- Suggest automated tests
- Data quality panel in Data Insights
{% /tile %}

{% tile title="Lineage" %}
- Propagation of tags and descriptions through the column-level lineage
{% /tile %}

{% tile title="Data Observability" %}
- Notifications will be grouped into Activity vs. Alert type notifications
- Data SLAs
- Impact Analysis
{% /tile %}

{% tile title="Roles & Policies" %}
- Simplifying Roles and Policies Evaluation in the backend
- Adding integration into Search to filter out entities that the users do not have access to
{% /tile %}

{% tile title="Domains" %}
- Introduce Domain capabilities in OpenMetadata
- Domain only view and allow users to create tags/terms specific to Domains
{% /tile %}

{% tile title="Glossaries" %}
- Glossary Term Approval Workflow
{% /tile %}

{% /tilesContainer %}
