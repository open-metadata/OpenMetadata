# OpenMetadata Database Connector Test Connection Analysis Report

## Executive Summary

This report identifies critical gaps between what test connections validate and what metadata extraction actually requires. Many test connections pass but metadata ingestion fails due to missing permissions checks for system tables, stored procedures, partitions, and other advanced features.

**Risk Level**: 🔴 HIGH - Multiple connectors have gaps that will cause silent failures or incomplete data extraction.

---

## PostgreSQL

### Test Connection Coverage ✅

**What test connection DOES check:**
- `GetQueries` - Access to pg_stat_statements
- `GetDatabases` - pg_database catalog  
- `GetTags` - pg_policy, pg_class, pg_namespace
- `GetColumnMetadata` - pg_attribute catalog
- `GetTableComments` - pg_description table
- `GetInformationSchemaColumns` - information_schema.columns

### Metadata Extraction Requirements 📋

The PostgreSQL source extracts:
- **Tables & Views**: pg_class, pg_namespace (regular, partitioned, foreign tables)
- **Stored Procedures**: pg_proc, pg_namespace
- **Functions**: pg_proc
- **Partitions**: pg_partitioned_table, pg_class
- **Table Comments**: pg_description
- **View Definitions**: pg_get_viewdef()
- **Foreign Keys**: pg_constraint, pg_class, pg_namespace
- **Table Owners**: pg_tables, pg_catalog
- **Schema Comments**: pg_namespace, pg_description
- **Columns**: pg_attribute, pg_description

### Test Connection Gaps 🔴

**Critical Gaps (High Risk):**
1. ❌ **Stored Procedures** - `POSTGRES_GET_STORED_PROCEDURES` queries pg_proc but NOT tested during connection
2. ❌ **Functions** - `POSTGRES_GET_FUNCTIONS` queries pg_proc but NOT tested during connection
3. ❌ **Partition Details** - `POSTGRES_PARTITION_DETAILS` queries pg_partitioned_table and information_schema.columns but NOT tested
4. ❌ **Foreign Keys** - `POSTGRES_FETCH_FK` queries pg_constraint but NOT tested
5. ❌ **Table Owners** - Queries pg_tables but NOT validated
6. ❌ **Schema Comments** - `POSTGRES_SCHEMA_COMMENTS` NOT tested

**Minor Gaps:**
- View definitions (pg_get_viewdef) not explicitly tested

### Risk Assessment

**Scenario**: User has SELECT on pg_stat_statements but lacks SELECT on pg_proc or pg_partitioned_table
- ✅ Test connection: PASS
- ❌ Metadata ingestion: FAIL (stored procedures not extracted, partitions not identified)

---

## MySQL

### Test Connection Coverage ✅

**What test connection DOES check:**
- `GetQueries` - mysql.general_log OR mysql.slow_log (depending on configuration)

### Metadata Extraction Requirements 📋

The MySQL source extracts:
- **Tables & Schemas**: information_schema.tables, information_schema.schemata
- **Views**: information_schema.views
- **Columns**: information_schema.columns
- **Table DDLs**: Uses SQLAlchemy reflection
- **Foreign Keys**: inspector.get_foreign_keys()
- **Constraints**: SQLAlchemy reflection

### Test Connection Gaps 🔴

**Critical Gaps (High Risk):**
1. ❌ **Tables** - No test for information_schema.tables access
2. ❌ **Schemas** - No test for schema listing
3. ❌ **Columns** - No test for information_schema.columns
4. ❌ **Views** - No test for view access
5. ❌ **Foreign Keys** - No test for constraint access

**Status**: Only 1 query tested (general_log or slow_log), but metadata extraction requires 5+ system tables/views

### Risk Assessment

**Scenario**: User has access to query logs but lacks SELECT on information_schema
- ✅ Test connection: PASS
- ❌ Metadata ingestion: FAIL (no tables, schemas, or columns extracted)

**Severity**: 🔴 CRITICAL - This is the most incomplete test for a critical connector

---

## Snowflake

### Test Connection Coverage ✅

