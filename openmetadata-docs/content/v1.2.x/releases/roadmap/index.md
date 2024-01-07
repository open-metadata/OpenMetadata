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


## 1.3 Release - Jan 25th, 2023

{% tilesContainer %}

{% tile title="Entities" %}
- support for bringing in API services as Entity
- support for extending Stored Procedure for other databases
- support for OpenSearch metadata 
{% /tile %}

{% tile title="Ingestion" %}
- OpenSearch Connector
- OpenAPI Connector
- Include Tags for Athena & Datalake connector
- Support for Tableau & Looker data models
{% /tile %}

{% tile title="Data Observablity & Notifications" %}
- Separate Data Observability and Notifications
- Improve & simplify setting up alerts for Data Observability
- Simplify delivery of notifications
{% /tile %}

{% tile title="Data Quality" %}
- Overhaul of Resolution Center
- Impact analysis and resolving test failures 
{% /tile %}

{% tile title="Security" %}
- User Personal Access Token to access APIs as a user
{% /tile %}

{% tile title="UI & UX" %}
- Display custom properties in entity details page
- Add pipeline panel in table details page to show case the pipeline status responsible to update the table
- Improve pipeline Details page
- Pipeline Knowledge Panel
{% /tile %}

{% tile title="Lineage" %}
- Overhaul of Lineage 
- Ability to trace E2E lineage
- Improvements to the Lineage UI
{% /tile %}

{% tile title="Custom Properties" %}
- Add additional types for Custom Properties
- UI support for rich data types
{% /tile %}


{% tile title="APIs & SDK" %}
- Overhaul of Java Client
{% /tile %}

{% /tilesContainer %}


## 1.4 Release - April 10th 2024

{% tilesContainer %}

{% tile title="Entities" %}
- Asset Deprecation, owners can mark assets as deprecated along with a notice of whats the new asset to use. Search will exclude deprecated assets
{% /tile %}

{% tile title="Data Quality" %}
- Data quality panel in Data Insights
{% /tile %}

{% tile title="Lineage" %}
- Propagation of tags and descriptions through the column-level lineage
{% /tile %}

{% tile title="Data Observability" %}
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


{% tile title="Data Quality" %}
- Overhaul of Data Quality landing page to showcase Test suites and summary for the users
- Table Diff test to compare two tables
- Number of Passed/failed rows for a test 
{% /tile %}


{% /tilesContainer %}
