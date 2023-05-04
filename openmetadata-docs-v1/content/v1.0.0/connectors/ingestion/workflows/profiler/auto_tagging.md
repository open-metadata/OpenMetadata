---
title: Lineage Ingestion
slug: /v1.0.0/connectors/ingestion/auto_tagging
---

## Auto PII Tagging

Auto PII tagging for Sensitive/NonSensitive at the column level is performed based on the two approaches described below.

{% note %}
PII Tagging is only available during `Profiler Ingestion`.
{% /note %}


### During Profiler Ingestion
- If sample data ingestion is enabled, during the profiler workflow OpenMetadata will infer the status of a column (PII or not) based on its content.
- **Column Name Scanning** we pass the column name through a regex, which identifies credit card, email, etc.
- **Sample Data Scanning** If the column status (PII or not) cannot be parsed with regex, we will use [presidio](https://microsoft.github.io/presidio/) library, which allows OpenMetadata to determine the PII status.
- `confidence` parameter is passed to determine the minimum score required to tag the column.

