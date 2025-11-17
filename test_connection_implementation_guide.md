# Test Connection Implementation Guide

## Quick Reference: What to Add Per Connector

### 1. MYSQL (CRITICAL - Highest Priority)

**File**: `/ingestion/src/metadata/ingestion/source/database/mysql/connection.py`

**Current state**: Only tests `mysql.general_log` or `mysql.slow_log`

**What to add**:

```python
# In queries.py, add these test queries:
MYSQL_TEST_GET_TABLES = """
SELECT TABLE_NAME FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() LIMIT 1
"""

MYSQL_TEST_GET_COLUMNS = """
SELECT COLUMN_NAME FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() LIMIT 1
"""

MYSQL_TEST_GET_VIEWS = """
SELECT TABLE_NAME FROM information_schema.VIEWS 
WHERE TABLE_SCHEMA = DATABASE() LIMIT 1
"""

MYSQL_TEST_GET_CONSTRAINTS = """
SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE LIMIT 1
"""

# In connection.py, update test_connection():
def test_connection(self, ...):
    queries = {
        "GetQueries": MYSQL_TEST_GET_QUERIES or MYSQL_TEST_GET_QUERIES_SLOW_LOGS,
        "GetTables": MYSQL_TEST_GET_TABLES,
        "GetColumns": MYSQL_TEST_GET_COLUMNS,
        "GetViews": MYSQL_TEST_GET_VIEWS,
        "GetConstraints": MYSQL_TEST_GET_CONSTRAINTS,
    }
    return test_connection_db_schema_sources(...)
```

**Impact**: Validates that user can actually extract tables and schemas, not just read query logs

---

### 2. ORACLE (CRITICAL - Highest Priority)

**File**: `/ingestion/src/metadata/ingestion/source/database/oracle/queries.py` and `connection.py`

**Current state**: Only tests DBA_TABLES (minimal), DBA_MVIEWS, DBA_SOURCE packages, and gv$sql

**What to add**:

```python
# In queries.py, add these test queries:
TEST_ORACLE_GET_TABLES = """
SELECT COUNT(*) as count FROM DBA_TABLES WHERE ROWNUM = 1
"""

TEST_ORACLE_GET_COLUMNS = """
SELECT COUNT(*) as count FROM DBA_TAB_COLS WHERE ROWNUM = 1
"""

TEST_ORACLE_GET_CONSTRAINTS = """
SELECT COUNT(*) as count FROM DBA_CONSTRAINTS 
WHERE CONSTRAINT_TYPE IN ('P', 'U', 'R', 'C') AND ROWNUM = 1
"""

TEST_ORACLE_GET_TABLE_COMMENTS = """
SELECT COUNT(*) as count FROM DBA_TAB_COMMENTS WHERE ROWNUM = 1
"""

TEST_ORACLE_GET_STORED_PROCEDURES = """
SELECT COUNT(*) as count FROM DBA_SOURCE 
WHERE TYPE = 'PROCEDURE' AND ROWNUM = 1
"""

TEST_ORACLE_GET_COLUMN_COMMENTS = """
SELECT COUNT(*) as count FROM DBA_COL_COMMENTS WHERE ROWNUM = 1
"""

TEST_ORACLE_GET_VIEWS = """
SELECT COUNT(*) as count FROM DBA_VIEWS WHERE ROWNUM = 1
"""

TEST_ORACLE_GET_PARTITIONS = """
SELECT COUNT(*) as count FROM DBA_TAB_PARTITIONS WHERE ROWNUM = 1
"""

# In connection.py, update test_connection():
def test_connection(self, ...):
    test_conn_queries = {
        "CheckAccess": CHECK_ACCESS_TO_ALL,
        "GetTables": TEST_ORACLE_GET_TABLES,
        "GetColumns": TEST_ORACLE_GET_COLUMNS,
        "GetConstraints": TEST_ORACLE_GET_CONSTRAINTS,
        "GetTableComments": TEST_ORACLE_GET_TABLE_COMMENTS,
        "GetStoredProcedures": TEST_ORACLE_GET_STORED_PROCEDURES,
        "GetColumnComments": TEST_ORACLE_GET_COLUMN_COMMENTS,
        "GetViews": TEST_ORACLE_GET_VIEWS,
        "GetMaterializedViews": TEST_MATERIALIZED_VIEWS,
        "GetPartitions": TEST_ORACLE_GET_PARTITIONS,
        "GetQueryHistory": TEST_QUERY_HISTORY,
        "PackageAccess": TEST_ORACLE_GET_STORED_PACKAGES,
    }
    return test_connection_db_common(...)
```

