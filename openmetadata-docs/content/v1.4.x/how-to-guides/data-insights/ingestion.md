---
title: Set Up Data Insights Ingestion 
slug: /how-to-guides/data-insights/ingestion
---

# Set Up Data Insights Ingestion

Admin users can set up a data insights ingestion pipeline right from the OpenMetadata UI.

- Navigate to **Settings >> Applications**. If the data insights application does not show up, click on **Add Apps**

{% image
src="/images/v1.4/how-to-guides/insights/apps.png"
alt="Add Apps"
caption="Add Apps"
/%}

- Click on read more for **Data Insights** application.

{% image
src="/images/v1.4/how-to-guides/insights/apps2.png"
alt="Data Insights Application"
caption="Data Insights Application"
/%}

- Install the Data Insights application.
{% image
src="/images/v1.4/how-to-guides/insights/di.png"
alt="Install Data Insights"
caption="Install Data Insights"
/%}

- To authorize data insights app, click on **Schedule**.

{% image
src="/images/v1.4/how-to-guides/insights/di5.png"
alt="Schedule Data Insights"
caption="Schedule Data Insights"
/%}

- Choose a schedule execution time for your workflow. The schedule time is displayed in UTC. We recommend running this workflow overnight or when activity on the platform is at its lowest to ensure accurate data. It is scheduled to run daily. Click on **Submit**.

{% image
src="/images/v1.4/how-to-guides/insights/di6.png"
alt="Set Up Data Insights Ingestion Schedule"
caption="Set Up Data Insights Ingestion Schedule"
/%}

This will successfully install the Data Insights application. Click on **Configure** to view the details.

{% image
src="/images/v1.4/how-to-guides/insights/apps3.png"
alt="Installed the Data Insights Application"
caption="Installed the Data Insights Application"
/%}

- Click on **Deploy** to setup the ingestion pipeline.

{% image
src="/images/v1.4/how-to-guides/insights/dpy.png"
alt="Deploy the Data Insights Pipeline"
caption="Deploy the Data Insights Pipeline"
/%}

- You can also **Edit** the ingestion schedule. The ingestion pipeline can also be run on demand by clicking on **Run now**. You can view the **History** tab for details on when the ingestion was last run.

{% image
src="/images/v1.4/how-to-guides/insights/history.png"
alt="History of the Data Insights Pipeline"
caption="History of the Data Insights Pipeline"
/%}

Navigate to the Insights page. You should see your [Data Insights Reports](/how-to-guides/data-insights/report). Note that if you have just deployed OpenMetadata, App Analytics data might not be present. App Analytics data is fetched from the previous day (UTC).

{%inlineCallout
  color="violet-70"
  bold="Key Performance Indicators (KPI)"
  icon="MdArrowForward"
  href="/how-to-guides/data-insights/kpi"%}
  Define the KPIs and set goals for documentation, and ownership.
{%/inlineCallout%}