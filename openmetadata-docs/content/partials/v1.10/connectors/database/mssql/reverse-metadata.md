## Reverse Metadata

### Description Management

MSSQL supports description updates at the following levels:
- Schema level
- Table level
- Column level

### Owner Management

MSSQL supports owner management at the following levels:
- Database level
- Schema level

### Tag Management

❌ Tag management is not supported for MSSQL.

### Custom SQL Template

MSSQL supports custom SQL templates for metadata changes. The template is interpreted using python f-strings.

Here are examples of custom SQL queries for metadata changes:

```sql
-- Update schema description
IF NOT EXISTS (SELECT 1 
               FROM {database}.sys.extended_properties 
               WHERE name = N'MS_Description' And
               major_id = SCHEMA_ID('{schema}') AND 
               minor_id = 0
     		)
BEGIN
    EXEC {database}.{schema}.sp_addextendedproperty 
     @name = N'MS_Description', 
     @value = N{description}, 
     @level0type = N'SCHEMA', 
     @level0name = N'{schema}'
END
ELSE
BEGIN
    EXEC {database}.{schema}.sp_updateextendedproperty 
     @name = N'MS_Description', 
     @value = N{description}, 
     @level0type = N'SCHEMA', 
     @level0name = N'{schema}'
END;
```

The list of variables for custom SQL can be found [here](/connectors/ingestion/workflows/reverse-metadata#custom-sql-template).

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).
