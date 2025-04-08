---
title: Reverse Metadata Ingestion Collate | Feature & Configuration
slug: /connectors/ingestion/workflows/reverse-metadata
collate: true
---

# Reverse Metadata Ingestion
{% note %}
This feature is specific to Collate and requires the Collate Enterprise License.
{% /note %}

Reverse Metadata is an advanced feature in OpenMetadata that facilitates bi-directional synchronization between OpenMetadata and the source database systems. While standard ingestion pulls metadata into OpenMetadata, reverse ingestion enables pushing metadata changes made within OpenMetadata back to the source systems. This ensures consistency and alignment across the entire data infrastructure.

{% note %}
Reverse Metadata uses the existing service connection configuration provided during the initial metadata ingestion. You do not need to reconfigure the service connection. In order to use Reverse Metadata, this connections must use a role with write permissions.
{% /note %}

## Supported Databases and Features

| Database       | Update Description | Update Tags | Update Owners | Custom SQL Support | Documentation |
|----------------|-------------------|-------------|---------------|-------------------|---------------|
| Athena         | ✅ (Table)        | ❌          | ❌            | ✅                | [Link](/connectors/database/athena#reverse-metadata-ingestion) |
| BigQuery       | ✅ (Schema, Table)| ✅ (Schema, Table) | ❌            | ✅                | [Link](/connectors/database/bigquery#reverse-metadata-ingestion) |
| Clickhouse     | ✅ (Table, Column)| ❌          | ❌            | ✅                | [Link](/connectors/database/clickhouse#reverse-metadata-ingestion) |
| Databricks     | ✅  | ✅  | ✅ (Database, Schema, Table) | ✅                | [Link](/connectors/database/databricks#reverse-metadata-ingestion) |
| MSSQL          | ✅ (Schema, Table, Column) | ❌          | ✅ (Database, Schema) | ✅                | [Link](/connectors/database/mssql#reverse-metadata-ingestion) |
| MySQL          | ✅ (Table)        | ❌          | ❌            | ✅                | [Link](/connectors/database/mysql#reverse-metadata-ingestion) |
| Oracle         | ✅ (Table, Column)| ❌          | ❌            | ✅                | [Link](/connectors/database/oracle#reverse-metadata-ingestion) |
| PostgreSQL     | ✅  | ❌          | ✅ (Database, Schema, Table) | ✅                | [Link](/connectors/database/postgres#reverse-metadata-ingestion) |
| Redshift       | ✅  | ❌          | ✅ (Database, Schema, Table) | ✅                | [Link](/connectors/database/redshift#reverse-metadata-ingestion) |
| Snowflake      | ✅  | ✅ (Schema, Table, Column) | ❌            | ✅                | [Link](/connectors/database/snowflake#reverse-metadata-ingestion) |
| Unity Catalog  | ✅  | ✅  | ✅ (Database, Schema, Table) | ✅                | [Link](/connectors/database/unity-catalog#reverse-metadata-ingestion) |

## Key Features

### Description Management
- **Multi-level Support**: Update descriptions at database, schema, table, and column levels.
- **Consistency**: Maintain uniform documentation across all systems.
- **Custom SQL Support**: Flexibility to provide custom SQL templates for updates.

### Ownership Management
- **Owner Assignment**: Add new owners to data assets.
- **Owner Removal**: Remove existing owners when needed.
- **Custom SQL Support**: Flexibility to provide custom SQL templates for updates.

### Tag and Label Management
- **Bidirectional Sync**: Synchronize tags between OpenMetadata and source systems.
- **Tag Operations**: Add new tags or remove existing ones.
- **Conflict Prevention**: Built-in protection against ambiguous tag situations.
- **Custom SQL Support**: Flexibility to provide custom SQL templates for updates.

{% note %}
When updating tags during reverse ingestion, it is important to understand the difference in tag structures. Most databases support key-value pairs for tags, whereas OpenMetadata organizes tags using classifications and tag names. During reverse ingestion, OpenMetadata maps the classification name as the tag key and the tag name as the tag value. If a new tag from the same classification is applied to a data asset that already has a tag from that classification, the reverse ingestion process may raise an ambiguous tag error. This behavior is intended to prevent accidental overwriting of existing tags at the source system.
{% /note %}

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
