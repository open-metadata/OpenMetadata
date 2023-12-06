---
title: Set Up Data Insights Ingestion 
slug: /how-to-guides/data-insights/ingestion
---

# Set Up Data Insights Ingestion

Admin users can set up a data insights ingestion pipeline right from the OpenMetadata UI.

- Navigate to **Settings >> OpenMetadata >> Data Insights**.
- Click on **Add Data Insights Ingestion**.

{% image
src="/images/v1.1/how-to-guides/insights/di1.png"
alt="Set Up Data Insights Ingestion"
caption="Set Up Data Insights Ingestion"
/%}

- A default name is generated for the ingestion pipeline. You can leave it as it is or edit the name as required.
- You can choose to enable the Debug Log.

{% image
src="/images/v1.1/how-to-guides/insights/di2.png"
alt="Set Up Data Insights Ingestion"
caption="Set Up Data Insights Ingestion"
/%}

- Choose a schedule execution time for your workflow. The schedule time is displayed in UTC. We recommend running this workflow overnight or when activity on the platform is at its lowest to ensure accurate data. It is scheduled to run daily.
- Click on **Add & Deploy**.

{% image
src="/images/v1.1/how-to-guides/insights/di3.png"
alt="Set Up Data Insights Ingestion Schedule"
caption="Set Up Data Insights Ingestion Schedule"
/%}

{% image
src="/images/v1.1/how-to-guides/insights/di4.png"
alt="Data Insights Ingestion Created and Deployed"
caption="Data Insights Ingestion Created and Deployed"
/%}

Navigate to the Insights page. You should see your [Data Insights Reports](/how-to-guides/data-insights/report). Note that if you have just deployed OpenMetadata, App Analytics data might not be present. App Analytics data is fetched from the previous day (UTC).

{%inlineCallout
  color="violet-70"
  bold="Key Performance Indicators (KPI)"
  icon="MdArrowForward"
  href="/how-to-guides/data-insights/kpi"%}
  Define the KPIs and set goals for documentation, and ownership.
{%/inlineCallout%}