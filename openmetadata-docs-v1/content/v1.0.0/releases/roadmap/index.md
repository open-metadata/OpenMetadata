---
title: Roadmap
slug: /releases/roadmap
---

# Roadmap

Here is the OpenMetadata Roadmap for the next 3 releases. We are doing a monthly release, and we are going to evolve fast
and adapt to the community needs.

The below roadmap is subject to change based on community needs and feedback. Please file an Issue on [GitHub](https://github.com/open-metadata/OpenMetadata/issues) 
or ping us on [Slack](https://slack.open-metadata.org/) If you would like to prioritize any feature or would like to add a new feature.

You can check the latest release [here](/releases/all-releases).


## 1.0 Release - April 17th, 2023

{% tilesContainer %}

{% tile title="APIs & Schema" %}
- Stabilization and Improvements to Schemas and APIs
- Backward compatability of the APIs
{% /tile %}

{% tile title="Ingestion" %}
- Improved UI/UX for Connector Deployment
- Test Connection will provide clear status on what are all the required permissions we need to extract metadat, lineage, profiler etc..
- Performance Improvements in fetching description, tags
- finite control over the ingesting ownership, tags
- dbt performance improvements
- Support for Tableau & Looker data models
- SSO Service accounts for ingestion will be deprecated. JWT token based authentication will be preferred
{% /tile %}

{% tile title="Entities" %}
- Object Store service, to extract the objects from storage services such as S3
- ElasticSearch Connector
- Query as Entity, Overhaul of queries UI
- Support for Long Entity Names such as S3 paths
- Import/Export support at all entities
- Tag Propgation using Import/Export
- Data Models for Dashboards
{% /tile %}

{% tile title="Glossary" %}
- Glossary & Tags Search enabled at global search
- Drag & Drop, Glossary Terms with-in Glossary and Across Glossaries
- Add Assets to a Glossary Term from Glossary Term page
{% /tile %}

{% tile title="Security" %}
- SAML support
- User Personal Access Token to access APIs as a user
{% /tile %}

{% tile title="Lineage" %}
- Support for displaying large no.of nodes(1000+) in Lineage UI
- Improved Lineage UI to navigate
- Continued improvements to SQL Parser to handle queries
{% /tile %}

{% tile title="Auto Classification" %}
- PII auto classifcation using ML and NLP.
{% /tile %}

{% tile title="Localization" %}
- Full support for localization in the UI
- Support for English, French, Spanish and Chinese
{% /tile %}

{% /tilesContainer %}


## 1.1 Release - May 18th 2023

{% tilesContainer %}

{% tile title="Automation" %}
- Automation framework to listen change events to run automated workflows
{% /tile %}

{% tile title="Lineage" %}
- Propagation of tags and descriptions through the column-level lineage
{% /tile %}

{% tile title="Data Observability" %}
- Notifications will be grouped into Activity vs. Alert type notifications
- Data SLAs
- Impact Analysis
{% /tile %}

{% tile title="Entities" %}
- Add support for Notebook Entity
- Add support for Report Entity
{% /tile %}

{% /tilesContainer %}
