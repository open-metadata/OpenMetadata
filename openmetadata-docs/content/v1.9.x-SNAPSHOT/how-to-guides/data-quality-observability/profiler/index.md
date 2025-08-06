---
title: Data Profiler | `brandName` Data Profiling Guide
description: Explore profiling workflows including histogram metrics, null counts, and field-level health.
slug: /how-to-guides/data-quality-observability/profiler
---

# Overview of Data Profiler

The profiler in OpenMetadata helps to understand the shape of your data and to quickly validate assumptions. The data profiler helps to capture table usage statistics over a period of time. This happens as part of profiler ingestion. Data profiles enable you to check for null values in non-null columns, for duplicates in a unique column, etc. You can gain a better understanding of column data distributions through the descriptive statistics provided.

Watch the video to understand OpenMetadata’s native Data Profiler and Data Quality tests.

{%  youtube videoId="gLdTOF81YpI" start="0:00" end="1:08:10" width="800px" height="450px" /%}

{%inlineCalloutContainer%}
 {%inlineCallout
  color="violet-70"
  bold="Profiler Tab"
  icon="MdSecurity"
  href="/how-to-guides/data-quality-observability/profiler/tab"%}
  Get a complete picture of the Table Profile and Column Profile details.
 {%/inlineCallout%}
 {%inlineCallout
    icon="MdVisibility"
    bold="Profiler Workflow"
    href="/how-to-guides/data-quality-observability/profiler/workflow"%}
    Configure and run the Profiler Workflow to extract Profiler data.
 {%/inlineCallout%}
 {%inlineCallout
    icon="MdAnalytics"
    bold="Metrics"
    href="/how-to-guides/data-quality-observability/profiler/metrics"%}
    Learn about the supported profiler metrics.
 {%/inlineCallout%}
 {%inlineCallout
    icon="MdOutlineSchema"
    bold="External Workflow"
    href="/how-to-guides/data-quality-observability/profiler/external-workflow"%}
    Run a single workflow profiler for the entire source externally.
 {%/inlineCallout%}
 {%inlineCallout
    icon="MdRocket"
    bold="Spark Engine"
    href="/how-to-guides/data-quality-observability/profiler/spark-engine"%}
    Use distributed processing with Apache Spark for large-scale data profiling.
 {%/inlineCallout%}
{%/inlineCalloutContainer%}