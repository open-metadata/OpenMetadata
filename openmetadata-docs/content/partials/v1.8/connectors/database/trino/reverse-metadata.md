## Reverse Metadata

### Description Management

Trino supports description updates at the following level:
- Table level

### Owner Management

❌ Owner management is not supported for Trino.

### Tag Management

❌ Tag management is not supported for Trino.

### Custom SQL Template

Trino supports custom SQL templates for metadata changes. The template is interpreted using python f-strings.

Here is an example of custom SQL query for metadata changes:

```sql
-- Set table description
COMMENT ON TABLE {catalog}.{schema}.{table} IS '{description}';
```

The list of variables for custom SQL can be found [here](/connectors/ingestion/workflows/reverse-metadata#custom-sql-template).

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).

### Requirements for Reverse Metadata

In addition to the basic ingestion requirements, reverse metadata ingestion in Trino requires the user need:
- a role with ownership privileges on the tables and views

```sql
-- Grant ownership of the table to your Trino user role
ALTER TABLE DATABASE_NAME.SCHEMA_NAME.TABLE_NAME SET AUTHORIZATION ROLE NEW_ROLE;

-- Grant ownership of the view to your Trino user role
ALTER VIEW DATABASE_NAME.SCHEMA_NAME.VIEW_NAME SET AUTHORIZATION ROLE NEW_ROLE;
```
