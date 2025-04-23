---
title: Resolving Data Insights and KPI Display Issues in OpenMetadata
slug: /how-to-guides/admin-guide/data-insights
---

# Data Insights Application (Troubleshooting)

If you are experiencing any of the following  issues in Data Insights Application, follow the steps below to diagnose and resolve the problem.

- Insights menu returns no results.
- KPI charts do not display.
- Data Insights reports show no data.
- Filtering by "Yesterday" or "Last 3 Days" yields no results.

## Troubleshooting Steps

### 1. Verify Data Insights Application Installation

Ensure that the **Data Insights** application is installed:

- Navigate to `Settings` > `Applications`.
- Check if **Data Insights Application** is listed.

{% image
src="/images/v1.7/how-to-guides/admin-guide/data-insights1.png"
alt="Data Insights Application"
caption="Data Insights Application"
/%}

- If not, click `Add Apps` and install **Data Insights Application**.

{% image
src="/images/v1.7/how-to-guides/admin-guide/data-insights2.png"
alt="Add Apps"
caption="Add Apps"
/%}

### 2. Run the Data Insights Application

- Click `Configure` to set parameters.

{% image
src="/images/v1.7/how-to-guides/admin-guide/data-insights3.png"
alt="Configure to set parameters"
caption="Configure to set parameters"
/%}

- Click `Schedule` to define execution timing.

{% image
src="/images/v1.7/how-to-guides/admin-guide/data-insights4.png"
alt="Schedule"
caption="Schedule"
/%}

- Click `Run Now` to execute the Data Insights workflow.

{% image
src="/images/v1.7/how-to-guides/admin-guide/data-insights5.png"
alt="Data Insights workflow"
caption="Data Insights workflow"
/%}

### 3. Enable Backfill and Recreate Index Options

When configuring the Data Insights application:

- Enable **Backfill Configuration**.

{% image
src="/images/v1.7/how-to-guides/admin-guide/data-insights6.png"
alt="Backfill Configuration"
caption="Backfill Configuration"
/%}

- Enable **Recreate DataInsights DataAssets Index**.

This will backfill historical data and recreate the index for accurate chart rendering.
