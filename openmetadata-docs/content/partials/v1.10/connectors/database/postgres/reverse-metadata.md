## Reverse Metadata

### Description Management

PostgreSQL supports description updates at all levels:
- Database level
- Schema level
- Table level
- Column level

### Owner Management

PostgreSQL supports owner management at the following levels:
- Database level
- Schema level
- Table level

### Tag Management

❌ Tag management is not supported for PostgreSQL.

### Custom SQL Template

PostgreSQL supports custom SQL templates for metadata changes. The template is interpreted using python f-strings.

Here are examples of custom SQL queries for metadata changes:

```sql
-- Update database owner
ALTER DATABASE {database} OWNER TO {owner};
```

The list of variables for custom SQL can be found [here](/connectors/ingestion/workflows/reverse-metadata#custom-sql-template).

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).

### Requirements for Reverse Metadata

In addition to the basic ingestion requirements, for reverse metadata ingestion the user needs:
- `SUPERUSER` privilege to the user

```sql
-- Grant superuser privilege to the user
ALTER ROLE USER_NAME SUPERUSER;
```
