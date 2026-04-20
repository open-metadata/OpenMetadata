# Lineage Standards

## Lineage Extraction Methods

### 1. Query Log Lineage (Database)

Parse query logs to discover table-to-table lineage via SQL analysis:

```python
class MyDbLineageSource(MyDbQueryParserSource, LineageSource):
    sql_stmt = MY_DB_SQL_STATEMENT
    filters = """
        AND (
            LOWER(query) LIKE '%%create%%table%%select%%'
            OR LOWER(query) LIKE '%%insert%%into%%select%%'
            OR LOWER(query) LIKE '%%update%%'
            OR LOWER(query) LIKE '%%merge%%'
        )
    """
```

Key components:
- `LineageSource` base class handles chunked parallel processing
- `sql_stmt` — SQL template to fetch query logs with `{start_time}`, `{end_time}`, `{filters}`, `{result_limit}` placeholders
- `filters` — SQL WHERE clause fragment to select only lineage-relevant queries (DML, CTAS, MERGE)
- Time window from `queryLogDuration` config (typically 1-30 days)

### 2. View Lineage (Database)

Automatically extracted by `CommonDbSourceService` from view definitions. No connector code needed — the framework parses `CREATE VIEW` SQL to find source tables.

### 3. Dashboard-to-Table Lineage

Two paths depending on how dashboards reference data:

**Native SQL queries** — parse the SQL to extract table references:
```python
def _yield_lineage_from_query(self, chart, dashboard_entity):
    parser = LineageParser(chart.native_query, dialect=self.dialect)
    for table in parser.source_tables:
        table_entity = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
        if table_entity:
            yield Either(right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=table_entity.id, type="table"),
                    toEntity=EntityReference(id=dashboard_entity.id, type="dashboard"),
                    lineageDetails=LineageDetails(source=LineageSource.DashboardLineage),
                )
            ))
```

**API-based references** — chart stores a table ID directly:
```python
def _yield_lineage_from_api(self, chart, dashboard_entity):
    table_id = chart.table_id
    table_entity = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
    if table_entity:
        yield Either(right=AddLineageRequest(...))
```

### 4. Pipeline-to-Table Lineage

Pipelines declare input/output tables (or discover them from task metadata):

```python
def yield_pipeline_lineage_details(self, pipeline_details):
    for task in pipeline_details.tasks:
        for input_table in task.input_tables:
            yield Either(right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=input_table.id, type="table"),
                    toEntity=EntityReference(id=pipeline_entity.id, type="pipeline"),
                )
            ))
```

## Lineage Precision

Lineage edges must be as specific as possible. Overly-broad lineage pollutes the data catalog:

- **Never use wildcard `table_name="*"` in search queries** — this links every table in a database to the dashboard/pipeline, producing massively incorrect lineage graphs
- If the source API doesn't provide table-level granularity, either:
  1. Skip table-level lineage entirely (yield nothing, document the limitation)
  2. Parse SQL from the source (e.g., report definition XML, query logs) to extract specific tables
  3. Link at the database/schema level only if the framework supports it
- A connector with no lineage is better than a connector with wrong lineage

```python
# WRONG — links every table in the database to each dashboard
fqn_search = build_es_fqn_search_string(
    database_name=db_name, table_name="*"  # DO NOT DO THIS
)

# CORRECT — skip lineage if no table-level info is available
def yield_dashboard_lineage_details(self, dashboard_details, ...):
    """Source API does not expose per-report table usage."""
    return

# CORRECT — parse SQL from report definition to get specific tables
def yield_dashboard_lineage_details(self, dashboard_details, ...):
    for query in self._extract_queries_from_rdl(dashboard_details):
        parser = LineageParser(query, dialect=Dialect.TSQL)
        for table in parser.source_tables:
            yield from self._create_lineage_edge(table, dashboard_details)
```

## Dialect Mapping

Every database connector maps to a SQL dialect for lineage parsing. The mapping lives in `ingestion/src/metadata/ingestion/lineage/models.py`:

```python
MAP_CONNECTION_TYPE_DIALECT = {
    "Mysql": Dialect.MYSQL,
    "Postgres": Dialect.POSTGRES,
    "BigQuery": Dialect.BIGQUERY,
    "Snowflake": Dialect.SNOWFLAKE,
    # ... 26+ dialects
}
```

New connectors must add their mapping. If no specific dialect exists, use `Dialect.ANSI`.

## File Structure for Lineage Support

Database connectors with lineage need these files:

```
source/database/{name}/
├── lineage.py        # MyDbLineageSource(MyDbQueryParserSource, LineageSource)
├── usage.py          # MyDbUsageSource(MyDbQueryParserSource, UsageSource)
├── query_parser.py   # MyDbQueryParserSource(QueryParserSource)
└── queries.py        # SQL_STATEMENT template with time window placeholders
```

Register in `service_spec.py`:
```python
ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=MyDbSource,
    lineage_source_class=MyDbLineageSource,
    usage_source_class=MyDbUsageSource,
    connection_class=MyDbConnectionObj,
)
```

## Query Log SQL Template

```python
MY_DB_SQL_STATEMENT = """
SELECT
    query_text AS query_text,
    user_name AS user_name,
    start_time AS start_time,
    end_time AS end_time,
    database_name AS database_name,
    schema_name AS schema_name,
    duration AS duration
FROM system.query_log
WHERE start_time >= '{start_time}'
  AND start_time < '{end_time}'
  {filters}
ORDER BY start_time DESC
LIMIT {result_limit}
"""
```

## Processing Model

LineageSource uses chunked parallel processing:
- `CHUNK_SIZE = 200` queries per batch
- `QUERY_PROCESSING_TIMEOUT = 300` seconds per process
- `MAX_ACTIVE_TIMED_OUT_THREADS = 10`
- Producer yields query batches; processor parses SQL and emits lineage edges
- Failed queries tracked via singleton `QueryParsingFailures`

## Capability Flags

Set in JSON Schema:
```json
"supportsLineageExtraction": {
    "$ref": "../connectionBasicType.json#/definitions/supportsLineageExtraction"
}
```

And in test connection JSON, add the `GetQueries` step:
```json
{
    "name": "GetQueries",
    "description": "Check if we can access query logs.",
    "mandatory": false
}
```
