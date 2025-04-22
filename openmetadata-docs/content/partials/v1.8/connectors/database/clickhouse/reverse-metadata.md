## Reverse Metadata

### Description Management

Clickhouse supports description updates at the following levels:
- Table level
- Column level

### Owner Management

❌ Owner management is not supported for Clickhouse.

### Tag Management

❌ Tag management is not supported for Clickhouse.

### Custom SQL Template

Clickhouse supports custom SQL templates for metadata changes. The template is interpreted using python f-strings.

Here are examples of custom SQL queries for metadata changes:

```sql
-- Update column description
ALTER TABLE `{schema}`.{table} MODIFY COLUMN {column} COMMENT {description};
```

The list of variables for custom SQL can be found [here](/connectors/ingestion/workflows/reverse-metadata#custom-sql-template).

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).
