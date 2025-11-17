# Test Connection Gaps - Detailed Analysis Matrix

## Metadata Extraction vs Test Connection Coverage

### PostgreSQL

#### System Tables/Views Accessed During Metadata Extraction:

| System Table | Purpose | Test Query | Currently Tested | Recommendation |
|--------------|---------|------------|------------------|-----------------|
| pg_class | Table/view names & types | POSTGRES_GET_TABLE_NAMES | ❌ No | ADD: Test table listing |
| pg_namespace | Schema filtering | POSTGRES_GET_SCHEMA_NAMES | ✅ Via inspector | Maintain |
| pg_attribute | Column information | POSTGRES_SQL_COLUMNS | ❌ No | ADD: TEST_COLUMN_METADATA (dummy query added) |
| pg_description | Comments on all objects | POSTGRES_TABLE_COMMENTS | ✅ TEST_TABLE_COMMENTS | Maintain |
| pg_proc | Stored procedures & functions | POSTGRES_GET_STORED_PROCEDURES | ❌ No | **CRITICAL: ADD** |
| pg_proc | Functions | POSTGRES_GET_FUNCTIONS | ❌ No | **CRITICAL: ADD** |
| pg_partitioned_table | Partition information | POSTGRES_PARTITION_DETAILS | ❌ No | **CRITICAL: ADD** |
| pg_constraint | Foreign key constraints | POSTGRES_FETCH_FK | ❌ No | **HIGH: ADD** |
| pg_tables | Table owners | POSTGRES_TABLE_OWNERS | ❌ No | **HIGH: ADD** |
| information_schema.views | View definitions | POSTGRES_VIEW_DEFINITIONS | ❌ No | **HIGH: ADD** |
| pg_stat_statements | Query history | POSTGRES_TEST_GET_QUERIES | ✅ Yes | Maintain |

#### Gap Summary:
- **Total system tables accessed**: 11
- **Currently tested**: 3 (27%)
- **Missing critical tests**: 8 (73%)
- **Risk**: High - Core metadata extraction for procedures and partitions untested

### MySQL

#### System Tables/Views Accessed During Metadata Extraction:

| System Table | Purpose | Test Query | Currently Tested | Recommendation |
|--------------|---------|------------|------------------|-----------------|
| information_schema.TABLES | Table/schema listing | (Native reflection) | ❌ No | **CRITICAL: ADD** |
| information_schema.COLUMNS | Column information | (Native reflection) | ❌ No | **CRITICAL: ADD** |
| information_schema.VIEWS | View listing | (Native reflection) | ❌ No | **CRITICAL: ADD** |
| information_schema.KEY_COLUMN_USAGE | Foreign key constraints | inspector.get_foreign_keys() | ❌ No | **CRITICAL: ADD** |
| information_schema.STATISTICS | Index information | inspector.get_indexes() | ❌ No | **HIGH: ADD** |
| mysql.general_log | Query history (if enabled) | MYSQL_TEST_GET_QUERIES | ✅ Yes | Maintain |
| mysql.slow_log | Query history (slow queries) | MYSQL_TEST_GET_QUERIES_SLOW_LOGS | ✅ Yes | Maintain |

#### Gap Summary:
- **Total system tables accessed**: 7
- **Currently tested**: 2 (28%) - but only query logs
- **Missing critical tests**: 5 (72%)
- **Risk**: CRITICAL - Can't extract tables, schemas, views, or columns

#### Query Examples to Add:

```sql
-- Test table schema access
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'test' LIMIT 1

-- Test column access
SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'test' LIMIT 1

-- Test view access
SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = 'test' LIMIT 1

-- Test constraint access
SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE LIMIT 1
```

### Snowflake

#### System Tables/Views Accessed During Metadata Extraction:

