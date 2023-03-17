# Requirements

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with custom Airflow plugins to handle the workflow deployment.

> Note that we only support officially supported Postgres versions. You can check the version list [here](https://www.postgresql.org/support/versioning/).

### Usage and Lineage considerations

When extracting lineage and usage information from Postgres we base our finding on the `pg_stat_statements` table. You can find more information about it on the official [docs](https://www.postgresql.org/docs/current/pgstatstatements.html#id-1.11.7.39.6).

Another interesting consideration here is explained in the following SO [question](https://stackoverflow.com/questions/50803147/what-is-the-timeframe-for-pg-stat-statements).

As a summary:

- The `pg_stat_statements` has no time data embedded in it.
- It will show all queries from the last reset (one can call `pg_stat_statements_reset()`).

Then, when extracting usage and lineage data, the query log duration will have no impact, only the query limit.

> - For usage and lineage grant your user `pg_read_all_stats` permission.

```sql
GRANT pg_read_all_stats TO your_user;
```

# Fields

- hostPort: Host and port of the Postgres service.\n\n Example: `localhost:8000`\n

- password: Password to connect to Postgres.\n\n Should be strong and contain `@$#[0-9][a-z][A-Z]`\n

- username: Username to connect to Postgres. This user should have privileges to read all the metadata in Postgres.

- database: **Database** of the data source. This is **optional** parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.

- sslMode: SSL Mode to connect to postgres database.\n **E.g**, prefer, verify-ca etc.

- classificationName: Custom OpenMetadata Classification name for Postgres policy tags.

- ingestAllDatabases: Marked is a check if you want to ingest all the databases.

- scheme: **SQLAlchemy** driver scheme options.
