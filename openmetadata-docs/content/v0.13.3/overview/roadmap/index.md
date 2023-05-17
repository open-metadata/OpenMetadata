---
title: Roadmap
slug: /overview/roadmap
---

# Roadmap

Here is the OpenMetadata Roadmap for the next 3 releases. We are doing a monthly release, and we are going to evolve fast
and adapt to the community needs.

The below roadmap is subject to change based on community needs and feedback. Please file an Issue on [GitHub](https://github.com/open-metadata/OpenMetadata/issues) 
or ping us on [Slack](https://slack.open-metadata.org/) If you would like to prioritize any feature or would like to add a new feature.


You can check the latest release [here](/overview/releases).

## 0.13.1 Release - Dec 22nd, 2022

{% tilesContainer %}

{% tile title="Lineage" %}
- UI Improvements to the queries collected and attached to a table. Allow users upvote a query to show as an example
{% /tile %}

{% tile title="Data Quality" %}
- Freshness based on the partition key
- TestCase versioning and results applying to a specific version so that UI can show the results as per the test case version
{% /tile %}

{% tile title="Notifications" %}
- Improved workflow to build Alerts and filtering mechanisms
- Admins can now configure email templates.
- Admins can set up an email notification for an event, such as a schema change notification, etc..
{% /tile %}

{% tile title="Glossary" %}
- Bulk upload of Glossary Terms
- Glossary Review Workflow. Owners and Reviewers can approve or deny a Glossary Term to be used. When a user adds a GlossaryTerm, it will open a task and assign it to the owner and reviewers.
- Propagate tags at the root of glossary terms to its children
- Propagate tags/glossary by tagging at the database/schema level and applying them to all the schemas/tables underneath them.
{% /tile %}

{% tile title="Messaging - Kafka & Redpanda" %}
- AVRO/Protobuf schema parsing and showing them in the topic entity view; currently, we show it as one payload
- Users will be able to add descriptions/tags at the field level
- Users can search based on fields in a schema of a topic.
{% /tile %}



{% /tilesContainer %}


## 1.0 Release - March 14th, 2023

{% tilesContainer %}

{% tile title="APIs & Schemas" %}
- Entity Schema specification versioning
- Defining API backward compatability
{% /tile %}

{% tile title="Lineage" %}
- Overhaul of lineage query parsing and improved new library
- UI Improvements to the queries collected and attached to a table. Allow users upvote a query to show as an example
{% /tile %}

{% tile title="Collaboration" %}
- Improvements Task & Activity Feed
{% /tile %}

{% tile title="Entities" %}
- Add support for NoSQL/Json-based documents as entities. This will help integrate Cassandra/ElasticSearch etc.. services.
- Storage Services such as S3 and showcase buckets as independent entities
{% /tile %}

{% tile title="Data Quality" %}
- Complex types
- Add support for computing completeness
- Improvements to Auto Classification of entities by ML
{% /tile %}

{% tile title="Security" %}
- Search results integration for roles and policies
- Domain based restriction and domain only view
- Policy improvements based on community feedback
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


## 1.1 Release - April 18th 2023

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

{% tile title="Data Insights" %}
- Cost analysis report
- Data Deletion Report
{% /tile %}


{% tile title="Entities" %}
- Add support for Notebook Entity
- Add support for Report Entity
{% /tile %}

{% tile title="Reverse Metadata **beta**" %}
{% /tile %}

{% /tilesContainer %}
