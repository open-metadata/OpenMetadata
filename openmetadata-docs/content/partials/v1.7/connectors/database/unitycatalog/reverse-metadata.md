## Reverse Metadata

### Description Management

Unity Catalog supports description updates at all levels:
- Database level
- Schema level
- Table level
- Column level

### Owner Management

Unity Catalog supports owner management at the following levels:
- Database level
- Schema level
- Table level

{% note %}
Unity Catalog does not support to set `null` as owner.
{% /note %}

### Tag Management

Unity Catalog supports tag management at all levels:
- Database level
- Schema level
- Table level
- Column level

### Custom SQL Template

Unity Catalog supports custom SQL templates for metadata changes. The template is interpreted using python f-strings.

Here are examples of custom SQL queries for metadata changes:

```sql
-- Set table tags
ALTER TABLE {database}.{schema}.{table} SET TAGS {tags};
```

The list of variables for custom SQL can be found [here](/connectors/ingestion/workflows/reverse-metadata#custom-sql-template).

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).
