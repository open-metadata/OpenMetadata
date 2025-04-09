## Reverse Metadata Ingestion

MySQL supports the following reverse metadata ingestion features:
- Support for table description updates

### Requirements for Reverse Metadata

In addition to the basic ingestion requirements, for reverse metadata ingestion the user needs:
- `ALTER` privileges on tables to update descriptions

```sql
-- Grant required privileges for reverse metadata
GRANT ALTER ON DATABASE_NAME.TABLE_NAME TO 'USER_NAME'@'%';
```

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).