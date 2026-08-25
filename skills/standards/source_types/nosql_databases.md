# NoSQL Database Connector Standards

Covers document stores, wide-column stores, and key-value databases: MongoDB, Couchbase, DynamoDB, Cassandra, Bigtable, etc.

## Base Classes

- Source: `CommonNoSQLSource` (extends `DatabaseServiceSource`)
- Connection: `get_connection()` / `test_connection()` functions (no SQLAlchemy)
- Spec: `DefaultDatabaseSpec` without `connection_class`

## Key Characteristics

- No SQL dialect — use native drivers (pymongo, boto3, couchbase SDK)
- Schema-less or semi-structured — schema must be inferred from data sampling
- No query log lineage (typically)
- Collection/table enumeration via admin APIs

## Schema Inference

NoSQL databases don't have fixed schemas. `CommonNoSQLSource` samples documents and infers column types:

```python
class CommonNoSQLSource(DatabaseServiceSource):
    def yield_table(self, table_name_and_type):
        # 1. Sample N documents from collection
        # 2. Infer column names and types from samples
        # 3. Handle nested objects as STRUCT columns
        # 4. Handle arrays as ARRAY columns
```

The framework handles this automatically. Connector-specific code just needs to provide data access.

## Connection Pattern

```python
def get_connection(connection: MongoDBConnection):
    return MongoClient(connection.connectionURI.get_secret_value())

def test_connection(metadata, client, service_connection, automation_workflow=None):
    test_fn = {
        "CheckAccess": partial(client.server_info),
        "GetDatabases": partial(client.list_database_names),
        "GetSchemas": partial(list, client[db_name].list_collection_names()),
        "GetTables": partial(list, client[db_name].list_collection_names()),
    }
    test_connection_steps(
        metadata=metadata, test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
```

## Authentication

| Database | Auth Methods |
|----------|-------------|
| MongoDB | Connection URI (SRV), username/password, X.509, LDAP |
| DynamoDB | AWS IAM (access key, role, profile) |
| Couchbase | Username/password, LDAP |
| Cassandra | Username/password, client certificate |
| Bigtable | GCP service account |

## Limitations

- No lineage extraction (no query logs in most NoSQL databases)
- No usage statistics
- No profiler (no SQL-based data quality)
- Schema accuracy depends on sample size
- Nested/polymorphic documents may produce incomplete schemas

## Reference Connectors

- **MongoDB**: `mongodb/` — Connection URI, pymongo client, document sampling
- **DynamoDB**: `dynamodb/` — boto3 client, table/item enumeration
- **Couchbase**: `couchbase/` — SDK client, bucket/scope/collection hierarchy
