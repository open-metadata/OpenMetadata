---
description: >-
  Here you can find information about the supported metrics for the different
  types.
---

# Metrics

A Metric is a computation that we can run on top of a Table or Column to receive a value back. They are the primary **building block** of OpenMetadata's Profiler.

* **Metrics** define the queries and computations generically. They do not aim at specific columns or database dialects. Instead, they are expressions built with SQLAlchemy that should run everywhere.
* A **Profiler** is the binding between a set of metrics and the external world. The Profiler contains the Table and Session information and is in charge of executing the metrics.
* A **Test Case** adds logic to the Metrics results. A Metric is neither good nor wrong, so we need the Test definitions to map results into Success or Failures.

On this page, you will learn all the metrics that we currently support and their meaning.

> Note that you can check the definition of the `columnProfile` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json#L271). On the other hand, the metrics are implemented [here](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/orm\_profiler/metrics).

We will base all the namings on the definitions on the JSON Schemas.

## Table Metrics

Those are the metrics computed at the Table level.

### Row Count

It computes the number of rows in the Table.

### Column Count

Returns the number of columns in the Table.

## Column Metrics

List of Metrics that we run for all the columns.

> Note that for now we are not supporting complex types such as ARRAY or STRUCT. The implementation will come down the road.

### Values Count

It is the total count of the values in the column. Ignores nulls.

### Values Percentage

Percentage of values in this column vs. the Row Count.

### Duplicate Count

Informs the number of rows that have duplicated values in a column. We compute it as `count(col) - count(distinct(col))`.

### Null Count

The number of null values in a column.

### Null Proportion

It shows the ratio of null values vs. the total number of values in a column.

### Unique Count

The number of unique values in a column, those that appear only once. E.g., `[1, 2, 2, 3, 3, 4] => [1, 4] => count = 2`.

### Unique Proportion

Unique Count / Values Count

### Distinct Count

The number of different items in a column. E.g., `[1, 2, 2, 3, 3, 4] => [1, 2, 3, 4] => count = 4`.

### Distinct Proportion

Distinct Count / Values Count

### Min

Only for numerical values. Returns the minimum.

### Max

Only for numerical values. Returns the maximum.

### Min Length

Only for concatenable values. Returns the minimum length of the values in a column.

### Max Length

Only for concatenable values. Returns the maximum length of the values in a column.

### Mean

* Numerical values: returns the average of the values.
* Concatenable values: returns the average length of the values.

### Sum

Only for numerical values. Returns the sum of all values in a column.

### Standard Deviation

Only for numerical values. Returns the standard deviation.

### Histogram

The histogram returns a dictionary of the different bins and the number of values found for that bin.

## Reach out!

Is there any metric you'd like to see? Open an [issue](https://github.com/open-metadata/OpenMetadata/issues/new/choose) or reach out on [Slack](https://slack.open-metadata.org).