**What test connection DOES check:**
- `CheckAccess` - General connection
- `GetDatabases` - SHOW DATABASES
- `GetSchemas` - inspector.get_schema_names()
- `GetTables` - information_schema.tables
- `GetViews` - information_schema.views
- `GetStreams` - SHOW STREAMS
- `GetQueries` - account_usage.query_history
- `GetTags` - account_usage.tag_references

### Metadata Extraction Requirements 📋

The Snowflake source extracts:
- **Tables/Views/Streams**: information_schema.tables, SHOW commands
- **External Tables**: information_schema.tables (TABLE_TYPE = 'EXTERNAL TABLE')
- **Stored Procedures**: DESCRIBE PROCEDURE
- **Functions**: SHOW FUNCTIONS, DESCRIBE FUNCTION
- **View Definitions**: pg_get_viewdef()
- **Tags**: account_usage.tag_references
- **Materialized Views**: information_schema.tables
- **Stream Definitions**: SHOW STREAMS, GET_STREAM

### Test Connection Gaps 🔴

**Critical Gaps:**
1. ❌ **Stored Procedures** - Extracted via DESCRIBE PROCEDURE, NOT tested during connection
2. ❌ **Functions** - Extracted via SHOW/DESCRIBE FUNCTION, NOT tested
3. ❌ **External Tables** - Specific subset of information_schema.tables, NOT explicitly tested

**Moderate Gaps:**
- Materialized views tested as part of GetTables, but not distinctly validated

### Risk Assessment

**Scenario**: User has access to standard tables/views but lacks USAGE on procedure schema
- ✅ Test connection: PASS
- ⚠️ Metadata ingestion: PARTIAL FAIL (stored procedures missing if includeStoredProcedures=true)

**Severity**: 🟡 MODERATE - Only affects if includeStoredProcedures is enabled

---

## Oracle

### Test Connection Coverage ✅

**What test connection DOES check:**
- `CheckAccess` - DBA_TABLES (minimal access check)
- `PackageAccess` - DBA_SOURCE (stored packages)
- `GetMaterializedViews` - DBA_MVIEWS
- `GetQueryHistory` - gv$sql

### Metadata Extraction Requirements 📋

The Oracle source extracts:
- **Tables**: DBA_TABLES, DBA_TAB_COLS
- **Views**: DBA_VIEWS
- **Materialized Views**: DBA_MVIEWS
- **Stored Procedures**: DBA_SOURCE (type = 'PROCEDURE')
- **Stored Packages**: DBA_SOURCE (type IN ('PACKAGE', 'PACKAGE BODY'))
- **Columns**: DBA_TAB_COLS, DBA_COL_COMMENTS
- **Constraints**: DBA_CONSTRAINTS, DBA_CONS_COLUMNS
- **Table Comments**: DBA_TAB_COMMENTS
- **Partition Info**: DBA_TAB_PARTITIONS (if present)
- **Column Identity**: DBA_TAB_IDENTITY_COLS

### Test Connection Gaps 🔴

**Critical Gaps (High Risk):**
1. ❌ **Tables** - DBA_TABLES accessed in metadata extraction, but CheckAccess uses minimal check
2. ❌ **Columns** - DBA_TAB_COLS, DBA_COL_COMMENTS NOT tested
3. ❌ **Constraints** - DBA_CONSTRAINTS, DBA_CONS_COLUMNS NOT tested
4. ❌ **Table Comments** - DBA_TAB_COMMENTS NOT tested
5. ❌ **Stored Procedures** - DBA_SOURCE (type='PROCEDURE') NOT tested (only packages tested)
6. ❌ **Partitions** - DBA_TAB_PARTITIONS NOT tested

### Test Connection Gaps Details

- CheckAccess: `SELECT table_name FROM DBA_TABLES where ROWNUM < 2` - Too minimal
- No test for table content/columns
- No test for constraint access (critical for lineage)

### Risk Assessment

**Scenario**: User has DBA role at test time but specific table access is revoked
- ✅ Test connection: PASS (basic DBA_TABLES access verified)
- ❌ Metadata ingestion: PARTIAL FAIL (tables extract but no columns, constraints, or comments)

