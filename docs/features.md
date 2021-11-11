---
description: >-
  OpenMetadata includes a rapidly growing set of features to address common
  needs in data discovery, quality, observability, and collaboration.
---

# Features

### Discover Your Data

OpenMetadata enables you to discover your data using a variety of strategies, including: keyword search, data associations (e.g., frequently joined tables, lineage), and complex queries. Using OpenMetadata you can search across tables, topics, dashboards, pipelines, and services. The OpenMetadata standard and discovery UI provides for fine-grained and detailed metadata for assets and a their components (e.g., columns, charts), including support for complex data types such as arrays and structs.

#### Keyword Search

Find assets based on name, description, component metadata (e.g., for columns, charts), and the containing service.

![](.gitbook/assets/asset-discovery-features.gif)

#### Discover Data through Association

Discover assets through frequently joined tables and columns as measured by the data profiler. You can also discover assets through relationships based on data lineage.

![](.gitbook/assets/discover-association.gif)

#### Advanced Search

Find assets matching strict criteria on metadata properties and Boolean operators.

![](.gitbook/assets/complex-queries.gif)

### Know Your Data

Add descriptions and tags to tables, columns, and other assets. OpenMetadata indexes assets based on descriptions, tags, names, and other metadata to enable keyword, advanced search, and filtering to enable you and others in your organization to discover your data.

![](.gitbook/assets/descriptions-tags.gif)

### Complex Data Types

Add descriptions and tags to nested fields in complex data types like arrays and structs. Locate these assets using keyword search or advanced search.

![](.gitbook/assets/complex-data-types.gif)

### Importance & Owners

Tier tags enable you to annotate assets with their importance relative to other assets. The Explore UI enables you to filter assets based on importance.

Use ownership metadata to determine the primary points of contact for any assets of interest in order to get help with any questions you might have.

#### Filter Assets by Importance

User Tier tags and usage data to identify the relative importance of data assets.

![](<.gitbook/assets/asset-importance (1).gif>)

#### Identify Asset Owners

Identify owners who can help with questions about an asset.

![](.gitbook/assets/asset-owners.gif)

### Data Lineage

Trace the path of data across tables, pipelines, and dashboards.

![](.gitbook/assets/lineage-feature.gif)

### Data Reliability

Build trust in your data by creating tests to monitor that the data is complete, fresh, and accurate.

#### Data Profiler

Enable the data profiler to capture table usage statistics over a period of time. This happens as part of metadata ingestion. Data profiles enable you to check for null values in non-null columns, for duplicates in a unique column, etc. You can gain a better understanding of column data distributions through descriptive statistics provided.

![](.gitbook/assets/data-profiler-feature.gif)

### Service Connectors

Integrate your database, dashboard, messaging, and pipeline services with OpenMetadata.

![](.gitbook/assets/connectors-feature.gif)

See the [Connectors](install/metadata-ingestion/connectors/) documentation for information on available connectors and how to integrate your services with OpenMetadata.
