---
title: Get a Quick Glance of the Data Assets
description: Preview datasets before diving in, using inline metadata, sample rows, and column-level insights.
slug: /how-to-guides/data-discovery/preview
---

# Get a Quick Glance of the Data Assets

For the each of the data assets displayed in the Explore page, some basic information is displayed on the data asset card. Users can view the **Source, Name of the Data Asset, Description, Owner (Team/User details), Tier, and Usage** information for each data asset.
{% image
src="/images/v1.7/how-to-guides/discovery/prv8.png"
alt="Basic Information about the Data Asset"
caption="Basic Information about the Data Asset"
/%}

OpenMetadata provides a quick preview of the data asset on the right side panel. Just click on the empty space next to the relevant data asset to get a quick preview. 

## Preview based on the Data Asset Type
Based on the type of data asset (Table, Topic, Dashboard, Pipeline, ML Model, Container, Glossary, Tag), the quick preview provides information. For example, the **type of table, the number of queries, and columns** are displayed for `tables`.
{% image
src="/images/v1.7/how-to-guides/discovery/prv1.png"
alt="Quick Glance of the Table Details"
caption="Quick Glance of the Table Details"
/%}

Similarly, the quick glance displays the information on the **Partitions, Replication Factor, Retention Size, CleanUp Policies, Max Message Size, and Schema Type** for `topics`.
{% image
src="/images/v1.7/how-to-guides/discovery/prv2.png"
alt="Quick Glance of the Topic Details"
caption="Quick Glance of the Topic Details"
/%}

For `ML Models`, it displays the **Algorithm, Target, Server, and Dashboard**.
{% image
src="/images/v1.7/how-to-guides/discovery/prv3.png"
alt="Quick Glance of the ML Model Details"
caption="Quick Glance of the ML Model Details"
/%}

A `glossary` preview displays the **Reviewers, Synonyms, and Children**.
{% image
src="/images/v1.7/how-to-guides/discovery/prv4.png"
alt="Quick Glance of the Glossary Term Details"
caption="Quick Glance of the Glossary Term Details"
/%}

Likewise, for `dashboards`, and `pipelines`, it displays the **Dashboard URL** and **Pipeline URL** respectively. For containers, the **Objects, Service Type, and Columns** are displayed. The `tag` preview displays the **Usage** of the tags.

## Data Quality and Profiler Metrics

The data quality and profiler metrics displays the details on the **Tests Passed, Aborted, and Failed**.
{% image
src="/images/v1.7/how-to-guides/discovery/prv5.png"
alt="Quick Glance of the Data Quality and Profiler Metrics"
caption="Quick Glance of the Data Quality and Profiler Metrics"
/%}

## Tags

Users can view all the tags associated with a particular data asset.
{% image
src="/images/v1.7/how-to-guides/discovery/prv6.png"
alt="Quick Glance of the Tags"
caption="Quick Glance of the Tags"
/%}

## Schema

The Schema provides the details on the **column names, type of column, and column description**.
{% image
src="/images/v1.7/how-to-guides/discovery/prv7.png"
alt="Quick Glance of the Schema"
caption="Quick Glance of the Schema"
/%}

{%inlineCallout
  color="violet-70"
  bold="Data Asset Details"
  icon="MdArrowForward"
  href="/how-to-guides/data-discovery/details"%}
  Get a holistic view of the data assets.
{%/inlineCallout%}