---
title: Service Insights Overview | Official Documentation
description: Explore service-level insights including ownership, usage, and performance metrics from data assets.
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

## Ownership coverage

This chart shows the percentage of data assets that have a populated owner field.

{% note %}

If no data is displayed, verify that both the metadata ingestion pipeline and the data insights pipeline have been executed successfully.

{% /note %}

{% image
src="/images/v1.7/how-to-guides/insights/service-insights1.png"
alt="Platform Insights"
caption="Platform Insights"
/%}

{% collateContent %}

# Generated Data with Collate AI (Collate Only)

This table displays a breakdown of metadata populated by the Collate AI agent versus metadata populated manually.

{% note %}

If the table shows no data, ensure that the Auto Classification pipeline, Auto Data Quality (DQ) pipeline, Auto Tiering pipeline, Collate AI application, and Data Insights application have been executed successfully.

{% /note %}

{% image
src="/images/v1.7/how-to-guides/insights/service-insights2.png"
alt="Generated Data with Collate AI"
caption="Generated Data with Collate AI"
/%}

## PII Distribution

This table displays a breakdown of data assets categorized by their associated PII (Personally Identifiable Information) tags.

{% note %}

If the table shows no data, verify that both the Auto Classification pipeline and the Data Insights application have been executed successfully.

{% /note %}

## Tier Distribution

This table provides a breakdown of data assets based on their assigned Tier classification.

{% note %}

If the table displays no data, ensure that the Auto Tiering pipeline (Collate only) and the Data Insights application have been executed successfully.

{% /note %}

{% image
src="/images/v1.7/how-to-guides/insights/service-insights3.png"
alt="PII & Tier Distribution"
caption="PII & Tier Distribution"
/%}

## Most Used Data Assets

This table displays the top five most frequently accessed data assets, determined by their usage percentile.

{% note %}

If the table shows no data, verify that the usage pipeline has been executed successfully.

{% /note %}

{% image
src="/images/v1.7/how-to-guides/insights/service-insights4.png"
alt="Most Used Data Assets"
caption="Most Used Data Assets"
/%}

## Most Expensive Queries

This table displays the top queries based on the cost of query execution.

{% note %}

If the table shows no data, verify that the usage pipeline has been executed successfully. Additionally, not all connectors support extracting query cost—ensure that your connector supports this feature.

{% /note %}

{% image
src="/images/v1.7/how-to-guides/insights/service-insights5.png"
alt="Most Expensive Queries"
caption="Most Expensive Queries"
/%}

## Data Quality

This chart shows the percentage of data assets that have one or more data quality tests configured.

{% note %}

If no data is displayed, verify that the data quality pipeline and the data insights pipeline have been executed successfully.

{% /note %}

{% image
src="/images/v1.7/how-to-guides/insights/service-insights6.png"
alt="Data Quality"
caption="Data Quality"
/%}

{% /collateContent %}
