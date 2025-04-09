---
title: Reverse Metadata Ingestion Collate | Feature & Configuration
slug: /connectors/ingestion/workflows/reverse-metadata
---

# Reverse Metadata Ingestion
{% note %}
This feature is specific to Collate and requires the Collate Enterprise License.
{% /note %}

Reverse metadata ingestion is an advanced feature in OpenMetadata that facilitates bi-directional synchronization between OpenMetadata and the source database systems. While standard ingestion pulls metadata into OpenMetadata, reverse ingestion enables pushing metadata changes made within OpenMetadata back to the source systems. This ensures consistency and alignment across the entire data infrastructure.

{% note %}
Reverse ingestion uses the existing service connection configuration provided during the initial metadata ingestion. You do not need to reconfigure the service connection.
{% /note %}

## Supported Databases and Features

### Athena
- Table Description updates

### BigQuery
- Schema Description updates
- Table Description updates
- Schema and Table tag management

### Clickhouse
- Table Description updates
- Column Description updates

### Databricks
- Full support for Description updates (Database, Schema, Table, Column)
- Full support for Owner management (Database, Schema, Table)
- Full support for Tag management (Database, Schema, Table, Column)

### MSSQL
- Description updates (Schema, Table, Column)
- Owner management (Database, Schema)

### MySQL
- Table Description updates

### Oracle
- Table Description updates
- Column Description updates

### PostgreSQL
- Full support for Description updates (Database, Schema, Table, Column)
- Owner management (Database, Schema, Table)

### Redshift
- Full support for Description updates (Database, Schema, Table, Column)
- Owner management (Database, Schema, Table)

### Snowflake
- Full support for Description updates (Database, Schema, Table, Column)
- Tag management (Schema, Table, Column)

### Unity Catalog
- Full support for Description updates (Database, Schema, Table, Column)
- Full support for Owner management (Database, Schema, Table)
- Full support for Tag management (Database, Schema, Table, Column)

## Key Features

### Description Management
- **Multi-level Support**: Update descriptions at database, schema, table, and column levels.
- **Consistency**: Maintain uniform documentation across all systems.

### Ownership Management
- **Owner Assignment**: Add new owners to data assets.
- **Owner Removal**: Remove existing owners when needed.

### Tag and Label Management
- **Bidirectional Sync**: Synchronize tags between OpenMetadata and source systems.
- **Tag Operations**: Add new tags or remove existing ones.
- **Conflict Prevention**: Built-in protection against ambiguous tag situations.

### Custom SQL Template

You can define a custom SQL template to handle the metadata changes. The template is interpreted using python f-strings.
These are the available variables:

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

You can see examples of custom SQL templates in the specific connector documentation.

{% note %}
When updating tags during reverse ingestion, it is important to understand the difference in tag structures. Most databases support key-value pairs for tags, whereas OpenMetadata organizes tags using classifications and tag names. During reverse ingestion, OpenMetadata maps the classification name as the tag key and the tag name as the tag value. If a new tag from the same classification is applied to a data asset that already has a tag from that classification, the reverse ingestion process may raise an ambiguous tag error. This behavior is intended to prevent accidental overwriting of existing tags at the source system.
{% /note %}

## Maintenance

- Regularly review sync status
- Keep track of failed operations
- Maintain proper documentation of custom implementations

## Getting Started

### Configuration Setup

1. Navigate to the **Applications** section.

{% image
  src="/images/v1.7/features/ingestion/workflows/reverse-metadata/reverse-metadata1.png"
  alt="Reverse Metadata Navigation"
  caption="Reverse Metadata Navigation"
 /%}

2. Locate and install the **Reverse Metadata** app.

{% image
  src="/images/v1.7/features/ingestion/workflows/reverse-metadata/reverse-metadata2.png"
  alt="Reverse Metadata App"
  caption="Reverse Metadata App"
 /%}

3. Select your database service, configure the required settings, and click **Submit**.

{% image
  src="/images/v1.7/features/ingestion/workflows/reverse-metadata/reverse-metadata3.png"
  alt="Reverse Metadata Configuration"
  caption="Reverse Metadata Configuration"
 /%}

### Testing

- Start with a single type of update.
- Verify changes in the source system.
- Gradually expand to other features.
- Monitor for any errors or warnings.

{% image
  src="/images/v1.7/features/ingestion/workflows/reverse-metadata/reverse-metadata4.png"
  alt="Monitor Reverse Metadata Ingestion"
  caption="Monitor Reverse Metadata Ingestion"
 /%}
