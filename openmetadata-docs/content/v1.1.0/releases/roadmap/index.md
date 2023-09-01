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


## 1.2.0 Release - Sept 29th 2023

{% tilesContainer %}


{% tile title="Domains & Data Products" %}
- Simplifying Roles and Policies Evaluation in the backend
- Adding integration into Search to filter out entities that the users do not have access to
{% /tile %}

{% tile title="Entities" %}
- Asset Deprecation, owners can mark assets as deprecated along with a notice of whats the new asset to use. Search will exclude deprecated assets
- ElasticSearch Connector
- Support for manifest file to describe a bucket schema in DataLake
{% /tile %}

{% tile title="Data Quality" %}
- Improved Resolution Center
{% /tile %}

{% tile title="Data Observability" %}
- Notifications will be grouped into Activity vs. Alert type notifications
- Data SLAs
- Impact Analysis
{% /tile %}

{% tile title="Glossaries" %}
- Glossary Term Approval Workflow
{% /tile %}

{% /tilesContainer %}