**Severity**: 🔴 CRITICAL - Missing tests for 6+ essential metadata types

---

## MSSQL

### Test Connection Coverage ✅

**What test connection DOES check:**
- `GetQueries` - sys.dm_exec_cached_plans, sys.dm_exec_query_stats
- `GetDatabases` - Database listing

### Metadata Extraction Requirements 📋

The MSSQL source extracts:
- **Tables & Views**: sys.objects, sys.schemas
- **Columns**: sys.columns, sys.types, sys.extended_properties
- **Stored Procedures**: sys.procedures, sys.schemas
- **Views**: sys.objects (type = 'V')
- **Foreign Keys**: sys.foreign_keys
- **Constraints**: sys.constraints
- **Indexes**: sys.indexes
- **Table Comments**: sys.extended_properties
- **Schema Comments**: sys.extended_properties
- **Database Comments**: sys.extended_properties
- **Stored Procedure Comments**: sys.extended_properties

### Test Connection Gaps 🔴

**Critical Gaps (High Risk):**
1. ❌ **Tables** - sys.objects, sys.schemas NOT tested
2. ❌ **Columns** - sys.columns, sys.types NOT tested
3. ❌ **Views** - sys.objects (views) NOT tested
4. ❌ **Stored Procedures** - sys.procedures NOT tested
5. ❌ **Constraints** - sys.constraints, sys.foreign_keys NOT tested
6. ❌ **Table Comments** - sys.extended_properties NOT tested
7. ❌ **Schema Comments** - sys.extended_properties NOT tested

### Risk Assessment

**Scenario**: User has permission to query execution cache but not to sys.objects or sys.columns
- ✅ Test connection: PASS
- ❌ Metadata ingestion: FAIL (no tables, schemas, or columns extracted)

**Severity**: 🔴 CRITICAL - Only 2 queries tested, but 7+ system tables required for metadata

---

## Databricks

### Test Connection Coverage ✅

**What test connection DOES check:**
- `CheckAccess` - General engine connection
- `GetSchemas` - Inspector schema names
- `GetTables` - SHOW TABLES command
- `GetViews` - SHOW VIEWS command  
- `GetDatabases` - SHOW CATALOGS
- `GetQueries` - Query history table (configurable)
- `GetViewDefinitions` - information_schema.views
- `GetCatalogTags` - information_schema.catalog_tags
- `GetSchemaTags` - information_schema.schema_tags
- `GetTableTags` - information_schema.table_tags
- `GetColumnTags` - information_schema.column_tags
- `GetTableLineage` - system.access.table_lineage
- `GetColumnLineage` - system.access.column_lineage

### Metadata Extraction Requirements 📋

The Databricks source extracts:
- **Catalogs**: SHOW CATALOGS
- **Schemas**: Inspector schema names
- **Tables**: SHOW TABLES
- **Views**: SHOW VIEWS
- **Columns**: SQLAlchemy reflection
- **Partitions**: Partition information
- **Tags**: information_schema (catalog, schema, table, column tags)
- **Lineage**: system.access.table_lineage, system.access.column_lineage
- **View Definitions**: information_schema.views

### Test Connection Assessment 

**Strengths**:
- ✅ Most comprehensive test coverage of all connectors
- ✅ Tests lineage system tables
- ✅ Tests all tag system tables
- ✅ Tests view definitions

**Gaps**:
1. ⚠️ **Columns** - Metadata extraction accesses SQLAlchemy columns, but test only validates tables/views
2. ⚠️ **Partitions** - No explicit test for partition metadata tables
3. ⚠️ **System Schema Access** - LineageTest requires `system.access` catalog, but this may not be available to all users

### Risk Assessment

**Scenario**: User lacks access to system.access catalog for lineage
- ✅ Test connection: PASS (if includeTableLineage=false)
- ⚠️ Metadata ingestion: PARTIAL FAIL (lineage not extracted if system.access inaccessible)

**Severity**: 🟡 MODERATE - Best test coverage, but system.access access assumptions could be validated

---

## BigQuery

### Test Connection Coverage ✅

