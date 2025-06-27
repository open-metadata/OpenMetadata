---
title: Metrics for OpenMetadata
slug: /how-to-guides/data-governance/metrics
---

# Metrics in OpenMetadata

The **Metrics** entity in OpenMetadata allows users to define, track, and manage key business and operational metrics. Metrics help organizations maintain consistency, traceability, and accuracy in data-driven decision-making.

## Overview of Metrics

Metrics represent calculated values based on data assets and are categorized under the **Governance** section in OpenMetadata. Each metric can be linked to glossary terms, data assets, and other metrics, providing comprehensive visibility into data quality and usage.

## Key Properties of a Metric

| **Property**        | **Description**                                                           | **Example Value**              |
|---------------------|---------------------------------------------------------------------------|-------------------------------|
| **Name**            | Unique identifier for the metric, following camelCase naming conventions.  | `customerRetentionRate`        |
| **Display Name**    | Human-readable name for the metric.                                        | `Customer Retention Rate`      |
| **Description**     | Detailed explanation of what the metric represents.                        | `Percentage of retained users` |
| **Expression**      | Formula or SQL query used to calculate the metric.                         | `COUNT(returning_customers)`   |
| **Granularity**     | Time scale for the metric, such as daily, weekly, or monthly.              | `Daily`                       |
| **Metric Type**     | Type of calculation applied to the metric (e.g., count, average, ratio).   | `Percentage`                  |
| **Unit of Measurement** | Unit for interpreting metric values, such as count, dollars, or percentage. | `Percentage`              |
| **SQL Query**       | Optional SQL query defining the metric.                                    | `SELECT COUNT(*) FROM sales`  |
| **Owner**           | Individual or team responsible for maintaining the metric.                 | `Data Governance Team`         |

## Metric Lineage and Dependencies

OpenMetadata allows users to trace the source and dependencies of metrics using lineage. This ensures end-to-end traceability from raw data to metric reporting. A typical lineage might look like:

```commandline
Database Table → Metric → Pipeline → Dashboard
```

Users can view associated tables, pipelines, and dashboards to understand how metrics are generated and utilized.

## Creating Metrics Using the UI

To create a new metric in OpenMetadata using the user interface, follow these steps:

### 1. Navigate to the Metrics Section  

- Go to **Govern > Metrics** in the OpenMetadata UI.

{% image
src="/images/v1.9/how-to-guides/governance/metrics/metrics-1.png"
alt="Navigate to the Metrics Section"
caption="Navigate to the Metrics Section"
/%}

### 2. Add a New Metric  

- Click on **Add Metric** to initiate the metric creation process.

{% image
src="/images/v1.9/how-to-guides/governance/metrics/metrics-2.png"
alt="Add a New Metric"
caption="Add a New Metric"
/%}

### 3. Enter Metric Details

Provide the required information, including:

- **Metric Name**  
- **Description**  
- **Granularity** (time scale of the metric)
- **Metric Type** (e.g., count, average, ratio)
- **Computation Code** (SQL, Python, or Java) if applicable

### 4. Create the Metric

- After entering the details, click **Create** to finalize the metric.

{% image
src="/images/v1.9/how-to-guides/governance/metrics/metrics-3.png"
alt="Create the Metric"
caption="Create the Metric"
/%}

### 5. View the Created Metric

- The newly created metric will now be available in the **Metrics** page for reference and further use.

{% image
src="/images/v1.9/how-to-guides/governance/metrics/metrics-4.png"
alt="View the Created Metric"
caption="View the Created Metric"
/%}

## Example JSON Schema for Metric

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "customerRetentionRate",
  "displayName": "Customer Retention Rate",
  "description": "Percentage of customers retained over a given period.",
  "formula": "COUNT(returning_customers) / COUNT(total_customers) * 100",
  "sql": "SELECT COUNT(*) FROM customer_activity WHERE status='active'",
  "granularity": "Monthly",
  "metricType": "Percentage",
  "unit": "Percentage",
  "owner": "Data Governance Team",
  "tags": ["Customer", "KPI", "Retention"]
}
```

## Managing Metrics in OpenMetadata

- **Versioning**: Each update to a metric creates a new version, maintaining historical changes.
- **Linking**: Metrics can be linked to glossary terms, tables, dashboards, and pipelines for enriched context.
- **Monitoring**: Metrics can be monitored for value changes, enabling trend analysis over time

## Best Practices for Metric Management

- **Consistent Naming**: Use camelCase for metric names to ensure consistency across systems.
- **Clear Definitions**: Provide comprehensive descriptions and units for accurate interpretation.
- **Lineage Tracking**: Always associate metrics with source tables and pipelines for traceability.
- **Ownership**: Assign metric owners for accountability and maintenance.
