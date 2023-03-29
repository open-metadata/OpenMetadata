# Requirements
To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

<Note>

Note that we only support officially supported Postgres versions. You can check the version list [here](https://www.postgresql.org/support/versioning/).

</Note>

### Usage and Lineage considerations

When extracting lineage and usage information from Postgres we base our finding on the `pg_stat_statements` table.
You can find more information about it on the official [docs](https://www.postgresql.org/docs/current/pgstatstatements.html#id-1.11.7.39.6).

Another interesting consideration here is explained in the following SO [question](https://stackoverflow.com/questions/50803147/what-is-the-timeframe-for-pg-stat-statements).
As a summary:
- The `pg_stat_statements` has no time data embedded in it.
- It will show all queries from the last reset (one can call `pg_stat_statements_reset()`).

Then, when extracting usage and lineage data, the query log duration will have no impact, only the query limit.

<Note>

- For usage and lineage grant your user `pg_read_all_stats` permission.

```sql
GRANT pg_read_all_stats TO your_user;
```

</Note>
