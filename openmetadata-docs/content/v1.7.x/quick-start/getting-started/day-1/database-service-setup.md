---
title: Database service setup
slug: /quick-start/getting-started/day-1/database-service-setup
---

## Setting Up a Database Service for Metadata Extraction

You can quickly set up a database service for metadata extraction in OpenMetadata SaaS. Below is an example of how to configure a connection using the `Snowflake` Connector:

1. ### Log in to OpenMetadata SaaS 
- Navigate to **Settings > Services > Databases**.
- Click on **Add New Service**.

{% image
  src="/images/v1.7/getting-started/add-service.png"
  alt="Adding Database Service"
  caption="Adding Database Service" /%}

2. ### Select Database Type

- Choose the database type for your service. In this example, select `Snowflake`.
- Enter the required details, such as the **Name** and **Description**, to identify the database.

{% image
  src="/images/v1.7/getting-started/select-service.png"
  alt="Selecting Database Service"
  caption="Selecting Database Service" /%}

3. ### Enter Connection Details
- Provide the necessary connection parameters, such as hostname, port, credentials, etc.
- The side panel offers guidance with available documentation, and you can also refer to the specific `Snowflake` Connector [documentation](/connectors)for more information.

{% image
  src="/images/v1.7/getting-started/configure-connector0.png"
  alt="Configure Service"
  caption="Configure Service" /%}

{% image
  src="/images/v1.7/getting-started/configure-connector.png"
  alt="Updating Connection Details"
  caption="Updating Connection Details" /%}

4. ### Test the Connection
Click Test Connection to verify the setup. This will check if OpenMetadata can reach the Snowflake service.

{% image
  src="/images/v1.7/getting-started/test-connection.png"
  alt="Verifying the Test Connection"
  caption="Verifying the Test Connection" /%}

5. ### Set Default Data Filters

Configure default filters to control which databases, schemas, and tables are included or excluded during ingestion.

#### Default Database Filter Pattern
- **Includes / Excludes**:  
  To add a filter pattern, simply type it in and press `Enter`.

#### Default Schema Filter Pattern
- **Includes / Excludes**:  
  To add a filter pattern, simply type it in and press `Enter`.

#### Default Table Filter Pattern
- **Includes / Excludes**:  
  To add a filter pattern, simply type it in and press `Enter`.

These filters help streamline the ingestion process by targeting only the relevant data assets.
