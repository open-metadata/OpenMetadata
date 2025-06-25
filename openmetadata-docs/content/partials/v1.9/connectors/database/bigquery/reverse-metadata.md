## Reverse Metadata



### Description Management

BigQuery supports description updates at the following levels:
- Schema level
- Table level

### Owner Management

❌ Owner management is not supported for BigQuery.

### Tag Management

BigQuery supports tag management at the following levels:
- Schema level
- Table level

### Custom SQL Template

BigQuery supports custom SQL templates for metadata changes. The template is interpreted using python f-strings.

Here are examples of custom SQL queries for metadata changes:

```sql
-- Update table labels
ALTER TABLE `{database}.{schema}.{table}` SET OPTIONS (labels = {tags});
```

The list of variables for custom SQL can be found [here](/connectors/ingestion/workflows/reverse-metadata#custom-sql-template).

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).