| System Object | Purpose | Test Query | Currently Tested | Recommendation |
|---------------|---------|------------|------------------|-----------------|
| information_schema.tables | Table/view/stream listing | SNOWFLAKE_TEST_GET_TABLES | ✅ Yes | Maintain |
| information_schema.views | View definitions | (Part of GetTables) | ⚠️ Partial | Add explicit view test |
| SHOW STREAMS | Stream metadata | SNOWFLAKE_TEST_GET_STREAMS | ✅ Yes | Maintain |
| information_schema.table_lineage | Lineage info | (Not tested) | ❌ No | Optional: ADD |
| account_usage.query_history | Query history | SNOWFLAKE_TEST_GET_QUERIES | ✅ Yes | Maintain |
| account_usage.tag_references | Tag information | SNOWFLAKE_TEST_FETCH_TAG | ✅ Yes | Maintain |
| DESCRIBE PROCEDURE | Stored procedure access | (Not tested) | ❌ No | **HIGH: ADD if includeStoredProcedures=true** |
| SHOW FUNCTIONS | Function discovery | (Not tested) | ❌ No | **HIGH: ADD if includeStoredProcedures=true** |
| information_schema.tables (TYPE='EXTERNAL TABLE') | External tables | SNOWFLAKE_TEST_GET_TABLES | ⚠️ Partial | Add explicit external table test |

#### Gap Summary:
- **Total system objects accessed**: 9
- **Currently tested**: 4 (44%)
- **Conditionally critical**: 2 (stored procedures/functions - if feature enabled)
- **Risk**: Moderate - Core functionality works, but advanced features untested

#### Query Examples to Add:

```snowflake
-- Test stored procedure access (only if includeStoredProcedures=true)
DESCRIBE PROCEDURE IF EXISTS system.test_proc()

-- Test function access (only if includeStoredProcedures=true)
SHOW FUNCTIONS

-- Test external table access
SELECT TABLE_NAME FROM information_schema.tables 
WHERE TABLE_SCHEMA = '{schema}' AND TABLE_TYPE = 'EXTERNAL TABLE' LIMIT 1
```

### Oracle

#### System Tables/Views Accessed During Metadata Extraction:

| System Table | Purpose | Test Query | Currently Tested | Recommendation |
|--------------|---------|------------|------------------|-----------------|
| DBA_TABLES | Table listing | ORACLE_GET_TABLE_NAMES | ⚠️ Minimal | **CRITICAL: Expand test** |
| DBA_VIEWS | View listing | GET_VIEW_NAMES | ❌ No | **CRITICAL: ADD** |
| DBA_MVIEWS | Materialized view listing | GET_MATERIALIZED_VIEW_NAMES | ✅ TEST_MATERIALIZED_VIEWS | Maintain |
| DBA_TAB_COLS | Column information | ORACLE_GET_COLUMNS | ❌ No | **CRITICAL: ADD** |
| DBA_COL_COMMENTS | Column comments | (Part of column fetch) | ❌ No | **CRITICAL: ADD** |
| DBA_TAB_COMMENTS | Table comments | ORACLE_ALL_TABLE_COMMENTS | ❌ No | **CRITICAL: ADD** |
| DBA_CONSTRAINTS | Constraint definitions | ORACLE_ALL_CONSTRAINTS | ❌ No | **CRITICAL: ADD** |
| DBA_CONS_COLUMNS | Constraint column mappings | (Part of constraint fetch) | ❌ No | **CRITICAL: ADD** |
| DBA_SOURCE | Stored procedures | ORACLE_GET_STORED_PROCEDURES | ❌ No | **CRITICAL: ADD** |
| DBA_SOURCE | Stored packages | TEST_ORACLE_GET_STORED_PACKAGES | ✅ Yes | Maintain |
| DBA_TAB_PARTITIONS | Partition information | (Not used) | ❌ No | Optional: ADD |
| DBA_TAB_IDENTITY_COLS | Identity column info | ORACLE_IDENTITY_TYPE | ❌ No | **HIGH: ADD** |
| gv$sql | Query history | TEST_QUERY_HISTORY | ✅ Yes | Maintain |

#### Gap Summary:
- **Total system tables accessed**: 13
- **Currently tested**: 2-3 (15-23%)
- **Critical gaps**: 8 tables (61%)
- **Risk**: CRITICAL - Can't extract tables, columns, constraints, or comments