**What test connection DOES check:**
- `CheckAccess` - General connection
- `GetSchemas` - Inspector schema names
- `GetTables` - inspector.get_table_names(), list_datasets(), list_tables()
- `GetViews` - Tested as part of GetTables
- `GetTags` - Policy tags (if includePolicyTags=true)
- `GetQueries` - Query history table

### Metadata Extraction Requirements 📋

The BigQuery source extracts:
- **Datasets (Schemas)**: client.list_datasets()
- **Tables**: client.list_tables()
- **External Tables**: TABLE_TYPE filtering in list_tables()
- **Views**: TABLE_TYPE = 'VIEW'
- **Materialized Views**: TABLE_TYPE = 'MATERIALIZED_VIEW'
- **Stored Procedures**: Query on information_schema.routines
- **Columns**: Schema introspection, DML_TIME information
- **Policy Tags**: PolicyTagManagerClient (column-level tags)
- **Table Descriptions**: Table metadata
- **Partition Info**: Table schema information

### Test Connection Gaps 🔴

**Critical Gaps:**
1. ❌ **Stored Procedures** - `BIGQUERY_GET_STORED_PROCEDURES` queries information_schema.routines, NOT tested during connection
2. ❌ **Materialized Views** - Extracted but not distinctly tested (mixed with regular views)
3. ❌ **External Tables** - Filtered from list_tables() but not explicitly tested

**Moderate Gaps:**
- Policy tag access tested conditionally, but taxonomy project access not fully validated

### Risk Assessment

**Scenario**: User has dataset access but lacks information_schema.routines permission
- ✅ Test connection: PASS
- ⚠️ Metadata ingestion: PARTIAL FAIL (stored procedures not extracted if includeStoredProcedures=true)

**Severity**: 🟡 MODERATE - Stored procedures optional, but should be tested if enabled

---

## Redshift

### Test Connection Coverage ✅

**What test connection DOES check:**
- `CheckAccess` - General connection
- `GetSchemas` - inspector.get_schema_names()
- `GetTables` - Custom query on pg_class
- `GetViews` - Custom query on pg_class
- `GetQueries` - Query history permission check
- `GetDatabases` - Database names
- `GetPartitionTableDetails` - Partition metadata tables

### Metadata Extraction Requirements 📋

The Redshift source extracts:
- **Databases**: Catalog queries
- **Schemas**: pg_namespace
- **Tables**: pg_class, INFORMATION_SCHEMA.tables
- **Views**: pg_class (relkind = 'v'), INFORMATION_SCHEMA.views
- **Columns**: SQLAlchemy reflection, INFORMATION_SCHEMA.columns
- **Table Comments**: SQLAlchemy reflection
- **Foreign Keys**: pg_constraint
- **Constraints**: SQLAlchemy reflection
- **Partition Info**: pg_partitioned_table (if applicable)
- **Query History**: stl_query, stl_querytext, svv_table_info

### Test Connection Assessment

**Strengths**:
- ✅ Tests partition table details
- ✅ Tests query permission explicitly
- ✅ Tests multiple relation types

**Gaps**:
1. ❌ **Table Comments** - Not tested
2. ❌ **Column Metadata** - Not tested
3. ❌ **Foreign Key Access** - Not tested explicitly
4. ⚠️ **Query History Permissions** - Complex query with stl_query, stl_querytext, svv_table_info, but permission check is simplistic

### Risk Assessment

**Scenario**: User can select from pg_class but lacks access to table comments or column info
- ✅ Test connection: PASS
- ⚠️ Metadata ingestion: PARTIAL FAIL (no table/column descriptions extracted)

**Severity**: 🟡 MODERATE - Core table/view extraction works, but comments and column details may be missing

---

## Summary Table

