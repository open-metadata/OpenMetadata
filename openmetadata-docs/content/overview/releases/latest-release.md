---
title: Latest Release
slug: /overview/latest-release
---


# [0.13.1 Release](https://github.com/open-metadata/OpenMetadata/releases/tag/0.13.1-release) - Dec 20th 2022 🎉
## Profiler and Data Quality
- Freshness Metric has been introduced. Data freshness shows DML operations performed against a table and the number of rows affected. All this is displayed within the data profiler with filterable graphs. This is currently supported for BigQuery, Snowflake, and Redshift.
- Support has been added for data quality tests on Data Lake.
- UI has been improved to show table and column profile data on seperate page. Legend is now selectable to filter for specific metrics

## Alerts and Notification
The logic for Notification Support has been improved. Users can define Alerts based on a Trigger (all data assets or a specific entity), Filters (events to consider), and Action (Slack, MS Teams, Email, Webhook) on where to send the alert.

## Ingestion
Now, DBT has its own workflow. Previously, DBT  was a part of metadata ingestion workflow.

## General Improvements
- Users can update the description and tags for Topic Schema. Previously, the topic schemas were read-only. We now support Avro/Protobuf parsing and field level details for topic schemas.
- The layout for the Data Insight  Report has been improved. We now display a line graph instead of a bar graph. The Most Viewed Data Assets are clickable to view the asset details page.
- Improvements have been made to Advanced Search. Now, when a filter is applied, the details of the filter selected are displayed for clarity.
- On the Explore page UI, the Side Preview is now available for all data assets. Previously it was only displayed for tables.

