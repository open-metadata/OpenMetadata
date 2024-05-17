---
title: Metadata Ingestion - Incremental Extraction - Snowflake
slug: /connectors/ingestion/workflows/metadata/incremental-extraction/snowflake
---

# Metadata Ingestion - Incremental Extraction - Snowflake

## Approach

In order to implement the Incremental Extraction for Snowflake we rely on the [`SNOWFLAKE.ACCOUNT_USAGE.TABLES`](https://docs.snowflake.com/en/sql-reference/account-usage/tables) view to get the latest DDL changes.

## Used Queries

### External Tables

```sql
select TABLE_NAME, DELETED
from (
    select
        TABLE_NAME,
        DELETED,
        ROW_NUMBER() over (
            partition by TABLE_NAME order by LAST_DDL desc
        ) as ROW_NUMBER
    from snowflake.account_usage.tables
    where TABLE_CATALOG = '{database}'
      and TABLE_SCHEMA = '{schema}'
      and TABLE_TYPE = 'EXTERNAL TABLE'
      and DATE_PART(epoch_millisecond, LAST_DDL) >= '{date}'
)
where ROW_NUMBER = 1
```

### Base, Not Transient Tables

```sql
select TABLE_NAME, DELETED
from (
    select
        TABLE_NAME,
        DELETED,
        ROW_NUMBER() over (
            partition by TABLE_NAME order by LAST_DDL desc
        ) as ROW_NUMBER
    from snowflake.account_usage.tables
    where TABLE_CATALOG = '{database}'
    and TABLE_SCHEMA = '{schema}'
    and TABLE_TYPE = 'BASE TABLE'
    and IS_TRANSIENT != 'YES'
    and DATE_PART(epoch_millisecond, LAST_DDL) >= '{date}'
)
where ROW_NUMBER = 1
```

### Base, Transient Tables

```sql
select TABLE_NAME, DELETED
from (
    select
        TABLE_NAME,
        DELETED,
        ROW_NUMBER() over (
            partition by TABLE_NAME order by LAST_DDL desc
        ) as ROW_NUMBER
    from snowflake.account_usage.tables
    where TABLE_CATALOG = '{database}'
    and TABLE_SCHEMA = '{schema}'
    and TABLE_TYPE = 'BASE TABLE'
    and IS_TRANSIENT = 'YES'
    and DATE_PART(epoch_millisecond, LAST_DDL) >= '{date}'
)
where ROW_NUMBER = 1
```

### Views

```sql
select TABLE_NAME, DELETED
from (
    select
        TABLE_NAME,
        DELETED,
        ROW_NUMBER() over (
            partition by TABLE_NAME order by LAST_DDL desc
        ) as ROW_NUMBER
    from snowflake.account_usage.tables
    where  TABLE_CATALOG = '{database}'
    and TABLE_SCHEMA = '{schema}'
    and TABLE_TYPE = 'VIEW'
    and DATE_PART(epoch_millisecond, LAST_DDL) >= '{date}'
)
where ROW_NUMBER = 1
```

### Materialized Views

```sql
select TABLE_NAME, DELETED
from (
    select
        TABLE_NAME,
        DELETED,
        ROW_NUMBER() over (
            partition by TABLE_NAME order by LAST_DDL desc
        ) as ROW_NUMBER
    from snowflake.account_usage.tables
    where  TABLE_CATALOG = '{database}'
    and TABLE_SCHEMA = '{schema}'
    and TABLE_TYPE = 'MATERIALIZED VIEW'
    and DATE_PART(epoch_millisecond, LAST_DDL) >= '{date}'
)
where ROW_NUMBER = 1
```