| Connector | Test Coverage | Critical Gaps | Risk Level |
|-----------|---------------|--------------|-----------|
| **PostgreSQL** | 6 queries | Stored procedures, Functions, Partitions, FK, Owners | 🔴 HIGH |
| **MySQL** | 1 query | Tables, Schemas, Views, Columns, FK | 🔴 CRITICAL |
| **Snowflake** | 8 queries | Stored procedures, Functions, External tables | 🟡 MODERATE |
| **Oracle** | 4 queries | Tables, Columns, Constraints, Procedures, Comments | 🔴 CRITICAL |
| **MSSQL** | 2 queries | Tables, Columns, Views, Procedures, Constraints, Comments | 🔴 CRITICAL |
| **Databricks** | 13 queries | Columns, Partitions, System.access assumptions | 🟡 MODERATE |
| **BigQuery** | 6 queries | Stored procedures, Materialized views, External tables | 🟡 MODERATE |
| **Redshift** | 7 queries | Table comments, Column metadata, FK permissions | 🟡 MODERATE |

---

## Recommendations

### Priority 1: CRITICAL (Implement Immediately)

1. **MySQL**: Add tests for information_schema access
   - Test information_schema.TABLES
   - Test information_schema.COLUMNS
   - Test information_schema.VIEWS
   - Test information_schema.KEY_COLUMN_USAGE (foreign keys)

2. **Oracle**: Expand test coverage
   - Test DBA_TAB_COLS (column access)
   - Test DBA_CONSTRAINTS (constraint access)
   - Test DBA_TAB_COMMENTS (comment access)
   - Test DBA_SOURCE for procedures (not just packages)
   - Test DBA_TAB_PARTITIONS (partition access)

3. **MSSQL**: Add comprehensive system table tests
   - Test sys.objects (tables/views)
   - Test sys.columns (column metadata)
   - Test sys.procedures (stored procedures)
   - Test sys.foreign_keys (constraint access)
   - Test sys.extended_properties (comments)

### Priority 2: HIGH (Implement Soon)

4. **PostgreSQL**: Add missing metadata system table tests
   - Test pg_proc (stored procedures and functions)
   - Test pg_partitioned_table (partition metadata)
   - Test pg_constraint (foreign keys)
   - Test pg_tables for owner information

5. **Snowflake**: Add stored procedure test
   - Test DESCRIBE PROCEDURE access
   - Test SHOW FUNCTIONS access

6. **BigQuery**: Add stored procedure test
   - Test information_schema.ROUTINES access
   - Test MATERIALIZED_VIEW table type access

### Priority 3: MODERATE (Implement as Enhancement)

7. **Databricks**: Validate system.access catalog access for lineage
   - Only test table/column lineage if includeTableLineage=true
   - Warn users if system.access is inaccessible

8. **Redshift**: Add optional tests for comments and constraints
   - Test pg_description for table/column comments
   - Test pg_constraint for constraint access

---

## Implementation Strategy

### Per-Connector Changes

**Template for each connector's `connection.py`:**

```python
def test_connection(self, ...):
    queries = {
        # Existing tests...
        # NEW TESTS based on metadata extraction requirements
        "TestSystemTable1": "SELECT ... FROM system_table_1 LIMIT 1",
        "TestSystemTable2": "SELECT ... FROM system_table_2 LIMIT 1",
        # ...
    }
```

### Validation Approach

For each system table/view accessed during metadata extraction:
1. Create a corresponding test query
2. Add to connection test with descriptive name
3. Test query should fail gracefully if permission missing
4. Document in connection test what permission is required

### Testing Strategy

1. Create test scenarios for each permission level:
   - Minimal: Only SELECT on test tables
   - Standard: SELECT on common system tables
   - Full: All tables required for complete extraction

2. Run metadata extraction with test connections that have:
   - Full permissions → Complete extraction expected
   - Limited permissions → Graceful degradation expected

3. Validate that test connection status matches extraction results

---

## Conclusion

**Current State**: Test connections are incomplete and don't validate critical permissions for system tables required during metadata extraction.

**Impact**: Users may see successful test connections but incomplete metadata extraction, leading to:
- Missing stored procedures/functions
- Missing partition information
- Missing foreign key relationships
- Missing table/column comments
- Incomplete schema information

**Action Required**: Implement comprehensive test coverage for all system tables and views accessed during metadata extraction, particularly for MySQL, Oracle, and MSSQL which have the most significant gaps.
