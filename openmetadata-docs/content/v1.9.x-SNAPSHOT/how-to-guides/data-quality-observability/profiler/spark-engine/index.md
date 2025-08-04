---
title: Spark Engine Overview | OpenMetadata Distributed Profiling
description: Learn about OpenMetadata's Spark Engine for distributed data profiling of large-scale datasets using Apache Spark.
slug: /how-to-guides/data-quality-observability/profiler/spark-engine
collate: true
---

# Spark Engine Overview

## What is Spark Engine?

The Spark Engine is a distributed processing engine in OpenMetadata that enables large-scale data profiling using Apache Spark. It's an alternative to the default Native engine, designed specifically for handling massive datasets that would be impractical or impossible to profile directly on the source database.

## When to Use Spark Engine

### Use Spark Engine when:

- You have access to a Spark cluster (local, standalone, YARN, or Kubernetes)
- Your datasets are too large to profile directly on the source database
- You need distributed processing capabilities for enterprise-scale data profiling
- Your source database doesn't have built-in distributed processing capabilities

### Stick with Native Engine when:

- You are using an already distributed processed database such as BigQuery or Snowflake
- Your profiler pipeline runs smoothly directly on the source database
- You're doing development or testing with small tables
- You don't have access to a Spark cluster
- You need the simplest possible setup

The Spark Engine integrates seamlessly with OpenMetadata's existing profiling framework while providing the distributed processing capabilities needed for enterprise-scale data profiling operations.

{% inlineCalloutContainer %}
 {% inlineCallout
  color="violet-70"
  bold="Prerequisites"
  icon="MdSecurity"
  href="/how-to-guides/data-quality-observability/profiler/spark-engine/prerequisites" %}
  Learn about the required infrastructure and setup for Spark Engine.
 {% /inlineCallout %}
 {% inlineCallout
    icon="MdOutlineSchema"
    bold="Partitioning Requirements"
    href="/how-to-guides/data-quality-observability/profiler/spark-engine/partitioning" %}
    Understand the partitioning requirements for Spark Engine.
 {% /inlineCallout %}
 {% inlineCallout
    icon="MdAnalytics"
    bold="Configuration"
    href="/how-to-guides/data-quality-observability/profiler/spark-engine/configuration" %}
    Configure your profiler pipeline to use Spark Engine.
 {% /inlineCallout %}
{% /inlineCalloutContainer %} 