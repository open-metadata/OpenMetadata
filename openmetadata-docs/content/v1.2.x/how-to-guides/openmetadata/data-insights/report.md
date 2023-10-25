---
title: Data Insights Report
slug: /how-to-guides/openmetadata/data-insights/report
---

# Data Insights Report

The data insights report provides a quick glance at aspects like data ownership, description coverage, data tiering, and so on. Admins can view the aggregated user activity and get insights into user engagement and user growth. Admins can check for Daily active users and know how the tool is being used.

OpenMetadata offers a suite of reports providing platform analytics around specific areas. The reports are available in three sections:
- Data Assets
- App Analytics
- KPIs

{% image
src="/images/v1.1/how-to-guides/insights/insights1.png"
alt="Data Insights Report"
caption="Data Insights Report"
/%}

All the reports can be filtered by **Teams, Data Tiers, and a Time Filter**.
{% image
src="/images/v1.1/how-to-guides/insights/insights2.png"
alt="Data Insights Report Filters: Team, Tier, Time"
caption="Data Insights Report Filters: Team, Tier, Time"
/%}

## Data Assets Report
The Data Asset reports display important metrics around your data assets in OpenMetadata. This report also displays the organizational health at a glance with details on the Total Data Assets, Data Assets with Description, Owners, and Tiers.

{% image
src="/images/v1.1/how-to-guides/insights/ohg.png"
alt="Organization Health at a Glance"
caption="Organization Health at a Glance"
/%}

### Total Data Assets

This chart represents the total number of data assets present in OpenMetadata. It offers a view of your data assets broken down by asset type (i.e. DatabaseSchema, Database, Dashboard, Chart, Topic, ML Model, etc.)

{% image
src="/images/v1.1/how-to-guides/insights/tda.png"
alt="Total Data Assets"
caption="Total Data Assets"
/%}

### Percentage of Data Assets with Description

It displays the percentage of data assets with description by data asset type.

{% image
src="/images/v1.1/how-to-guides/insights/pdad.png"
alt="Percentage of Data Assets with Description"
caption="Percentage of Data Assets with Description"
/%}

### Percentage of Data Assets with Owners

This chart represents the percentage of data assets present in OpenMetadata with an owner assigned. Data assets that do not support assigning an owner will not be counted in this percentage. It allows you to quickly view the ownership coverage for your data assets in OpenMetadata.

{% image
src="/images/v1.1/how-to-guides/insights/pdao.png"
alt="Percentage of Data Assets with Owners"
caption="Percentage of Data Assets with Owners"
/%}

### Total Data Assets by Tier

It displays a broken down view of data assets by Tiers. Data Assets with no tiers assigned are not included in this. It allows you to quickly view the breakdown of data assets by tier.

{% image
src="/images/v1.1/how-to-guides/insights/tdat.png"
alt="Total Data Assets by Tier"
caption="Total Data Assets by Tier"
/%}

## App Analytics

App analytics helps to track user engagement. This report provides important metrics around the usage of OpenMetadata. This report also displays the organizational health at a glance with details on the Page Views by Data Assets, Daily Active Users on the Platform, and the Most Active User.

{% image
src="/images/v1.1/how-to-guides/insights/ohg2.png"
alt="Organization Health at a Glance"
caption="Organization Health at a Glance"
/%}

### Most Viewed Data Assets

Know the 10 most viewed data assets in your platform. It offers a quick view to identify the data assets of the most interest in your organization.

{% image
src="/images/v1.1/how-to-guides/insights/mvda.png"
alt="Most Viewed Data Assets"
caption="Most Viewed Data Assets"
/%}

### Page Views by Data Assets

It helps to understand the total number of page views by asset type. This allows you to understand which asset familly drives the most interest in your organization

{% image
src="/images/v1.1/how-to-guides/insights/pvda.png"
alt="Page Views by Data Assets"
caption="Page Views by Data Assets"
/%}

### Daily Active Users on the Platform

Active users are users with at least one session. This report allows to understand the platform usage and see how your organization leverages OpenMetadata.

{% image
src="/images/v1.1/how-to-guides/insights/daup.png"
alt="Daily Active Users on the Platform"
caption="Daily Active Users on the Platform"
/%}

### Most Active Users

This report displays the most active users on the platform based on Page Views. They are the power users in your data team.

{% image
src="/images/v1.1/how-to-guides/insights/mau.png"
alt="Most Active Users"
caption="Most Active Users"
/%}

## Key Performance Indicators (KPI)

While data insights reports gives an analytical view of the OpenMetadata platform, KPIs are here to drive platform adoption. The below report displays the percentage coverage of description and ownership of the data assets.

{% image
src="/images/v1.1/how-to-guides/insights/kpi.png"
alt="Key Performance Indicators (KPI)"
caption="Key Performance Indicators (KPI)"
/%}

{%inlineCallout
  color="violet-70"
  bold="How to Transform the Data Culture of Your Company"
  icon="MdArrowForward"
  href="/how-to-guides/openmetadata/data-insights/data-culture"%}
  Improve your data culture for data-driven decision making.
{%/inlineCallout%}