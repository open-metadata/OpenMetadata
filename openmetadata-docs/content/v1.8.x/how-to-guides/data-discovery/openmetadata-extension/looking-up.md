---
title: Looking Up Data Assets and Accessing Details
slug: /how-to-guides/data-discovery/openmetadata-extension/looking-up
---

# Looking Up Data Assets and Accessing Details

The OpenMetadata Chrome extension allows users to easily look up data assets and access detailed metadata directly from their web browser. This feature provides instant access to essential information about data assets, enabling users to better understand the data they are working with without leaving their current context.

##Looking up data assets using data tools

- The extension is also compatible with data tools like Tableau, allowing you to view detailed metadata for each data asset.
- When you select an asset, the extension provides a detailed view, including:
  - **Ownership**: Know who is responsible for the data asset.
  - **Description**: Get a brief overview of what the asset is and its purpose.
  - **Tags and Glossary Terms**: Understand the categorization and related business terms associated with the asset.
  - **Schema Information**: View the structure of the data asset, such as table columns or dashboard charts.
  - **Lineage**: See data flow and dependencies, helping you understand the asset's origins and relationships with other data assets.
  - **Custom Properties**: Access any additional metadata that has been defined for the asset.

{% image
src="/images/v1.8/how-to-guides/discovery/looking-up-data.png"
alt="Looking Up Data Assets"
caption="Looking Up Data Assets"
/%}

## Looking up data assets using the browse feature

### 1. Search for the Keyword in the Browser
Open a web browser and perform a search for the keyword or term you want to look up.

{% image
src="/images/v1.8/how-to-guides/discovery/browser-extension-1.png"
alt="Search for the Keyword in the Browser"
caption="Search for the Keyword in the Browser"
/%}

### 2. Select the Desired Text
After finding the relevant information, highlight the specific text or term.

### 3. Right-Click on the Selected Text
Open the context menu by right-clicking on the highlighted text.

### 4. Choose "Search in OpenMetadata"
Click on the "Search in OpenMetadata" option from the context menu.

{% image
src="/images/v1.8/how-to-guides/discovery/browser-extension-2.png"
alt="Search in OpenMetadata"
caption="Search in OpenMetadata"
/%}

### 5. View Search Results in OpenMetadata
The extension will initiate a search in OpenMetadata and display results based on the selected text. The search results may include:

- **Glossary Terms**: Definitions, descriptions, and related business terms.
- **Tables**: Information about database tables, including schema, ownership, and descriptions.
- **Topics**: Relevant topics or subject areas in the data catalog.
- **Stored Procedures**: Details about database procedures, including usage and associated documentation.
- **Ingestion Pipelines**: Information about data pipelines, including statuses and configurations.
- **Dashboards**: Metadata for analytics dashboards, including ownership, tags, and lineage.

{% image
src="/images/v1.8/how-to-guides/discovery/browser-extension-3.png"
alt="View Search Results in OpenMetadata"
caption="View Search Results in OpenMetadata"
/%}

### 6. Explore the Search Results
Click on any result to view detailed metadata, including descriptions, tags, schema details, ownership, and lineage information. Use this information to gain insights into the data asset and understand its relevance to your current context.

{% image
src="/images/v1.8/how-to-guides/discovery/browser-extension-4.png"
alt="Explore the Search Results"
caption="Explore the Search Results"
/%}

## Best Practices

- **Pin the Extension for Easy Access**: Pinning the OpenMetadata extension ensures that it is readily accessible whenever you need to view activity feeds, manage tasks, or look up data assets.
- **Regularly Check Activity Feeds**: Use the extension to stay updated on data-related activities, ensuring you are aware of any changes, comments, or updates to your data assets.
- **Resolve Tasks as Soon as Possible**: Managing and completing tasks directly from the extension helps maintain data quality and governance by ensuring that assigned tasks are addressed promptly.
- **Use the Lookup Feature for Quick Data Insights**: Leverage the lookup feature to get instant access to data asset details, making it easier to understand data context without switching between different tools.
