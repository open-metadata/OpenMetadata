## Reverse Metadata

### Description Management

Athena supports description updates at the following level:
- Table level

### Owner Management

❌ Owner management is not supported for Athena.

### Tag Management

❌ Tag management is not supported for Athena.

### Custom SQL Template

Athena supports custom SQL templates for metadata changes. The template is interpreted using python f-strings.

Here are examples of custom SQL queries for metadata changes:

```sql
-- Update table description
ALTER TABLE {schema}.{table} SET TBLPROPERTIES ('comment' = {description});
```

The list of variables for custom SQL can be found [here](/v1.8/connectors/reverse-metadata-workflow-link.md#custom-sql-template).

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/v1.8/connectors/reverse-metadata-workflow-link.md).
