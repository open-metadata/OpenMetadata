---
title: Custom Metrics
slug: /how-to-guides/data-quality-observability/profiler/custom-metrics
---

# Custom Metrics
Custom metrics in OpenMetadata enhance profiling capabilities by enabling users to define and compute unique business metrics using custom SQL queries. These metrics can be added at both the table and column levels, allowing tailored analysis specific to organizational needs. Once defined, custom metrics are incorporated into the profiler workflow, and their computed values are displayed alongside system metrics in the table and column profiles. This feature provides a flexible way to track specific data insights, empowering users to gain deeper visibility into their datasets.

## Table-Level Metrics

- Navigate to the **Database** and switch to the **Data Observability** tab. Click on **Table Profile**, and on the right-hand side, select the **Add** option to access the custom metric feature.

{% image
  src="/images/v1.8/features/ingestion/workflows/profiler/custom-metric1.png"
  alt="Click Add Custom Metric"
  caption="Click Add Custom Metric"
 /%}

- Enter a meaningful name for the custom metric and input the required SQL query based on your data requirements.

{% image
  src="/images/v1.8/features/ingestion/workflows/profiler/custom-metric2.png"
  alt="Input SQL query"
  caption="Input SQL query"
 /%}

- Once the custom metric is defined, run the **Profiler Agent** in the **Database Services**.

{% image
  src="/images/v1.8/features/ingestion/workflows/profiler/custom-metric3.png"
  alt="Run Profiler Agent"
  caption="Run Profiler Agent"
 /%}

- After running the profiler agent, return to the same dataset to view the computed custom metric within the table profile.

{% image
  src="/images/v1.8/features/ingestion/workflows/profiler/custom-metric4.png"
  alt="View Custom Metric"
  caption="View Custom Metric"
 /%}

## Column-Level Metrics

- Navigate to the **Database** and switch to the **Data Observability** tab. Click on **Column Profile**, and on the right-hand side, select the **Add** option to access the custom metric feature.

{% image
  src="/images/v1.8/features/ingestion/workflows/profiler/custom-metric1.png"
  alt="Click Add Custom Metric"
  caption="Click Add Custom Metric"
 /%}

- After clicking on Custom Metric, provide a name, select column name, and define the SQL query.

{% image
  src="/images/v1.8/features/ingestion/workflows/profiler/column-metric2.png"
  alt="Run Profiler Agent"
  caption="Run Profiler Agent"
 /%}

- Save and run the profiler workflow to generate the metric.

{% image
  src="/images/v1.8/features/ingestion/workflows/profiler/column-metric3.png"
  alt="Run Profiler Agent"
  caption="Run Profiler Agent"
 /%}

- After running the profiler agent, return to the same dataset to view the computed custom metric within the column profile.

{% image
  src="/images/v1.8/features/ingestion/workflows/profiler/column-metric4.png"
  alt="View Custom Metric"
  caption="View Custom Metric"
 /%}
