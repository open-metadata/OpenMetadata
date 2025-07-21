---
title: Set Up Data Insights Ingestion | Official Documentation
description: Monitor ingestion metrics, failures, and progress from scheduled and triggered ingestion workflows.
slug: /how-to-guides/data-insights/ingestion
---

# Set Up Data Insights Ingestion

Admin users can set up a data insights ingestion pipeline right from the OpenMetadata UI.

- Navigate to **Settings >> Applications**. If the data insights application does not show up, click on **Add Apps**

{% image
src="/images/v1.7/how-to-guides/insights/apps-1.png"
alt="Applications"
caption="Applications"
/%}

{% image
src="/images/v1.7/how-to-guides/insights/apps.png"
alt="Add Apps"
caption="Add Apps"
/%}

- Click on read more for **Data Insights** application.

{% image
src="/images/v1.7/how-to-guides/insights/apps2.png"
alt="Data Insights Application"
caption="Data Insights Application"
/%}

- Install the Data Insights application.

{% image
src="/images/v1.7/how-to-guides/insights/di.png"
alt="Install Data Insights"
caption="Install Data Insights"
/%}

- Click on **Configure** to adjust the **batch size** and other settings according to your specific requirements. To authorize the Data Insights app, proceed by clicking on **Schedule**.

{% image
src="/images/v1.7/how-to-guides/insights/di5.png"
alt="configure Data Insights"
caption="Configure Data Insights"
/%}

{% image
src="/images/v1.7/how-to-guides/insights/configure.png"
alt="Schedule Data Insights"
caption="Schedule Data Insights"
/%}

- Choose a schedule execution time for your workflow. The schedule time is displayed in UTC. We recommend running this workflow overnight or when activity on the platform is at its lowest to ensure accurate data. It is scheduled to run daily. Click on **Submit**.

{% image
src="/images/v1.7/how-to-guides/insights/di6.png"
alt="Set Up Data Insights Ingestion Schedule"
caption="Set Up Data Insights Ingestion Schedule"
/%}

This will successfully install the Data Insights application. Click on **Configure** to view the details.

{% image
src="/images/v1.7/how-to-guides/insights/apps3.png"
alt="Installed the Data Insights Application"
caption="Installed the Data Insights Application"
/%}

- Click on **Run now** to setup the ingestion pipeline.

{% image
src="/images/v1.7/how-to-guides/insights/dpy.png"
alt="Run the Data Insights Pipeline"
caption="Run the Data Insights Pipeline"
/%}

- You can also **Edit** the ingestion schedule. The ingestion pipeline can also be run on demand by again clicking on **Run now**. You can view the **Recent Runs** tab for details on when the ingestion was last run.

{% image
src="/images/v1.7/how-to-guides/insights/history.png"
alt="Recent Runs of the Data Insights Pipeline"
caption="Recent Runs of the Data Insights Pipeline"
/%}

Navigate to the Insights page. You should see your [Data Insights Reports](/how-to-guides/data-insights/report). Note that if you have just deployed OpenMetadata, App Analytics data might not be present. App Analytics data is fetched from the previous day (UTC).

{%inlineCallout
  color="violet-70"
  bold="Key Performance Indicators (KPI)"
  icon="MdArrowForward"
  href="/how-to-guides/data-insights/kpi"%}
  Define the KPIs and set goals for documentation, and ownership.
{%/inlineCallout%}