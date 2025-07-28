---
title: Reverse Metadata Application | Collate Docs
description: Learn how reverse metadata application helps enrich data assets by tracing lineage, usage context, and relationships within complex ecosystems.
slug: /applications/reverse-metadata
collate: true
---

# Reverse Metadata Application

{% youtube videoId="EWYDfhCgW8k" start="0:00" end="2:16" width="800px" height="450px" /%}

The **Reverse Metadata Application** ensures real-time synchronization of metadata changes. Once installed and configured, any updates made to selected assets in Collate—such as descriptions, tags, or owners—are automatically in real-time propagated back to the source systems. There’s no need to trigger the application manually. This live sync ensures Collate remains the single source of truth while all connected systems stay up to date and compliant with governance policies.

## Supported Databases and Features

| Database       | Update Description | Update Tags | Update Owners | Custom SQL Support | Documentation |
|----------------|-------------------|-------------|---------------|-------------------|---------------|
| Athena         | ✅ (Table)        | ❌          | ❌            | ✅                | [Link](/connectors/database/athena#reverse-metadata) |
| BigQuery       | ✅ (Schema, Table)| ✅ (Schema, Table) | ❌            | ✅                | [Link](/connectors/database/bigquery#reverse-metadata) |
| Clickhouse     | ✅ (Table, Column)| ❌          | ❌            | ✅                | [Link](/connectors/database/clickhouse#reverse-metadata) |
| Databricks     | ✅ (Support all) | ✅ (Support all)  | ✅ (Database, Schema, Table) | ✅                | [Link](/connectors/database/databricks#reverse-metadata) |
| MSSQL          | ✅ (Schema, Table, Column) | ❌          | ✅ (Database, Schema) | ✅                | [Link](/connectors/database/mssql#reverse-metadata) |
| MySQL          | ✅ (Table)        | ❌          | ❌            | ✅                | [Link](/connectors/database/mysql#reverse-metadata) |
| Oracle         | ✅ (Table, Column)| ❌          | ❌            | ✅                | [Link](/connectors/database/oracle#reverse-metadata) |
| PostgreSQL     | ✅ (Support all) | ❌          | ✅ (Database, Schema, Table) | ✅                | [Link](/connectors/database/postgres#reverse-metadata) |
| Redshift       | ✅ (Support all) | ❌          | ✅ (Database, Schema, Table) | ✅                | [Link](/connectors/database/redshift#reverse-metadata) |
| Snowflake      | ✅ (Support all) | ✅ (Schema, Table, Column) | ❌            | ✅                | [Link](/connectors/database/snowflake#reverse-metadata) |
| Unity Catalog  | ✅ (Support all) | ✅ (Support all)  | ✅ (Database, Schema, Table) | ✅                | [Link](/connectors/database/unity-catalog#reverse-metadata) |

## Overview

With this application, you can automatically sync metadata changes such as:

### Descriptions

When you update the table or column descriptions in **Collate**, these changes will get updated in the selected data assets based on your defined logic.

**Example:**

- The `customer_orders` table in Collate has the description updated to:
"Stores historical order transactions from all regions."
- This updated description is written back to the `customer_orders` table using the configured channel as per your defined logic.

### Owners

You can assign ownership (individuals or teams) to data assets in **Collate** and sync this information back to the data source.

**Example:**

- You assign **John Doe** as the owner of the table `customer_data` in Collate.

- This ownership info is saved in the original system’s metadata, making it easier to identify responsibilities and understand data flow.

{% note %}

- Team ownership is currently not supported in the reverse metadata sync process. Support for syncing team-based ownership may be introduced in future releases.
- The owner update functionality currently supports syncing only a **single owner** back to the source system.
- If an entity in Collate has multiple owners, **only one owner** will be propagated during the reverse metadata sync.
- Support for syncing **multiple owners** is planned for future enhancements.

{% /note %}

### Tags

Tag metadata (like `PII`, `sensitive`, `finance-related`, etc.) applied in **Collate** can be sent back to the source system to enforce governance policies.

**Example:**

- You apply the tag `PII.Sensitive` to the `XYZ` data asset.
- If the logic is defined, this tag will also be updated in the corresponding data asset in the source system.

## Key Features

- **Automated Metadata Propagation:** 
  Sync metadata updates (tags, owners, descriptions) from Collate to source systems without manual intervention.

- **Configurable Channels:**  
  Create multiple sync channels to define exactly which asset or metadata types to sync. Once configured, changes sync live — no manual action needed.

- **Custom SQL Templates:**  
  Use SQL templates to customize update behavior per connector.

| Variable | Description | Context | Type |
|----------|-------------| --- | --- |
| `database` | The identifier of the database or catalog | Always | String |
| `schema` | The identifier of the schema | Always | String |
| `table` | The identifier of the table | Always | String |
| `column` | The identifier of the column | Always | String |
| `description` | Refers to the description | Description update | String |
| `owner` | The identifier of the owner being added or removed. This value can be a username or an email and depends on the source system. | Owner update | String |
| `tag_key` | The key of the tag being added or removed (Classification) | Tag update | String |
| `tag_value` | The value of the tag being added or removed | Tag update | String |
| `tags` | Refers to a list of tags (e.g., BigQuery). Example: [('my_tag', 'value'), ('env', 'prod')] | Always | List[Tuple[String, String]] |

## Use Cases

- Maintain consistent metadata across Collate and Database by syncing SQL-based description updates.
- Improve data discovery by propagating column-level comments from Database back into Collate.
- Strengthen governance by capturing ownership changes in Database through SQL and syncing them to Collate.
- Enhance metadata visibility by syncing Database tag updates (e.g., PII.Sensitive) into Collate.
- Drive metadata accuracy by reflecting schema description changes in Database directly within Collate.
- Unify metadata management by capturing SQL-applied labels in Database and syncing them automatically to Collate.

## How SQL Templates Work

Use the following SQL templates to filter your database operations and automatically trigger reverse metadata sync when these queries are executed.

### Update Description in Snowflake

**SQL Variable:-**

```sql
ALTER DATABASE "{database}" SET COMMENT = {description};
```

**example:-**

```sql
ALTER DATABASE "Snowflake" SET COMMENT = 'new description';
```

This query updates the database description. When executed, it can trigger a reverse metadata update for description fields.

### Update Table Owner in Databricks

**SQL Variable:-**

```sql
ALTER TABLE `{database}`.`{schema}`.`{table}` OWNER TO `{owner}@gmail.com`;
```

**example:-**

```sql
ALTER TABLE `my_database`.`orders`.`order_detail` OWNER TO `admin@gmail.com`;
```

Use this to assign ownership of a table. You can specify email addresses, such as those under a particular domain, to trigger reverse metadata for ownership fields.

### Update Tags in BigQuery

**SQL Variable:-**

```sql
ALTER SCHEMA `{database}.{schema}` SET OPTIONS (labels = {tags});
```

**example:-**

```sql
ALTER SCHEMA `abc.customers` SET OPTIONS (labels = [('PII', 'Sensitive')]);
```

This sets or updates schema-level labels, such as sensitive classifications. Useful for tagging metadata like PII & sensitive, to automatically trigger reverse metadata for Tags fields.


## Installation

1. Navigate to **Settings > Applications**.

{% image
src="/images/v1.9/applications/autopilot.png"
alt="Install Reverse Metadata Application"
caption="Install Reverse Metadata Application"
/%}

2. Click **Add Apps** and install the **Reverse Metadata Application**.
3. After installation, configure the synchronization channels as described below in screenshot. The Filter section allows you to define which assets should be included in a sync channel by applying conditions based on  tables: the service, database or schema they belong to, their name, owners, domain, and even by Custom Properties!

{% image
src="/images/v1.9/applications/reverse/reverse-metadata-application.png"
alt="Configuration"
caption="Configuration"
/%}

In the Above screenshot, a filter is set to update descriptions only when the tag is "Sensitive." This helps keep all sensitive tag descriptions in sync. At the same time, reverse metadata runs automatically.

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

## Run Now to Clean Workflows

{% image
src="/images/v1.9/applications/reverse/reverse-metadata-application1.png"
alt="Scheduling"
caption="Scheduling"
/%}

Users can monitor the running state of workflows, and in case of a failure, use the options below to clean them up:

- **Run Now:**- This lets you manually initiate a cleanup operation for failed workflows. This option will only be used to clean workflows. They will not trigger reverse metadata. It is an automatic synchronization.
- **Scheduled Run:**- This automatically re-runs cleanup operations based on a defined schedule (e.g., daily or weekly).

{% note %}

The Run Now option currently does not trigger any reverse metadata workflows. It is intended for manual cleanup of failed operations only.

Support for batch reverse metadata execution via Run Now is planned for future releases. This note is added to help set clear expectations for users.

{% /note %}

{% image
src="/images/v1.9/applications/reverse/reverse-metadata-application2.png"
alt="Recent Runs"
caption="Recent Runs"
/%}

In the Recent Runs tab, users can monitor the results of all workflow executions. Detailed logs are available for each run, making it easy to review outcomes and troubleshoot any failures.
