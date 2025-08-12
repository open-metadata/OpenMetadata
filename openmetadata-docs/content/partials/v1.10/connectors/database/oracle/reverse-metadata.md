## Reverse Metadata


### Description Management

Oracle supports description updates at the following levels:
- Table level
- Column level

### Owner Management

❌ Owner management is not supported for Oracle.

### Tag Management

❌ Tag management is not supported for Oracle.

### Custom SQL Template

Oracle supports custom SQL templates for metadata changes. The template is interpreted using python f-strings.

Here are examples of custom SQL queries for metadata changes:

```sql
-- Update column description
COMMENT ON COLUMN {schema}.{table}.{column} IS {description}
```

The list of variables for custom SQL can be found [here](/connectors/ingestion/workflows/reverse-metadata#custom-sql-template).

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).