**Impact**: Validates access to 8+ essential Oracle system tables before attempting extraction

---

### 3. MSSQL (CRITICAL - Highest Priority)

**File**: `/ingestion/src/metadata/ingestion/source/database/mssql/queries.py` and `connection.py`

**Current state**: Only tests query history (sys.dm_exec_cached_plans)

**What to add**:

```python
# In queries.py, add these test queries:
MSSQL_TEST_GET_TABLES = """
SELECT COUNT(*) FROM sys.objects 
WHERE type IN ('U', 'V') AND database_id = DB_ID()
"""

MSSQL_TEST_GET_SCHEMAS = """
SELECT COUNT(*) FROM sys.schemas
"""

MSSQL_TEST_GET_COLUMNS = """
SELECT COUNT(*) FROM sys.columns LIMIT 1
"""

MSSQL_TEST_GET_PROCEDURES = """
SELECT COUNT(*) FROM sys.procedures
"""

MSSQL_TEST_GET_CONSTRAINTS = """
SELECT COUNT(*) FROM sys.constraints LIMIT 1
"""

MSSQL_TEST_GET_FOREIGN_KEYS = """
SELECT COUNT(*) FROM sys.foreign_keys LIMIT 1
"""

MSSQL_TEST_GET_EXTENDED_PROPERTIES = """
SELECT COUNT(*) FROM sys.extended_properties LIMIT 1
"""

# In connection.py, update test_connection():
def test_connection(...):
    queries = {
        "GetTables": MSSQL_TEST_GET_TABLES,
        "GetSchemas": MSSQL_TEST_GET_SCHEMAS,
        "GetColumns": MSSQL_TEST_GET_COLUMNS,
        "GetProcedures": MSSQL_TEST_GET_PROCEDURES,
        "GetConstraints": MSSQL_TEST_GET_CONSTRAINTS,
        "GetForeignKeys": MSSQL_TEST_GET_FOREIGN_KEYS,
        "GetComments": MSSQL_TEST_GET_EXTENDED_PROPERTIES,
        "GetQueries": MSSQL_TEST_GET_QUERIES,
        "GetDatabases": MSSQL_GET_DATABASE,
    }
    return test_connection_db_common(...)
```

**Impact**: Validates core SQL Server system table access before extraction

---

### 4. PostgreSQL (HIGH Priority)

**File**: `/ingestion/src/metadata/ingestion/source/database/postgres/queries.py` and `connection.py`

**Current state**: Has 6 test queries but missing stored procedures, partitions, and foreign keys

**What to add**:

```python
# In queries.py, add these test queries:
POSTGRES_TEST_GET_STORED_PROCEDURES = """
SELECT COUNT(*) as count FROM pg_proc 
WHERE prokind = 'p' AND pg_namespace.nspname != 'pg_catalog' LIMIT 1
"""

POSTGRES_TEST_GET_FUNCTIONS = """
SELECT COUNT(*) as count FROM pg_proc 
WHERE prokind = 'f' AND pg_namespace.nspname != 'pg_catalog' LIMIT 1
"""

POSTGRES_TEST_GET_PARTITION_DETAILS = """
SELECT COUNT(*) as count FROM pg_partitioned_table LIMIT 1
"""

POSTGRES_TEST_GET_FOREIGN_KEYS = """
SELECT COUNT(*) as count FROM pg_constraint 
WHERE contype = 'f' LIMIT 1
"""

POSTGRES_TEST_GET_TABLE_OWNERS = """
SELECT COUNT(*) as count FROM pg_tables LIMIT 1
"""

POSTGRES_TEST_GET_SCHEMA_COMMENTS = """
SELECT COUNT(*) as count FROM pg_namespace 
LEFT JOIN pg_description ON pg_description.objoid = pg_namespace.oid 
LIMIT 1
"""

# In connection.py, update test_connection():
def test_connection(...):
    queries = {
        "GetQueries": POSTGRES_TEST_GET_QUERIES.format(...),
        "GetDatabases": POSTGRES_GET_DATABASE,
        "GetStoredProcedures": POSTGRES_TEST_GET_STORED_PROCEDURES,
        "GetFunctions": POSTGRES_TEST_GET_FUNCTIONS,
        "GetPartitions": POSTGRES_TEST_GET_PARTITION_DETAILS,
        "GetForeignKeys": POSTGRES_TEST_GET_FOREIGN_KEYS,
        "GetTableOwners": POSTGRES_TEST_GET_TABLE_OWNERS,
        "GetSchemaComments": POSTGRES_TEST_GET_SCHEMA_COMMENTS,
        "GetTags": POSTGRES_TEST_GET_TAGS,
        "GetColumnMetadata": TEST_COLUMN_METADATA,
        "GetTableComments": TEST_TABLE_COMMENTS,
        "GetInformationSchemaColumns": TEST_INFORMATION_SCHEMA_COLUMNS,
    }
    return test_connection_db_common(...)
```

