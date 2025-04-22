---
title: How to Discover Assets of Interest
slug: /how-to-guides/data-discovery/discover
---

# How to Discover Assets of Interest

OpenMetadata simplifies data discovery with the following strategies.

## Search
Search is at the front and center of OpenMetadata and is available in the top Menu bar across all the different pages. Users can also start searching by invoking the Keyboard shortcut Ctrl + K in Windows or Cmd + K in Mac OS.

The Search APIs are backed by Elasticsearch.

## Keyword Search
A simple yet powerful way to find assets by typing the name or description from the search interface. The search suggest will display matching data assets in several categories. Your query will retrieve all matching tables, topics, dashboards, pipelines, ML models, containers, glossaries, and tags. Your queries will match names for data assets and their components, such as column names for tables and chart names for dashboards. The queries will also match the descriptions used.

{% image
src="/images/v1.7/how-to-guides/discovery/kw.png"
alt="Keyword Search"
caption="Keyword Search"
/%}

## Quick Filters
Multiple quick filter options further help to narrow down the search by **Owner, Tag, Tier, Service, Service Type**, and other filters relevant to the type of data asset like **Database, Schema, Columns**. You can also search by deleted data assets.

{% image
src="/images/v1.7/how-to-guides/discovery/kw2.png"
alt="Filter using Multiple Parameters"
caption="Filter using Multiple Parameters"
/%}

## Filter by the Type of Data Asset
The search results can be narrowed down by data assets such as Table, Topic, Dashboard, Pipeline, ML Model, Container, Glossary, or Tag.

{% image
src="/images/v1.7/how-to-guides/discovery/da1.png"
alt="Filter by the Type of Data Asset"
caption="Filter by the Type of Data Asset"
/%}

Users can navigate to the Explore page for specific type of data assets and use the filter options relevant to that data asset to narrow down the search.

## Filter by Asset Owner
A team or a user can own the data asset in OpenMetadata. Users can filter data assets by the asset owner. With information on the data asset owners, you can direct your questions to the right person or team.

{% image
src="/images/v1.7/how-to-guides/discovery/owner.png"
alt="Filter by Asset Owner"
caption="Filter by Asset Owner"
/%}

## Filter by Database
When searching while you are in a database page, you can narrow down your search to within the database or to include the overall search results within OpenMetadata.

{% image
src="/images/v1.7/how-to-guides/discovery/db.png"
alt="Filter by Database"
caption="Filter by Database"
/%}

## Filter based on Importance: Tiers
Using tiers, you can search for data based on importance.

{% image
src="/images/v1.7/how-to-guides/discovery/tier.png"
alt="Filter based on Importance using Tiers"
caption="Filter based on Importance using Tiers"
/%}

## Filter based on Importance: Usage
OpenMetadata captures usage profiles for tables during metadata/profiler ingestion. This helps to learn how other data consumers are using the tables. You can use the quick filter to narrow down the search results by relevance by clicking on the down arrow on the top right of the Explore page. You can search for data by:
- **Last Updated** - Filter data by the recent updates and changes.
- **Weekly Usage** - Based on the data asset usage metrics.
- **Relevance**

These details are based on the usage summary computations. Further, you can **sort** the results by ascending and descending order.

{% image
src="/images/v1.7/how-to-guides/discovery/usage.png"
alt="Filter based on Importance: Usage"
caption="Filter based on Importance: Usage"
/%}

## Discover Data through Association
OpenMetadata provides the links to the frequently joined tables and columns as measured by the data profiler. You can also discover assets through relationships based on data lineage.

{% image
src="/images/v1.7/how-to-guides/discovery/fjt.png"
alt="Frequently Joined Tables"
caption="Frequently Joined Tables"
/%}

## Discover Assets through Relationships
OpenMetadata helps to locate assets of interest by tracing data lineage. You can view the upstream and downstream nodes to discover the sources of data and learn about the tables, pipelines, and more. The table and column descriptions help to decide if the data is helpful for your use case. Similarly, the pipeline description helps to uncover the transformation and more data of interest.

{% image
src="/images/v1.7/how-to-guides/discovery/lineage.png"
alt="Discover Assets through Relationships: Lineage"
caption="Discover Assets through Relationships: Lineage"
/%}

## Advanced Search
Users can find data assets matching strict criteria by multiple parameters on metadata properties, using the **syntax editor** with and/or conditions. Advanced search in OpenMetadata supports Boolean operators and faceted queries to search for specific facets of your data. Separate advanced search options are available for Tables, Topics, Dashboards, Pipelines, ML Models, Containers, Glossary, and Tags.

{% image
  src="/images/v1.7/how-to-guides/discovery/data-discovery.gif"
/%}

## Discover Data Evolution
By viewing lineage and metadata versioning, users can discover the data evolution of data assets.

{% image
src="/images/v1.7/how-to-guides/discovery/version.png"
alt="Discover Data Evolution: Version History"
caption="Discover Data Evolution: Version History"
/%}

## Filter by Deleted Data Assets
Users can also search for the soft-deleted data assets in OpenMetadata. Use the toggle bar to search for deleted assets. The deleted data assets are read-only.

{% image
src="/images/v1.7/how-to-guides/discovery/deleted.png"
alt="Filter by Deleted Data Assets"
caption="Filter by Deleted Data Assets"
/%}

Users can click on **Clear** to unselect all the filter options.
{% image
src="/images/v1.7/how-to-guides/discovery/clear.png"
alt="Clear the Filters"
caption="Clear the Filters"
/%}

{%inlineCallout
  color="violet-70"
  bold="Get a Quick Glance of the Data Assets"
  icon="MdArrowForward"
  href="/how-to-guides/data-discovery/preview"%}
  Quick preview of the selected data asset.
{%/inlineCallout%}