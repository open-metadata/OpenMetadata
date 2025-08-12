---
title: Data Lineage | OpenMetadata Lineage How-To Guide
description: Navigate core data lineage guides to understand column, table, and pipeline lineage configuration.
slug: /how-to-guides/data-lineage
---

# Overview of Data Lineage

OpenMetadata tracks data lineage, showing how data moves through the organization's systems. Users can visualize how data is transformed and where it is used, helping with data traceability and impact analysis. OpenMetadata supports lineage for Database, Dashboard, and Pipelines.

{% image
src="/images/v1.10/how-to-guides/lineage/lineage1.png"
alt="Data Lineage in OpenMetadata"
caption="Data Lineage in OpenMetadata"
/%}

Watch the video on data lineage to understand the different options to automatically extract the lineage from your data warehouses such as Snowflake, dashboard service like metabase. Also learn about creating lineage programmatically with python SDK.

{%  youtube videoId="jEbN1tt89H0" start="0:00" end="41:43" width="800px" height="450px" /%}

{%inlineCalloutContainer%}
 {%inlineCallout
  color="violet-70"
  bold="Lineage Workflow"
  icon="MdPolyline"
  href="/how-to-guides/data-lineage/workflow"%}
  Configure a lineage workflow right from the UI.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Explore Lineage"
  icon="MdPolyline"
  href="/how-to-guides/data-lineage/explore"%}
  Explore the rich lineage view in OpenMetadata.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Column-Level Lineage"
  icon="MdViewColumn"
  href="/how-to-guides/data-lineage/column"%}
  Explore and edit the rich column-level lineage.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Manual Lineage"
  icon="MdPolyline"
  href="/how-to-guides/data-lineage/manual"%}
  Edit the table and column level lineage manually.
 {%/inlineCallout%}
{%/inlineCalloutContainer%}