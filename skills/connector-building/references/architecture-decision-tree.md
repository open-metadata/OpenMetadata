# Architecture Decision Tree

## Step 1: Service Type

```
What kind of metadata does this source manage?
├── Tables, columns, schemas        → database
├── Dashboards, charts              → dashboard
├── Pipelines, tasks, DAGs          → pipeline
├── Topics, streams, queues         → messaging
├── ML models, experiments          → mlmodel
├── Buckets, files, containers      → storage
├── Search indexes, fields          → search
└── API collections, endpoints      → api
```

## Step 2: Database Sub-Classification

```
Is it a database service type?
├── NO  → Skip to Step 3
└── YES → Does it have a SQLAlchemy dialect?
    ├── YES → CommonDbSourceService + BaseConnection[Config, Engine]
    │   ├── Can it connect to multiple databases?
    │   │   ├── YES → Add MultiDBSource mixin
    │   │   │   Examples: postgres, bigquery, snowflake, redshift, mssql
    │   │   └── NO  → Single database
    │   │       Examples: mysql, sqlite, exasol
    │   ├── Does it expose query logs?
    │   │   ├── YES → Add lineage.py + usage.py + query_parser.py
    │   │   └── NO  → metadata only
    │   └── Does it support stored procedures?
    │       ├── YES → Framework handles via Inspector (no extra code)
    │       └── NO  → No action needed
    └── NO → What kind of non-SQLAlchemy database?
        ├── Document/NoSQL store → CommonNoSQLSource
        │   Examples: mongodb, couchbase, dynamodb, cassandra
        ├── Cloud data catalog   → DatabaseServiceSource directly
        │   Examples: glue, unitycatalog
        ├── Data lake / file     → DatabaseServiceSource + custom client
        │   Examples: datalake, iceberg, deltalake
        └── Proprietary API      → DatabaseServiceSource + REST/SDK client
            Examples: salesforce, domodatabase
```

## Step 3: Connection Pattern

```
Database + SQLAlchemy?
├── YES → BaseConnection[Config, Engine] subclass
│   └── Implement _get_client() → Engine
│       Uses: get_connection_url_common() + create_generic_db_connection()
│       Override URL building only for non-standard patterns
└── NO (all non-SQLAlchemy database + all non-database) →
    get_connection() + test_connection() functions
    └── Implement get_connection() → client object
        └── Client can be: REST wrapper, SDK instance, or native driver
```

## Step 4: ServiceSpec Selection

```
Database service type?
├── YES → DefaultDatabaseSpec (includes profiler, sampler, test suite, data diff)
│   ├── Has BaseConnection class? → connection_class=MyDbConnectionObj
│   └── No BaseConnection?        → Omit connection_class
└── NO  → BaseSpec(metadata_source_class=MySource)
```

## Reference Connectors by Category

| Category | Example | Key Characteristic |
|----------|---------|-------------------|
| Standard SQL | `mysql/` | BaseConnection, single DB, lineage via slow logs |
| Multi-DB SQL | `postgres/` | BaseConnection + MultiDBSource |
| Cloud Data Warehouse | `bigquery/` | Custom connection URL, multi-project, IAM auth |
| NoSQL | `mongodb/` | CommonNoSQLSource, schema inference |
| Data Lake | `datalake/` | DatabaseServiceSource, file-based metadata |
| Dashboard | `metabase/` | REST client, dashboard-to-table lineage |
| Pipeline | `airflow/` | SDK client, task status extraction |
| Messaging | `kafka/` | Admin client, schema registry integration |