#### Query Examples to Add:

```sql
-- Test table access
SELECT COUNT(*) FROM DBA_TABLES WHERE ROWNUM = 1

-- Test column access
SELECT COUNT(*) FROM DBA_TAB_COLS WHERE ROWNUM = 1

-- Test constraints
SELECT COUNT(*) FROM DBA_CONSTRAINTS WHERE CONSTRAINT_TYPE IN ('P', 'U', 'R', 'C') AND ROWNUM = 1

-- Test table comments
SELECT COUNT(*) FROM DBA_TAB_COMMENTS WHERE ROWNUM = 1

-- Test stored procedures (not packages)
SELECT COUNT(*) FROM DBA_SOURCE WHERE TYPE = 'PROCEDURE' AND ROWNUM = 1

-- Test column comments
SELECT COUNT(*) FROM DBA_COL_COMMENTS WHERE ROWNUM = 1
```

### MSSQL

#### System Tables/Views Accessed During Metadata Extraction:

| System Table | Purpose | Test Query | Currently Tested | Recommendation |
|--------------|---------|------------|------------------|-----------------|
| sys.objects | Tables and views | (Not tested) | ❌ No | **CRITICAL: ADD** |
| sys.schemas | Schema listing | (Not tested) | ❌ No | **CRITICAL: ADD** |
| sys.columns | Column information | (Not tested) | ❌ No | **CRITICAL: ADD** |
| sys.types | Data type definitions | (Not tested) | ❌ No | **CRITICAL: ADD** |
| sys.procedures | Stored procedure listing | MSSQL_GET_STORED_PROCEDURES | ❌ No | **CRITICAL: ADD** |
| sys.extended_properties | Comments (all types) | MSSQL_GET_TABLE_COMMENTS | ❌ No | **CRITICAL: ADD** |
| sys.foreign_keys | Foreign key constraints | (Not tested) | ❌ No | **CRITICAL: ADD** |
| sys.constraints | All constraints | (Not tested) | ❌ No | **CRITICAL: ADD** |
| sys.indexes | Index information | (Not tested) | ❌ No | **HIGH: ADD** |
| sys.dm_exec_cached_plans | Query execution info | MSSQL_TEST_GET_QUERIES | ✅ Yes | Maintain |
| sys.dm_exec_query_stats | Query statistics | (Part of query test) | ✅ Yes | Maintain |

#### Gap Summary:
- **Total system tables accessed**: 11
- **Currently tested**: 2 (18%)
- **Critical gaps**: 7 tables (64%)
- **Risk**: CRITICAL - Can't extract core metadata (tables, schemas, columns)

#### Query Examples to Add:

```sql
-- Test table/view access
SELECT COUNT(*) FROM sys.objects WHERE type IN ('U', 'V')

-- Test schema access
SELECT COUNT(*) FROM sys.schemas

-- Test column access
SELECT COUNT(*) FROM sys.columns LIMIT 1

-- Test procedure access
SELECT COUNT(*) FROM sys.procedures

-- Test extended properties (comments)
SELECT COUNT(*) FROM sys.extended_properties WHERE class = 1

-- Test foreign key access
SELECT COUNT(*) FROM sys.foreign_keys

-- Test constraint access
SELECT COUNT(*) FROM sys.constraints
```

### Databricks

#### System Objects/Tables Accessed During Metadata Extraction:

| System Object | Purpose | Test Query | Currently Tested | Recommendation |
|---------------|---------|------------|------------------|-----------------|
| SHOW CATALOGS | Catalog listing | test_connection function | ✅ Yes | Maintain |
| Get_schema_names | Schema discovery | DATABRICKS_GET_CATALOGS | ✅ Yes | Maintain |
| SHOW TABLES | Table listing | (Custom code) | ✅ Yes | Maintain |
| SHOW VIEWS | View listing | (Custom code) | ✅ Yes | Maintain |
| information_schema.views | View definitions | TEST_VIEW_DEFINITIONS | ✅ Yes | Maintain |
| information_schema.table_tags | Table tags | TEST_TABLE_TAGS | ✅ Yes | Maintain |
| information_schema.column_tags | Column tags | TEST_COLUMN_TAGS | ✅ Yes | Maintain |
| information_schema.schema_tags | Schema tags | TEST_SCHEMA_TAGS | ✅ Yes | Maintain |
| information_schema.catalog_tags | Catalog tags | TEST_CATALOG_TAGS | ✅ Yes | Maintain |
| system.access.table_lineage | Table lineage | TEST_TABLE_LINEAGE | ✅ Yes (conditional) | Maintain with warning |
| system.access.column_lineage | Column lineage | TEST_COLUMN_LINEAGE | ✅ Yes (conditional) | Maintain with warning |
| SQLAlchemy reflection | Column metadata | (Not explicit test) | ⚠️ Implicit | Add explicit test |
| Partition metadata | Partition info | (Not tested) | ❌ No | Optional: ADD |

#### Gap Summary:
- **Total system objects accessed**: 13
- **Currently tested**: 11 (85%)
- **Conditionally tested**: 2 (system.access - may not be available)
- **Risk**: LOW-MODERATE - Best coverage, but system.access assumption not validated

#### Potential Issues:

```
⚠️ WARNING: system.access catalog may not be available to all users
   - Lineage tests will fail gracefully if catalog unavailable
   - Recommend conditional test based on includeTableLineage setting
   - Document requirement that users need access to system.access catalog
```

#### Query Examples to Add (Optional):

```sql
-- Test column metadata explicitly (if not already validated)
SELECT COUNT(*) FROM information_schema.columns LIMIT 1

-- Test partition info (optional enhancement)
SELECT COUNT(*) FROM information_schema.partitions LIMIT 1

-- Conditional: Only test if user has access to system.access
SELECT COUNT(*) FROM system.access.table_lineage LIMIT 1
SELECT COUNT(*) FROM system.access.column_lineage LIMIT 1
```

### BigQuery

#### System Objects/Resources Accessed During Metadata Extraction:

| Resource Type | Purpose | Test Query | Currently Tested | Recommendation |
|--------------|---------|------------|------------------|-----------------|
| Dataset list | Schema discovery | (Native API call) | ✅ Yes | Maintain |
| Table list | Table discovery | inspector.get_table_names() | ✅ Yes | Maintain |
| Table metadata | Column & partition info | (Native API call) | ✅ Yes | Maintain |
| information_schema.views | View definitions | (Not explicit) | ⚠️ Partial | Add explicit test |
| information_schema.routines | Stored procedures | BIGQUERY_GET_STORED_PROCEDURES | ❌ No | **HIGH: ADD if includeStoredProcedures=true** |
| information_schema.table_storage | Table storage info | (Not tested) | ❌ No | Optional: ADD |
| information_schema.columns | Column access check | (Via table metadata) | ⚠️ Implicit | Add explicit test |
| Policy tags API | Column-level tags | test_tags() function | ⚠️ Conditional | Maintain |
| BigQuery API quotas | Usage quotas | (Implicit in execution) | ⚠️ Implicit | Document requirement |

#### Gap Summary:
- **Total resources accessed**: 9
- **Currently tested**: 5 (56%)
- **Conditionally critical**: 1 (stored procedures - if feature enabled)
- **Risk**: LOW-MODERATE - Core functionality well-tested

#### Query Examples to Add:

```sql
-- Test stored procedure access (only if includeStoredProcedures=true)
SELECT ROUTINE_NAME FROM information_schema.routines 
WHERE ROUTINE_SCHEMA IN (SELECT SCHEMA_NAME FROM information_schema.schemata LIMIT 1) 
LIMIT 1

-- Test materialized view access (explicit)
SELECT TABLE_NAME FROM information_schema.tables 
WHERE TABLE_TYPE = 'MATERIALIZED VIEW' LIMIT 1

-- Test external table access (explicit)
SELECT TABLE_NAME FROM information_schema.tables 
WHERE TABLE_TYPE = 'EXTERNAL' LIMIT 1
```

### Redshift

