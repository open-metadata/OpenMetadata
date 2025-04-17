---
title: How to Manually Add or Edit Lineage
slug: /how-to-guides/data-lineage/manual
---

# How to Manually Add or Edit Lineage

Edit lineage to provide a richer understanding of the provenance of data. The OpenMetadata no-code editor provides a drag and drop interface. Drop tables, topics, pipelines, dashboards, ML models, containers, and pipelines onto the lineage graph. You may add new edges or delete existing edges to better represent data lineage.

OpenMetadata supports manual editing of both table and column level lineage. We can build the lineage by creating edges. You can connect the source of the lineage to the destination by connecting the nodes.

Once you have ingested your database and dashboard services.
- Start by picking one database service, and select a table. In the data asset details page, navigate to the Lineage Tab.
- Click on the Edit option to enable the lineage editor.
- Select the type of data asset (table, topic, dashboard, ML model, container, pipeline) to connect to as the destination.

{% image
src="/images/v1.7/how-to-guides/lineage/l1.png"
alt="Data Asset: Lineage Tab"
caption="Data Asset: Lineage Tab"
/%}

- Search and select the relevant data asset.
- Create an edge between these two data assets.

{% image
src="/images/v1.7/how-to-guides/lineage/l2.png"
alt="Link the Table to the Dashboard to Add Lineage Manually"
caption="Link the Table to the Dashboard to Add Lineage Manually"
/%}

- You can also expand a table to view the available columns
- Link the relevant columns together by connecting the column edges to trace column-level lineage.

{% image
src="/images/v1.7/how-to-guides/lineage/l3.png"
alt="Column-Level Lineage"
caption="Column-Level Lineage"
/%}

Here's a quick video on manually adding lineage.
{%  youtube videoId="hU8h1n_WmWg" start="00:01" end="00:23" width="800px" height="450px" /%}

Watch the recording of the Webinar on Lineage (13:30 to 15:50)
{%  youtube videoId="jEbN1tt89H0" start="13:30" end="15:48" width="800px" height="450px" /%}