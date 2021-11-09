---
description: >-
  OpenMetadata includes a rapidly growing set of features to address common
  needs in data discovery, quality, observability, and collaboration.
---

# Features

### Discover Your Data

Discover your data through keyword search, associated data (e.g., frequently joined tables, lineage), and complex queries. OpenMetadata supports discovery across tables, topics, dashboards, pipelines, and a their components (e.g., columns, charts) through metadata annotations and data profiling. OpenMetadata includes support for discovery based on complex data types such as arrays and structs.

#### Keyword Search

Find assets based on name, description, component metadata (e.g., for columns, charts), and the containing service.

![](../.gitbook/assets/asset-discovery-features.gif)

For more details see the documentation on [Discover Your Data.](discover-your-data.md)

#### Discover Data through Association

Discover assets through frequently joined tables and columns as measured by the data profiler. You can also discover assets through relationships based on data lineage.

![](../.gitbook/assets/discover-association.gif)

#### Complex Queries

Find assets matching strict criteria on metadata properties and Boolean operators.

![](../.gitbook/assets/complex-queries.gif)

For more details on asset metadata properties, please see the documentation on [Discover Your Data.](discover-your-data.md)

#### Support for Complex Data Types

Add descriptions and tags to nested fields in complex data types like arrays and structs. Locate these assets using keyword search or complex queries.

![](../.gitbook/assets/complex-data-types.gif)

### Importance & Owners

Tier tags enable you to annotate assets with their importance relative to other assets. The Explore UI enables you to filter assets based on importance.&#x20;

Use ownership metadata to determine the primary points of contact for any assets of interest in order to get help with any questions you might have.

#### Filter Assets by Importance

User Tier tags and usage data to identify the relative importance of data assets.&#x20;

![](<../.gitbook/assets/asset-importance (1).gif>)

#### Identify Asset Owners

Identify owners who can help with questions about an asset.

![](../.gitbook/assets/asset-owners.gif)

### Data Lineage

Trace the path of data across tables, pipelines, and dashboards.

![](../.gitbook/assets/lineage-feature.gif)

### Data Reliability

Build trust in your data by creating tests to monitor that the data is complete, fresh, and accurate.

#### Data Profiler

Enable the data profiler through metadata ingestion to capture the profile of tables over a period of time. This will help your users check for null values in non-null columns, for duplicates in a unique column, etc. Understand column data distributions through min, max, mean.

![](../.gitbook/assets/data-profiler-feature.gif)

### Service Connectors

Integrate your database, dashboard, messaging, and pipeline services with OpenMetadata.

![](../.gitbook/assets/connectors-feature.gif)

See the [Connectors](../install/metadata-ingestion/connectors/) documentation for information on available connectors and how to integrate your services with OpenMetadata.
