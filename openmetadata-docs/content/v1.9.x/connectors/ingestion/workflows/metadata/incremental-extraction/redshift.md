---
title: Metadata Ingestion - Incremental Extraction - Redshift
description: Configure incremental metadata ingestion from Redshift to capture changes efficiently.
slug: /connectors/ingestion/workflows/metadata/incremental-extraction/redshift
---

# Metadata Ingestion - Incremental Extraction - Redshift

## Approach

In order to implement the Incremental Extraction for Redshift we rely on the [`SYS_QUERY_HISTORY`](https://docs.aws.amazon.com/redshift/latest/dg/SYS_QUERY_HISTORY.html) to get the latest DDL changes.

We then match the `query_text` with different regex to get the Schema and Table name and understand if it was a deletion.

If no schema is present in the query we infer that it is the default for the database.

## Requisites

The user should be a Superuser to be able to see all the records.

## Used Regex

### Table Name

```python
r"(\w+\.){0,2}\w+"
```

### Create Table

```python
rf"^.*CREATE\s+(LOCAL\s+|EXTERNAL\s+)?(TEMPORARY\s+|TEMP\s+)?TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(?P<table>{TABLE_NAME_RE}).*$"
```

### Alter Table

```python
rf"^.*(ALTER\s+TABLE)\s+(?P<table>{TABLE_NAME_RE}).*$"
```

### Drop Table

```python
rf"^.*DROP\s+TABLE\s+(IF\s+EXISTS\s+)?(?P<table>{TABLE_NAME_RE}).*$"
```

### Create View

```python
rf"^.*CREATE\s+(OR\s+REPLACE\s+)?(EXTERNAL\s+|MATERIALIZED\s+)?VIEW\s+(?P<table>{TABLE_NAME_RE}).*$"
```

### Alter View

```python
rf"^.*ALTER\s+(EXTERNAL\s+)?VIEW\s+(?P<table>{TABLE_NAME_RE}).*$"
```

### Drop View

```python
rf"^.*DROP\s+(EXTERNAL\s+|MATERIALIZED\s+)?VIEW\s+(IF\s+EXISTS\s+)?(?P<table>{TABLE_NAME_RE}).*$"
```

### Comment

```python
# Not supporting Comment changes on Constraint
rf"^.*COMMENT\s+ON\s+(TABLE|COLUMN|VIEW)\s+(?P<table>{TABLE_NAME_RE}).*$"
```

## Used Query

```sql
SELECT
    query_text
FROM SYS_QUERY_HISTORY
WHERE status = 'success'
  AND (
    query_type = 'DDL' OR
    (query_type = 'UTILITY' AND query_text ilike '%%COMMENT ON%%') OR
    (query_type = 'CTAS' AND query_text ilike '%%CREATE TABLE%%')
  )
  and database_name = '{database}'
  and end_time >= '{start_date}'
ORDER BY end_time DESC
```
