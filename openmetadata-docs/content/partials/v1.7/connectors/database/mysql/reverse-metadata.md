## Reverse Metadata

### Description Management

MySQL supports description updates at the following level:
- Table level

### Owner Management

Owner management is not supported for MySQL.

### Tag Management

❌ Tag management is not supported for MySQL.

### Custom SQL Template

MySQL supports custom SQL templates for metadata changes. The template is interpreted using python f-strings.

Here are examples of custom SQL queries for metadata changes:

```sql
-- Update table description
ALTER TABLE {schema}.{table} COMMENT = {description};
```

The list of variables for custom SQL can be found [here](/connectors/ingestion/workflows/reverse-metadata#custom-sql-template).

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).

### Requirements for Reverse Metadata

In addition to the basic ingestion requirements, for reverse metadata ingestion the user needs:
- `
