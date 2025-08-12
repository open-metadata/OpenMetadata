---
title: Anomaly Detection in Collate | Automated Data Quality Alerts
slug: /how-to-guides/data-quality-observability/anomaly-detection
---

# Overview

The **Anomaly Detection** feature in Collate helps ensure data quality by automatically detecting unexpected changes, such as spikes or drops in data trends. Instead of requiring users to manually define rigid boundaries for data validation, Collate dynamically learns from your data patterns through regular profiling. This allows for more accurate and flexible anomaly detection, alerting you only when there are significant deviations that might indicate underlying issues.

## Key Benefits of Anomaly Detection

- **Automated Detection of Unexpected Data Changes**: Collate can detect unexpected data behaviors, such as spikes or drops, that deviate from normal trends. This is crucial for identifying potential issues with data pipelines, backend systems, or infrastructure.
- **Dynamic Learning**: The system continuously profiles your data over time, learning its natural variations, including seasonal fluctuations. For example, if sales data varies throughout the year due to holidays, Collate’s dynamic assertions can detect this seasonality and prevent unnecessary error alerts. This allows the system to automatically adjust to your data’s evolving patterns without requiring manual configuration.
- **Flexible Configuration**: For more controlled scenarios, users can still manually define specific boundaries or thresholds to monitor data, such as ensuring values stay within a certain range. This offers both manual and automatic methods for managing data quality.

## Use Cases

### 1. Static Assertions for Simple Tests

- **Problem**: In many cases, users want to perform straightforward data tests, such as ensuring that values are not null or that there are no repeated values.
- **Solution**: Collate enables users to configure simple assertions directly from the UI. For example, users can create tests to ensure:
  - Data should not be null.
  - There should be no duplicate values.
  - Data should not be older than a specific time frame (e.g., one day).
  - Values should be greater than zero.
- **Example**: If you want to ensure that your sales data contains no null values or duplicates, you can easily configure these assertions via the UI.

### 2. Dynamic Assertions for Evolving Data

- **Problem**: Some data, such as sales figures, naturally evolves over time. For example, sales data might fluctuate daily or weekly, and manual bounds may not accurately capture these variations.
- **Solution**: Collate uses **dynamic assertions**, which automatically learn from the data by profiling it regularly. Over time, the system establishes a pattern for how the data behaves, allowing it to detect when values significantly deviate from this expected behavior.
- **Example**: If sales suddenly spike or drop beyond what is typical for your historical data, Collate will alert you to this anomaly.

## How Anomaly Detection Works

### 1. Manual Configuration of Tests

Users can manually configure tests for specific data points if they want to maintain tight control over their data quality checks. For instance, you can specify that a value must stay between 10 and 100. This method is useful for data that has well-understood constraints or when precise validation rules are required.

{% image
  src="/images/v1.9/how-to-guides/anomaly-detection/set-up-anomaly-detection-2.png"
  alt="Manual Configuration of Tests"
  caption="Manual Configuration of Tests"
 /%}

### 2. Dynamic Assertions

For more complex or evolving datasets, Collate offers **dynamic assertions**. These assertions automatically adapt to your data by learning its natural patterns over time. The profiling process typically takes around five weeks, during which the system builds an understanding of normal data fluctuations.

- **Data Profiling**: Collate continuously scans the data and trains its models based on the profiled data. Once this learning phase is complete, the system can detect significant deviations from expected patterns, alerting users to anomalies.
  
- **Advantages of Dynamic Assertions**:
  - **Adaptability**: No need to set manual thresholds for evolving datasets.
  - **Efficiency**: Focus on genuine anomalies instead of managing static tests that may quickly become outdated as data evolves.

{% image
  src="/images/v1.9/how-to-guides/anomaly-detection/set-up-anomaly-detection-3.png"
  alt="Dynamic Assertions"
  caption="Dynamic Assertions"
 /%}

### 3. Incidents and Notifications

When an anomaly is detected, Collate automatically generates incidents, including for rule-based test cases. These notifications help users quickly understand when and where their data may be behaving unexpectedly.

- **Example**: If sales data suddenly shows an abnormal spike or drop, Collate will notify you, allowing you to investigate potential causes such as system malfunctions or external influences.

{% image
  src="/images/v1.9/how-to-guides/anomaly-detection/set-up-anomaly-detection-4.png"
  alt="Incidents and Notifications"
  caption="Incidents and Notifications"
 /%}