#### System Tables/Views Accessed During Metadata Extraction:

| System Table | Purpose | Test Query | Currently Tested | Recommendation |
|--------------|---------|------------|------------------|-----------------|
| pg_catalog.pg_class | Table/view information | REDSHIFT_GET_ALL_RELATIONS | ✅ Yes | Maintain |
| pg_catalog.pg_namespace | Schema filtering | inspector.get_schema_names() | ✅ Yes | Maintain |
| pg_catalog.pg_attribute | Column information | (Via SQLAlchemy reflection) | ⚠️ Implicit | Add explicit test |
| pg_catalog.pg_description | Table/column comments | (Not tested) | ❌ No | **HIGH: ADD** |
| pg_catalog.pg_constraint | Constraint information | (Not tested) | ❌ No | **HIGH: ADD** |
| pg_catalog.pg_partitioned_table | Partition info | REDSHIFT_TEST_PARTITION_DETAILS | ✅ Yes | Maintain |
| information_schema.tables | Table listing (redundant) | (Via pg_class) | ⚠️ Redundant | Maintain as fallback |
| information_schema.columns | Column info | (Not tested explicitly) | ❌ No | **HIGH: ADD** |
| pg_catalog.stl_query | Query history | REDSHIFT_TEST_GET_QUERIES | ✅ Yes | Maintain |
| pg_catalog.stl_querytext | Query text archive | (Part of query test) | ✅ Yes | Maintain |
| pg_catalog.svv_table_info | Table info (permissions) | (Part of query test) | ✅ Yes | Maintain |

#### Gap Summary:
- **Total system tables accessed**: 11
- **Currently tested**: 5 (45%)
- **Critical gaps**: 2 tables (18%)
- **Risk**: MODERATE - Core functionality works, but comments and constraints untested

#### Query Examples to Add:

```sql
-- Test table/column comments access
SELECT COUNT(*) FROM pg_description WHERE objsubid > 0 LIMIT 1

-- Test constraint access
SELECT COUNT(*) FROM pg_constraint LIMIT 1

-- Test column metadata explicitly
SELECT COUNT(*) FROM pg_attribute WHERE attnum > 0 LIMIT 1

-- Test foreign key constraints
SELECT COUNT(*) FROM pg_constraint WHERE contype = 'f' LIMIT 1
```

---

## Impact Analysis by Feature

### Stored Procedures/Functions Impact
- **Affected Connectors**: PostgreSQL, Snowflake, Oracle, BigQuery, Redshift
- **User Config**: `includeStoredProcedures` setting
- **Risk if untested**: Users enable feature, test passes, but procedures don't extract

### Partition Metadata Impact
- **Affected Connectors**: PostgreSQL, Oracle, Redshift, BigQuery
- **User Config**: Table partitioning must be enabled in source database
- **Risk if untested**: Partitioned tables show as regular tables, missing partition lineage

### Constraint/Lineage Impact
- **Affected Connectors**: PostgreSQL, MySQL, Oracle, MSSQL, Redshift
- **User Config**: Various constraint extraction options
- **Risk if untested**: Foreign key relationships missing, table lineage incomplete

### Comments/Descriptions Impact
- **Affected Connectors**: All (varies by database)
- **User Config**: Automatic extraction from system metadata
- **Risk if untested**: User doesn't know why comments aren't appearing

---

## Recommendations Priority Matrix

```
PRIORITY 1 (Do First - System Down Equivalent Risk)
├── MySQL: Add 5 critical system table tests
├── Oracle: Add 8 critical DBA table tests  
└── MSSQL: Add 7 critical sys.* table tests

PRIORITY 2 (Do Second - Major Feature Risk)
├── PostgreSQL: Add pg_proc, partitions, FK tests
├── Snowflake: Add stored procedure tests (conditional)
├── BigQuery: Add stored procedure tests (conditional)
└── Redshift: Add comment and constraint tests

PRIORITY 3 (Nice to Have - Minor Gap)
├── Databricks: Validate system.access assumption
└── All: Add partition and external table tests where applicable
```

