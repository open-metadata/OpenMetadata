---
title: Service Insights
slug: /how-to-guides/data-insights/service-insights
---

# Service Insights

Users can view insights for individual services using the Service Insights tab. This guide provides an overview of the available charts and outlines troubleshooting steps when no data is displayed.

## Total Data Assets

This chart displays the total number of data assets within a service, categorized by asset type. For example, in a database service, it shows the count of tables, databases, database schemas, and stored procedures.

{% note %}

If no data is displayed, ensure that the metadata ingestion pipeline has been executed successfully.

{% /note %} 

## Description Coverage

This chart shows the percentage of data assets that have a populated description field.

{% note %}

If no data is displayed, verify that both the metadata ingestion pipeline and the data insights pipeline have been executed successfully.

{% /note %} 

## PII Coverage

This chart displays the percentage of data assets containing columns tagged with Personally Identifiable Information (PII) tags.

{% note %}

If the chart does not show any data, ensure that both the Auto Classification pipeline and the Data Insights pipeline have been successfully executed.

{% /note %}

## Tier Coverage

This chart displays the percentage of data assets where tier classification has been populated.

{% note %}

If the chart shows no data, verify that the Auto Tiering pipeline (Collate only) and the Data Insights pipeline have been executed successfully.

{% /note %}

# Generated Data with Collate AI (Collate Only)

This table displays a breakdown of metadata populated by the Collate AI agent versus metadata populated manually.

{% note %}

If the table shows no data, ensure that the Auto Classification pipeline, Auto Data Quality (DQ) pipeline, Auto Tiering pipeline, Collate AI application, and Data Insights application have been executed successfully.

{% /note %}

# PII Distribution

This table displays a breakdown of data assets categorized by their associated PII (Personally Identifiable Information) tags.

{% note %}

If the table shows no data, verify that both the Auto Classification pipeline and the Data Insights application have been executed successfully.

{% /note %}

# Tier Distribution

This table provides a breakdown of data assets based on their assigned Tier classification.

{% note %}

If the table displays no data, ensure that the Auto Tiering pipeline (Collate only) and the Data Insights application have been executed successfully.

{% /note %}

# Most Used Data Assets

This table displays the top five most frequently accessed data assets, determined by their usage percentile.

{% note %}

If the table shows no data, verify that the usage pipeline has been executed successfully.

{% /note %}

# Most Expensive Queries

This table displays the top queries based on the cost of query execution.

{% note %}

If the table shows no data, verify that the usage pipeline has been executed successfully. Additionally, not all connectors support extracting query cost—ensure that your connector supports this feature.

{% /note %}
