---
title: Reverse Metadata
slug: /applications/reverse-metadata
collate: true
---

# Reverse Metadata Application

{% youtube videoId="EWYDfhCgW8k" start="0:00" end="2:16" width="800px" height="450px" /%}

The **Reverse Metadata Application** enables seamless synchronization of metadata updates made in **Collate** back to the original data sources.  
This ensures that Collate remains the single source of truth for metadata while maintaining consistency across platforms and reinforcing governance policies.

## Overview

With this application, you can automatically propagate metadata changes such as:

- **Descriptions**
- **Owners**
- **Tags** (e.g., PII-sensitive classifications)

These updates are pushed directly to supported data source systems, including **Snowflake**, enabling real-time enforcement of data governance controls such as masking policies.

## Key Features

- **Automated Metadata Propagation:**  
  Sync metadata updates (tags, owners, descriptions) from Collate to source systems without manual intervention.

- **Configurable Channels:**  
  Define multiple sync channels to target different services, asset types, or metadata types.

- **Custom SQL Templates:**  
  Use SQL templates to customize update behavior per connector.

- **On-Demand or Scheduled Execution:**  
  Run synchronization workflows manually or on a predefined schedule.

## Installation

1. Navigate to **Settings > Applications**.

{% image
src="/images/v1.9/applications/autopilot.png"
alt="Install Reverse Metadata Application"
caption="Install Reverse Metadata Application"
/%}

2. Click **Add Apps** and install the **Reverse Metadata Application**.
3. After installation, configure the synchronization channels as described below.

{% image
src="/images/v1.9/applications/reverse/reverse-metadata-application.png"
alt="Configuration"
caption="Configuration"
/%}

## Channel Configuration

Each sync process is managed through a **channel**.  
You can define multiple channels for different services or metadata types.

| Field              | Description |
|:--------------------|:------------|
| **Channel Name**     | A name for identifying the sync channel. |
| **Filter**           | Use the UI Query Filter Builder to define the scope of the metadata updates. You can filter by properties such as service, schema, database, owner, domain, or custom attributes. |
| **Update Descriptions** | Enable to sync updated entity descriptions from Collate to the source. |
| **Update Owners**    | Enable to sync owner assignments from Collate. |
| **Update Tags**      | Enable to sync tag assignments (e.g., PII) to the source system. |
| **SQL Template**     | Optional. Specify a custom SQL template for updates. |

## Execution

Once the configuration is complete, the application can be executed in two ways:

- **Run Now:**  
  For manual execution.

- **Scheduled Run:**  
  For recurring, automated sync based on a defined schedule.

{% image
src="/images/v1.9/applications/reverse/reverse-metadata-application1.png"
alt="Scheduling"
caption="Scheduling"
/%}

[Know more about Reverse Metadata documentation](/connectors/ingestion/workflows/reverse-metadata)
