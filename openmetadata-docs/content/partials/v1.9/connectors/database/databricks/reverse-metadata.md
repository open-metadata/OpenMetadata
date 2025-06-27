## Reverse Metadata

### Description Management

Databricks supports description updates at all levels:
- Database level
- Schema level
- Table level
- Column level

### Owner Management

Databricks supports owner management at the following levels:
- Database level
- Schema level
- Table level

{% note %}
Databricks does not support to set `null` as owner.
{% /note %}

### Tag Management

Databricks supports tag management at all levels:
- Database level
- Schema level
- Table level
- Column level

### Custom SQL Template

Databricks supports custom SQL templates for metadata changes. The template is interpreted using python f-strings.

Here are examples of custom SQL queries for metadata changes:

```sql
-- Set table tags
ALTER TABLE {database}.{schema}.{table} SET TAGS {tags};
```

The list of variables for custom SQL can be found [here](/connectors/ingestion/workflows/reverse-metadata#custom-sql-template).

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).
