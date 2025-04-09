
## Reverse Metadata Ingestion

PostgreSQL supports the following reverse metadata ingestion features:
- Support for Description updates (Database, Schema, Table, Column)
- Owner management (Database, Schema, Table)

### Requirements for Reverse Metadata

In addition to the basic ingestion requirements, for reverse metadata ingestion the user needs:
- `SUPERUSER` privilege to the user

```sql
-- Grant superuser privilege to the user
ALTER ROLE USER_NAME SUPERUSER;
```

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).
