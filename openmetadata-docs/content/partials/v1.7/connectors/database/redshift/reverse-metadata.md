## Reverse Metadata


### Description Management

Redshift supports description updates at all levels:
- Database level
- Schema level
- Table level
- Column level

### Owner Management

Redshift supports owner management at the following levels:
- Database level
- Schema level
- Table level

### Tag Management

❌ Tag management is not supported for Redshift.

### Custom SQL Template

Redshift supports custom SQL templates for metadata changes. The template is interpreted using python f-strings.

Here are examples of custom SQL queries for metadata changes:

```sql
-- Update column description
COMMENT ON COLUMN {database}.{schema}.{table}.{column} IS {description};
```

The list of variables for custom SQL can be found [here](/connectors/ingestion/workflows/reverse-metadata#custom-sql-template).

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).