**Impact**: Validates access to PostgreSQL advanced features

---

### 5. Snowflake (MODERATE Priority)

**File**: `/ingestion/src/metadata/ingestion/source/database/snowflake/queries.py` and `connection.py`

**Current state**: Good coverage for main features, but missing conditional tests for stored procedures

**What to add**:

```python
# In queries.py, add these test queries (conditional):
SNOWFLAKE_TEST_GET_PROCEDURES = """
SHOW PROCEDURES LIMIT 1
"""

SNOWFLAKE_TEST_GET_FUNCTIONS = """
SHOW FUNCTIONS LIMIT 1
"""

SNOWFLAKE_TEST_GET_EXTERNAL_TABLES = """
SELECT TABLE_NAME FROM "{database_name}".information_schema.tables 
WHERE TABLE_TYPE = 'EXTERNAL TABLE' LIMIT 1
"""

# In connection.py, update test_connection():
def test_connection(...):
    test_fn = {
        # ... existing tests ...
        "GetProcedures": (
            partial(test_table_query, statement=SNOWFLAKE_TEST_GET_PROCEDURES, 
                    engine_wrapper=engine_wrapper)
            if self.service_connection.includeStoredProcedures else None
        ),
        "GetFunctions": (
            partial(test_table_query, statement=SNOWFLAKE_TEST_GET_FUNCTIONS,
                    engine_wrapper=engine_wrapper)
            if self.service_connection.includeStoredProcedures else None
        ),
        "GetExternalTables": partial(
            test_table_query,
            statement=SNOWFLAKE_TEST_GET_EXTERNAL_TABLES,
            engine_wrapper=engine_wrapper,
        ),
    }
    # Filter out None values (conditional tests)
    test_fn = {k: v for k, v in test_fn.items() if v is not None}
    
    return test_connection_steps(...)
```

**Impact**: Validates optional feature access conditionally based on configuration

---

### 6. BigQuery (MODERATE Priority)

**File**: `/ingestion/src/metadata/ingestion/source/database/bigquery/connection.py`

**Current state**: Good basic coverage, but missing stored procedures test

**What to add**:

```python
# In queries.py, add these test queries:
BIGQUERY_TEST_GET_STORED_PROCEDURES = """
SELECT ROUTINE_NAME FROM `{project_id}.region-{region}.INFORMATION_SCHEMA.ROUTINES`
WHERE ROUTINE_TYPE = 'PROCEDURE' LIMIT 1
"""

BIGQUERY_TEST_GET_MATERIALIZED_VIEWS = """
SELECT table_name FROM `{project_id}.region-{region}.INFORMATION_SCHEMA.TABLES`
WHERE table_type = 'MATERIALIZED_VIEW' LIMIT 1
"""

BIGQUERY_TEST_GET_EXTERNAL_TABLES = """
SELECT table_name FROM `{project_id}.region-{region}.INFORMATION_SCHEMA.TABLES`
WHERE table_type = 'EXTERNAL' LIMIT 1
"""

# In connection.py, update test_connection():
def test_connection_inner(engine):
    test_fn = {
        # ... existing tests ...
        "GetStoredProcedures": (
            partial(test_query, engine=engine, 
                   statement=BIGQUERY_TEST_GET_STORED_PROCEDURES.format(...))
            if service_connection.includeStoredProcedures else None
        ),
        "GetMaterializedViews": partial(
            test_query, engine=engine,
            statement=BIGQUERY_TEST_GET_MATERIALIZED_VIEWS.format(...)
        ),
        "GetExternalTables": partial(
            test_query, engine=engine,
            statement=BIGQUERY_TEST_GET_EXTERNAL_TABLES.format(...)
        ),
    }
    # Filter out None values
    test_fn = {k: v for k, v in test_fn.items() if v is not None}
    
    return test_connection_steps(...)
```

