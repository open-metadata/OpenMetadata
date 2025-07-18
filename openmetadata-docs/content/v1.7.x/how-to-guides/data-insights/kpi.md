---
title: Key Performance Indicators (KPI) | Official Documentation
description: Track key KPIs and data quality signals for datasets, services, and domains through governance dashboards.
slug: /how-to-guides/data-insights/kpi
---

# Key Performance Indicators (KPI)

Admins can define the Key Performance Indicators (KPIs) and set goals within OpenMetadata to work towards **better documentation, ownership, and tiering**. These goals are based on data assets and driven to achieve targets within a specified timeframe. For example, Admins can set goals to have at least 60% of the entities documented, owned and tiered by the end of Q4 2023.

The data insights feature in OpenMetadata helps organizations to decentralize documentation and ownership of data assets. Organizations can drive the adoption of OpenMetadata by setting up company-wide KPIs to track the documentation, ownership, and tiering of data assets.

## KPI Categories

OpenMetadata currently supports the following KPI Categories.

**Completed Description:** This KPI measures the description coverage of your data assets in OpenMetadata. You can choose an absolute (number) or a relative (percentage) value.

**Completed Ownership:** This KPI measures the ownership coverage of your data assets in OpenMetadata. You can choose an absolute (number) or a relative (percentage) value.

## How to Add KPIs

When OpenMetadata is set up with data ingestion from third party sources, the details on the description, ownership, and tiering are also brought into OpenMetadata. You can track the existing documentation and ownership coverage and work towards a better data culture by setting up data insights. Configure the KPIs and set goals at an organizational level to encourage your team to get your data to a better state.

To add KPIs:
- Navigate to **Insights** and click on **Add KPI**.

{% image
src="/images/v1.7/how-to-guides/insights/kpi1.png"
alt="Add a KPI"
caption="Add a KPI"
/%}

- Enter the following details on the KPI configuration page:
  - **Select a Chart** among the available chart options.
  - Enter a **Display Name**.
  - Select the **Metric Type**, i.e., Percentage or Number. You can choose an absolute number or define a relative percentage of the data assets to be covered.
  - Select a **Start and End Date** by which to achieve the KPI target.
  - Add a **Description** to define what the KPI is about.
- Click on **Submit**.

{% image
src="/images/v1.7/how-to-guides/insights/kpi2.png"
alt="Details of the KPI"
caption="Details of the KPI"
/%}

{% image
src="/images/v1.7/how-to-guides/insights/kpi3.png"
alt="Ownership Coverage KPI Added"
caption="Ownership Coverage KPI Added"
/%}

The line graph represents the progress made on a daily basis. It also displays the days left to achieve the target and the coverage so far.

{%inlineCallout
  color="violet-70"
  bold="Data Insights Report"
  icon="MdArrowForward"
  href="/how-to-guides/data-insights/report"%}
  Get a quick glance of data asset description, ownership, and tiering coverage.
{%/inlineCallout%}