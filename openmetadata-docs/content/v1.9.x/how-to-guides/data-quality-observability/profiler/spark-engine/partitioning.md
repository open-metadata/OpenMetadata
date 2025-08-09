---
title: Spark Engine Partitioning Requirements | OpenMetadata Spark Profiling
description: Learn about the partitioning requirements for Spark Engine and how to choose the right partition column for optimal performance.
slug: /how-to-guides/data-quality-observability/profiler/spark-engine/partitioning
collate: true
---

# Spark Engine Partitioning Requirements

## Why Partitioning is Required

The Spark Engine requires a partition column to efficiently process large datasets. This is because:

1. **Parallel Processing**: Each partition can be processed independently across different Spark workers
2. **Resource Optimization**: Prevents memory overflow and ensures stable processing of large datasets

## How Partitioning Works

The Spark Engine automatically detects and uses partition columns based on this logic:

### Automatic Detection Priority

1. **Manual Configuration**: You can explicitly specify a partition column in the table configuration
2. **Primary Key Columns**: If a table has a primary key with numeric or date/time data types, it's automatically selected

### Supported Data Types for Partitioning

- **Numeric**: `SMALLINT`, `INT`, `BIGINT`, `NUMBER`
- **Date/Time**: `DATE`, `DATETIME`, `TIMESTAMP`, `TIMESTAMPZ`, `TIME`

## What Happens Without a Suitable Partition Column

If no suitable partition column is found, the table will be skipped during profiling. This ensures that only tables with proper partitioning can be processed by the Spark Engine, preventing potential performance issues or failures.

## Choosing the Right Partition Column

### Best Practices

1. **High Cardinality**: Choose columns with many unique values to ensure even data distribution
2. **Even Distribution**: Avoid columns with heavily skewed data (e.g., mostly NULL values)
3. **Query Performance**: Select columns that have an index created on them
4. **Data Type Compatibility**: Ensure the column is of a supported data type for partitioning

### Examples

| Column Type | Good Partition Column | Poor Partition Column |
| --- | --- | --- |
| **Numeric** | `user_id`, `order_id`, `age` | `status_code` (limited values) |
| **Date/Time** | `created_date`, `updated_at`, `event_timestamp` | `last_login` (many NULLs) |

### Common Patterns

- **Primary Keys**: Usually excellent partition columns
- **Timestamps**: Great for time-based partitioning
- **Foreign Keys**: Good if they have high cardinality
- **Business Keys**: Customer IDs, order IDs, etc.

## Configuration Examples

### Basic Partition Configuration

```yaml
processor:
  type: orm-profiler
  config:
    tableConfig:
      - fullyQualifiedName: YourService.YourDatabase.YourSchema.YourTable
        sparkTableProfilerConfig:
          partitioning:
            partitionColumn: user_id
```

### Advanced Partition Configuration

```yaml
processor:
  type: orm-profiler
  config:
    tableConfig:
      - fullyQualifiedName: YourService.YourDatabase.YourSchema.YourTable
        sparkTableProfilerConfig:
          partitioning:
            partitionColumn: created_date
            lowerBound: "2023-01-01"
            upperBound: "2024-01-01"
```

## Troubleshooting Partitioning Issues

### Common Issues

1. **No Suitable Partition Column**: Ensure your table has a column with supported data types
2. **Low Cardinality**: Choose a column with more unique values
3. **Data Type Mismatch**: Verify the column is of a supported data type
4. **Missing Index**: Consider adding an index to improve partitioning performance

### Debugging Steps

1. **Check Table Schema**: Verify available columns and their data types
2. **Analyze Column Distribution**: Check for NULL values and cardinality
3. **Test Partition Column**: Validate the chosen column works with your data
4. **Review Logs**: Check profiler logs for specific partitioning errors

{% inlineCalloutContainer %}
 {% inlineCallout
  color="violet-70"
  bold="Configuration"
  icon="MdAnalytics"
  href="/how-to-guides/data-quality-observability/profiler/spark-engine/configuration" %}
  Configure your profiler pipeline to use Spark Engine.
 {% /inlineCallout %}
{% /inlineCalloutContainer %} 