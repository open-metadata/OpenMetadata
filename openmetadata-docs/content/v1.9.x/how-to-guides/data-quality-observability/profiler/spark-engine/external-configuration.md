---
title: Spark Engine External Configuration | OpenMetadata Spark Profiling
description: Configure Spark Engine using YAML files for external workflows and distributed data profiling.
slug: /how-to-guides/data-quality-observability/profiler/spark-engine/configuration/external-configuration
collate: true
---

# Spark Engine External Configuration

## Overview

To configure your profiler pipeline to use Spark Engine, you need to add the `processingEngine` configuration to your existing YAML file.

{% note %}
Before configuring, ensure you have completed the [Spark Engine Prerequisites](/how-to-guides/data-quality-observability/profiler/spark-engine/prerequisites) and understand the [Partitioning Requirements](/how-to-guides/data-quality-observability/profiler/spark-engine/partitioning).
{% /note %}

## Step 1: Add Spark Engine Configuration

In your existing profiler YAML, add the `processingEngine` section under `sourceConfig.config`:

```yaml
sourceConfig:
  config:
    type: Profiler
    # ... your existing configuration ...
    processingEngine:
      type: Spark
      remote: sc://your_spark_connect_host:15002
      config:
        tempPath: your_path

{% note %}
**Important**: The `tempPath` must be accessible to all nodes in your Spark cluster. This is typically a shared filesystem path (like S3, HDFS, or a mounted network drive) that all Spark workers can read from and write to.
{% /note %}
```

## Step 2: Add Partition Configuration

In the `processor.config.tableConfig` section, add the `sparkTableProfilerConfig`:

```yaml
processor:
  type: orm-profiler
  config:
    tableConfig:
      - fullyQualifiedName: YourService.YourDatabase.YourSchema.YourTable
        sparkTableProfilerConfig:
          partitioning:
            partitionColumn: your_partition_column
            # lowerBound: 0
            # upperBound: 10000000
```

## Complete Example

### Before (Native Engine)

```yaml
sourceConfig:
  config:
    type: Profiler
    schemaFilterPattern:
      includes:
        - ^your_schema$
    tableFilterPattern:
      includes:
        - your_table_name

processor:
  type: orm-profiler
  config: {}
```

### After (Spark Engine)

```yaml
sourceConfig:
  config:
    type: Profiler
    schemaFilterPattern:
      includes:
        - ^your_schema$
    tableFilterPattern:
      includes:
        - your_table_name
    processingEngine:
      type: Spark
      remote: sc://your_spark_connect_host:15002
      config:
        tempPath: s3://your_s3_bucket/table
        # extraConfig:
        #     key: value
processor:
  type: orm-profiler
  config:
    tableConfig:
      - fullyQualifiedName: YourService.YourDatabase.YourSchema.YourTable
        sparkTableProfilerConfig:
          partitioning:
            partitionColumn: your_partition_column
            # lowerBound: 0
            # upperBound: 1000000
```

## Required Changes

1. **Add `processingEngine`** to `sourceConfig.config`
2. **Add `sparkTableProfilerConfig`** to your table configuration
3. **Specify partition column** for Spark processing (Else it will fallback to fetching the Primary Key if any, or skipping the table entirely)

## Run the Pipeline

Use the same command as before:

```bash
metadata profile -c your_profiler_config.yaml
```

The pipeline will now use Spark Engine instead of the Native engine for processing.

## Troubleshooting Configuration

### Common Issues

1. **Missing Partition Column**: Ensure you've specified a suitable partition column
2. **Network Connectivity**: Verify Spark Connect and database connectivity
3. **Driver Issues**: Check that appropriate database drivers are installed in Spark cluster
4. **Configuration Errors**: Validate YAML syntax and required fields

### Debugging Steps

1. **Check Logs**: Review profiler logs for specific error messages
2. **Test Connectivity**: Verify all network connections are working
3. **Validate Configuration**: Ensure all required fields are properly set
4. **Test with Small Dataset**: Start with a small table to verify the setup

{% inlineCalloutContainer %}
 {% inlineCallout
  color="violet-70"
  bold="UI Configuration"
  icon="MdAnalytics"
  href="/how-to-guides/data-quality-observability/profiler/spark-engine/configuration/ui-configuration" %}
  Configure Spark Engine through the OpenMetadata UI.
 {% /inlineCallout %}
{% /inlineCalloutContainer %} 