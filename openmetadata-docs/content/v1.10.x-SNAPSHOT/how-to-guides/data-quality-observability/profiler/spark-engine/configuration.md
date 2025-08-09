---
title: Spark Engine Configuration | OpenMetadata Spark Profiling Setup
description: Learn how to configure your profiler pipeline to use Spark Engine for distributed data profiling.
slug: /how-to-guides/data-quality-observability/profiler/spark-engine/configuration
collate: true
---

# Spark Engine Configuration

## Overview

There are two ways to configure Spark Engine in OpenMetadata:

{% inlineCalloutContainer %}
 {% inlineCallout
  color="violet-70"
  bold="UI Configuration"
  icon="MdAnalytics"
  href="/how-to-guides/data-quality-observability/profiler/spark-engine/ui-configuration" %}
  Configure Spark Engine through the OpenMetadata UI.
 {% /inlineCallout %}
 {% inlineCallout
    icon="MdOutlineSchema"
    bold="External Configuration"
    href="/how-to-guides/data-quality-observability/profiler/spark-engine/external-configuration" %}
    Configure Spark Engine using YAML files for external workflows.
 {% /inlineCallout %}
{% /inlineCalloutContainer %}

{% note %}
Before configuring, ensure you have completed the [Spark Engine Prerequisites](/how-to-guides/data-quality-observability/profiler/spark-engine/prerequisites) and understand the [Partitioning Requirements](/how-to-guides/data-quality-observability/profiler/spark-engine/partitioning).
{% /note %} 