**Impact**: Validates optional features conditionally

---

### 7. Redshift (LOW-MODERATE Priority)

**File**: `/ingestion/src/metadata/ingestion/source/database/redshift/queries.py` and `connection.py`

**Current state**: Good core coverage, but missing comments and explicit constraint tests

**What to add**:

```python
# In queries.py, add these test queries:
REDSHIFT_TEST_GET_TABLE_COMMENTS = """
SELECT COUNT(*) FROM pg_description 
WHERE objsubid = 0 LIMIT 1
"""

REDSHIFT_TEST_GET_COLUMN_METADATA = """
SELECT COUNT(*) FROM pg_attribute 
WHERE attnum > 0 LIMIT 1
"""

REDSHIFT_TEST_GET_CONSTRAINTS = """
SELECT COUNT(*) FROM pg_constraint LIMIT 1
"""

# In connection.py, update test_connection():
test_fn = {
    # ... existing tests ...
    "GetTableComments": partial(
        test_query, statement=REDSHIFT_TEST_GET_TABLE_COMMENTS, engine=engine
    ),
    "GetColumnMetadata": partial(
        test_query, statement=REDSHIFT_TEST_GET_COLUMN_METADATA, engine=engine
    ),
    "GetConstraints": partial(
        test_query, statement=REDSHIFT_TEST_GET_CONSTRAINTS, engine=engine
    ),
}
```

**Impact**: Validates comment and constraint access

---

## Implementation Checklist

### For Each Connector:

- [ ] Identify all system tables/views used in metadata extraction
- [ ] Create test queries for each system table
- [ ] Add test queries to `queries.py`
- [ ] Update `test_connection()` method in `connection.py`
- [ ] Handle conditional tests based on configuration options
- [ ] Add error handling for missing permissions
- [ ] Test with restricted user accounts
- [ ] Document required permissions in inline comments
- [ ] Update connection test documentation

### Testing Strategy:

1. **Full Permissions Test**: User with all required permissions
   - Expected: All tests pass
   - Actual: Record baseline

2. **Minimal Permissions Test**: User with only basic connection permission
   - Expected: Connection succeeds, specific feature tests fail gracefully
   - Actual: Validate proper error messages

3. **Metadata Extraction Test**: Run full ingestion with test connection results
   - Expected: Extraction results match test connection capabilities
   - Actual: Verify test coverage predicts extraction success

4. **Documentation Test**: Verify error messages guide users to required permissions
   - Expected: Users understand why tests fail
   - Actual: Document fix instructions

---

## Error Handling Pattern

All test queries should follow this pattern:

```python
def test_connection(self, ...):
    queries = {
        "FeatureName": "SELECT ... LIMIT 1",
    }
    
    result = test_connection_db_common(
        metadata=metadata,
        engine=self.client,
        service_connection=self.service_connection,
        queries=queries,
        timeout_seconds=timeout_seconds,
    )
    
    # test_connection_db_common already handles:
    # - Permission errors gracefully
    # - Timeout handling
    # - Result validation
    # - Error logging
    
    return result
```

The `test_connection_db_common()` function wraps each query in try-catch and logs failures without stopping the entire test.

---

## Documentation Requirements

For each test query added, add a comment explaining:

```python
# TEST: {Feature Name}
# System Table(s): {table/view names}
# Permission Required: {required grant/role}
# When Used: {metadata extraction scenario}
# Risk if Failed: {impact description}
QUERY_NAME = """..."""
```

Example:

```python
# TEST: Stored Procedure Discovery
# System Table(s): pg_proc, pg_namespace
# Permission Required: SELECT on pg_proc and pg_namespace catalogs
# When Used: When includeStoredProcedures=true
# Risk if Failed: Stored procedures won't be extracted, user sees incomplete metadata
POSTGRES_TEST_GET_STORED_PROCEDURES = """
SELECT COUNT(*) FROM pg_proc WHERE prokind = 'p' LIMIT 1
"""
```

---

## Regression Prevention

After implementation:

1. Add unit tests that verify test queries are called
2. Add integration tests with permission-limited users
3. Document expected behavior for each permission level
4. Monitor ingestion logs for permission errors
5. Alert users when metadata extraction lags test results

