-- Oracle lineage test schema - base_table is ultimate source, multiple stored procs with temp table chains

-- Tables: Ultimate source
CREATE TABLE base_table (
    col1 NUMBER PRIMARY KEY,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 NUMBER(12, 2),
    col5 NUMBER,
    col6 VARCHAR2(50),
    col7 NUMBER(12, 2),
    col8 NUMBER,
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

-- Tables: Source tables derived from base_table
CREATE TABLE source_table_1 (
    col1 NUMBER PRIMARY KEY,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 NUMBER(12, 2),
    col5 NUMBER,
    col6 VARCHAR2(50),
    col7 NUMBER(12, 2),
    col8 NUMBER,
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

CREATE TABLE source_table_2 (
    col1 NUMBER PRIMARY KEY,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 NUMBER(12, 2),
    col5 NUMBER,
    col6 VARCHAR2(50),
    col7 NUMBER(12, 2),
    col8 NUMBER,
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

CREATE TABLE source_table_3 (
    col1 NUMBER PRIMARY KEY,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 NUMBER(12, 2),
    col5 NUMBER,
    col6 VARCHAR2(50),
    col7 NUMBER(12, 2),
    col8 NUMBER,
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

CREATE TABLE source_table_4 (
    col1 NUMBER PRIMARY KEY,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 NUMBER(12, 2),
    col5 NUMBER,
    col6 VARCHAR2(50),
    col7 NUMBER(12, 2),
    col8 NUMBER,
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

CREATE TABLE source_table_5 (
    col1 NUMBER PRIMARY KEY,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 NUMBER(12, 2),
    col5 NUMBER,
    col6 VARCHAR2(50),
    col7 NUMBER(12, 2),
    col8 NUMBER,
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

CREATE TABLE source_table_6 (
    col1 NUMBER PRIMARY KEY,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 NUMBER(12, 2),
    col5 NUMBER,
    col6 VARCHAR2(50),
    col7 NUMBER(12, 2),
    col8 NUMBER,
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

-- Tables: Target tables for stored procedures
CREATE TABLE target_table_1 (
    col1 NUMBER,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 VARCHAR2(50),
    col5 VARCHAR2(50),
    col6 VARCHAR2(50),
    col7 VARCHAR2(50),
    col8 VARCHAR2(50),
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

CREATE TABLE target_table_2 (
    col1 NUMBER,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 VARCHAR2(50),
    col5 VARCHAR2(50),
    col6 VARCHAR2(50),
    col7 VARCHAR2(50),
    col8 VARCHAR2(50),
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

CREATE TABLE target_table_3 (
    col1 NUMBER,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 VARCHAR2(50),
    col5 VARCHAR2(50),
    col6 VARCHAR2(50),
    col7 VARCHAR2(50),
    col8 VARCHAR2(50),
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

CREATE TABLE target_table_4 (
    col1 NUMBER,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 VARCHAR2(50),
    col5 VARCHAR2(50),
    col6 VARCHAR2(50),
    col7 VARCHAR2(50),
    col8 VARCHAR2(50),
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

CREATE TABLE target_table_5 (
    col1 NUMBER,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 VARCHAR2(50),
    col5 VARCHAR2(50),
    col6 VARCHAR2(50),
    col7 VARCHAR2(50),
    col8 VARCHAR2(50),
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

CREATE TABLE target_table_6 (
    col1 NUMBER,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 VARCHAR2(50),
    col5 VARCHAR2(50),
    col6 VARCHAR2(50),
    col7 VARCHAR2(50),
    col8 VARCHAR2(50),
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

CREATE TABLE merge_target_table (
    col1 NUMBER,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 VARCHAR2(50),
    col5 VARCHAR2(50),
    col6 VARCHAR2(50),
    col7 VARCHAR2(50),
    col8 VARCHAR2(50),
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/

CREATE TABLE update_target_table (
    col1 NUMBER,
    col2 VARCHAR2(50),
    col3 VARCHAR2(50),
    col4 VARCHAR2(50),
    col5 VARCHAR2(50),
    col6 VARCHAR2(50),
    col7 VARCHAR2(50),
    col8 VARCHAR2(50),
    col9 VARCHAR2(50),
    col10 TIMESTAMP DEFAULT SYSDATE
);
/



-- For view lineage

-- Views: Chain from base_table
CREATE VIEW VIEW_1 AS
SELECT col1, col2, col3, col4, col5 FROM base_table WHERE col1 IS NOT NULL;
/

CREATE VIEW VIEW_2 AS
SELECT col1, col2, col3 FROM VIEW_1 WHERE col2 IS NOT NULL;
/

CREATE VIEW VIEW_3 AS
SELECT s1.col1, s1.col2, s1.col3, s2.col4, s2.col5, s2.col6 FROM source_table_1 s1
JOIN source_table_2 s2 ON s1.col1 = s2.col1;
/

CREATE VIEW VIEW_4 AS
SELECT col1, col2, col3, col4, col5, col6 FROM VIEW_3 WHERE col1 IS NOT NULL;
/



-- For stored procedures lineage

CREATE OR REPLACE PROCEDURE query_data_sp IS
    v_total NUMBER;
BEGIN
    SELECT SUM(col4) INTO v_total FROM base_table;
    SELECT SUM(col4) INTO v_total FROM VIEW_1;
END;
/

CREATE OR REPLACE PROCEDURE stored_proc_1 IS
BEGIN
    INSERT INTO target_table_1 (col1, col2, col3, col4)
    SELECT col1, col2, col6, 'PROC1'
    FROM source_table_1
    WHERE col1 IS NOT NULL;
    COMMIT;
END;
/

CREATE OR REPLACE PROCEDURE stored_proc_2 IS
BEGIN
    INSERT INTO target_table_2 (col1, col2, col3, col4)
    WITH intermediate_data AS (
        SELECT col1, col2, col6
        FROM source_table_2
        WHERE col1 IS NOT NULL
    )
    SELECT col1, col2, col6, 'PROC2'
    FROM intermediate_data
    WHERE col2 IS NOT NULL;
    COMMIT;
END;
/

CREATE OR REPLACE PROCEDURE stored_proc_3 IS
BEGIN
    INSERT INTO target_table_3 (col1, col2, col3, col4)
    WITH step1 AS (
        SELECT col1, col2, col3, col4, col5
        FROM source_table_3
        WHERE col1 IS NOT NULL
    ),
    step2 AS (
        SELECT col1, col6, col7, col8, col9
        FROM source_table_3
        WHERE col6 IS NOT NULL
    ),
    step3 AS (
        SELECT s1.col1, s1.col2, s2.col6
        FROM step1 s1
        JOIN step2 s2 ON s1.col1 = s2.col1
    )
    SELECT col1, col2, col6, 'PROC3'
    FROM step3;
    COMMIT;
END;
/

CREATE OR REPLACE PROCEDURE stored_proc_4 IS
BEGIN
    INSERT INTO target_table_4 (col1, col2, col3, col4)
    SELECT col1, col2, col6, 'PROC4'
    FROM source_table_4
    WHERE col1 IS NOT NULL;
    COMMIT;
END;
/

CREATE OR REPLACE PROCEDURE stored_proc_5 IS
BEGIN
    INSERT INTO target_table_5 (col1, col2, col3, col4)
    WITH base_data AS (
        SELECT col1, col2, col6
        FROM source_table_5
        WHERE col1 IS NOT NULL
    ),
    filtered_data AS (
        SELECT col1, col2, col6
        FROM base_data
        WHERE col2 IS NOT NULL
    )
    SELECT col1, col2, col6, 'PROC5'
    FROM filtered_data;
    COMMIT;
END;
/

CREATE OR REPLACE PROCEDURE stored_proc_6 IS
BEGIN
    INSERT INTO target_table_6 (col1, col2, col6) SELECT col1, col2, col6 FROM source_table_6;
    COMMIT;
END;
/

-- Sample data for base_table
INSERT INTO base_table (col1, col2, col3, col4, col5, col6, col7, col8, col9) VALUES
(1, 'A', 'X', 100.00, 10, 'P', 200.00, 20, 'M');
/
INSERT INTO base_table (col1, col2, col3, col4, col5, col6, col7, col8, col9) VALUES
(2, 'B', 'Y', 150.00, 15, 'Q', 250.00, 25, 'N');
/
INSERT INTO base_table (col1, col2, col3, col4, col5, col6, col7, col8, col9) VALUES
(3, 'C', 'Z', 200.00, 20, 'R', 300.00, 30, 'O');
/

-- Sample data for source tables
INSERT INTO source_table_1 SELECT * FROM base_table;
/
INSERT INTO source_table_2 SELECT * FROM base_table;
/
INSERT INTO source_table_3 SELECT * FROM base_table;
/
INSERT INTO source_table_4 SELECT * FROM base_table;
/
INSERT INTO source_table_5 SELECT * FROM base_table;
/
INSERT INTO source_table_6 SELECT * FROM base_table;
/


-- Execute stored procedures to generate lineage

-- few second delay between stored procedure calls to capture accurate lineage
-- DBMS_LOCK.SLEEP is replaced by DBMS_SESSION.SLEEPn in Oracle 18c and later so we are using that here
-- Ref: https://oracle-base.com/articles/18c/dbms_session-sleep-18c
BEGIN DBMS_SESSION.SLEEP(2); END;
/
CALL stored_proc_1();
/
BEGIN DBMS_SESSION.SLEEP(2); END;
/
CALL stored_proc_2();
/
BEGIN DBMS_SESSION.SLEEP(2); END;
/
CALL stored_proc_3();
/
BEGIN DBMS_SESSION.SLEEP(2); END;
/
CALL stored_proc_4();
/
BEGIN DBMS_SESSION.SLEEP(2); END;
/
CALL stored_proc_5();
/
BEGIN DBMS_SESSION.SLEEP(2); END;
/
CALL stored_proc_6();
/
BEGIN DBMS_SESSION.SLEEP(2); END;
/
CALL query_data_sp();
/
BEGIN DBMS_SESSION.SLEEP(2); END;
/



-- For query lineage

-- JOIN: Multiple tables with different join types
CREATE TABLE join_result_table AS
SELECT
    b.col1, b.col2, s1.col3, s2.col4, t1.col5
FROM base_table b
INNER JOIN source_table_1 s1 ON b.col1 = s1.col1
LEFT JOIN source_table_2 s2 ON s1.col2 = s2.col2
RIGHT JOIN target_table_1 t1 ON s2.col3 = t1.col3;
/

-- UNION: Combining data from multiple sources
CREATE TABLE union_result_table AS
SELECT col1, col2, col3 FROM source_table_1
UNION ALL
SELECT col1, col2, col3 FROM source_table_2
UNION
SELECT col1, col2, col3 FROM target_table_1;
/

-- Complex JOIN with subquery and aggregation
CREATE TABLE agg_join_result_table AS
SELECT
    v1.col1,
    v1.col2,
    v1.col3,
    v2.col3 AS v2_col3,
    v3.col3 AS v3_col3,
    v3.col4,
    v3.col5,
    v3.col6,
    b.col9,
    b.col10
FROM VIEW_1 v1
LEFT JOIN VIEW_2 v2 ON v1.col2 = v2.col2
LEFT JOIN VIEW_3 v3 ON v1.col1 = v3.col1
INNER JOIN base_table b ON v1.col1 = b.col1;
/

-- MERGE: Upsert pattern with multiple sources
MERGE INTO merge_target_table tgt
USING (
    SELECT s1.col1, s1.col2, s2.col3, s2.col4, s2.col5,
           s2.col6, s2.col7, s2.col8, s2.col9, s2.col10
    FROM source_table_4 s1
    INNER JOIN source_table_5 s2 ON s1.col1 = s2.col1
) src
ON (tgt.col1 = src.col1)
WHEN MATCHED THEN
    UPDATE SET
        tgt.col2 = src.col2,
        tgt.col3 = src.col3,
        tgt.col4 = src.col4
WHEN NOT MATCHED THEN
    INSERT (col1, col2, col3, col4, col5, col6, col7, col8, col9, col10)
    VALUES (src.col1, src.col2, src.col3, src.col4, src.col5,
            src.col6, src.col7, src.col8, src.col9, src.col10);
/

-- UPDATE with JOIN: Modify existing data based on another table
UPDATE update_target_table t
SET
    t.col2 = (SELECT v.col2 FROM VIEW_3 v WHERE v.col1 = t.col1),
    t.col3 = (SELECT b.col3 FROM base_table b WHERE b.col1 = t.col1)
WHERE t.col1 IN (SELECT col1 FROM source_table_6);
/

-- Complex multi-table JOIN with UNION in subquery
CREATE TABLE complex_join_table AS
SELECT
    b.col1,
    combined.col2,
    combined.col3,
    s6.col4,
    v4.col5,
    v4.col6
FROM base_table b
INNER JOIN (
    SELECT col1, col2, col3 FROM source_table_1
    UNION ALL
    SELECT col1, col2, col3 FROM source_table_2
) combined ON b.col1 = combined.col1
LEFT JOIN source_table_6 s6 ON combined.col2 = s6.col2
LEFT JOIN VIEW_4 v4 ON s6.col3 = v4.col3;
/

-- ============================================================================
-- TEMP TABLE LINEAGE TEST
-- Test the temp table lineage feature where an intermediate table is created
-- from a source, used to create target table and view, then deleted.
-- With enableTempTableLineage=true, lineage should still be captured end-to-end
-- from source_table_1 -> interim_target_table_1 and interim_target_view_1
-- even though interim_temp_table_1 won't exist in metadata.
-- ============================================================================

-- Step 1: Create intermediate table from source
CREATE TABLE interim_temp_table_1 AS
SELECT col1, col2, col3, col4, col5, col6
FROM source_table_1
WHERE col1 IS NOT NULL;
/

-- Step 2: Create target table from intermediate table
CREATE TABLE interim_target_table_1 AS
SELECT col1, col2, col3, col4
FROM interim_temp_table_1
WHERE col2 IS NOT NULL;
/

-- Step 3: Create target view from intermediate table
CREATE VIEW interim_target_view_1 AS
SELECT col1, col2, col5, col6
FROM interim_temp_table_1
WHERE col1 > 0;
-- /


-- Deleting the intermediate table results in gv$sql.object_status = 'INVALID_UNAUTH'
-- since the base object for the target table and view is dropped. To avoid this, we
-- will use tableFilterPattern to exclude interim_temp_table_1 from ingestion instead of
-- dropping it.

-- Step 4: Delete the intermediate table (it won't be ingested into metadata)
-- DROP TABLE interim_temp_table_1;

-- ============================================================================
-- END TEMP TABLE LINEAGE TEST
-- Expected lineage with enableTempTableLineage=true:
--   source_table_1 -> interim_target_table_1
--   source_table_1 -> interim_target_view_1
-- ============================================================================
/

-- Replicate gv$sql with "TEST" schema queries into permanent table for debugging
CREATE TABLE gv_sql_cache AS
SELECT
    INST_ID,
    SQL_TEXT,
    SQL_FULLTEXT,
    SQL_ID,
    SHARABLE_MEM,
    PERSISTENT_MEM,
    RUNTIME_MEM,
    SORTS,
    LOADED_VERSIONS,
    OPEN_VERSIONS,
    USERS_OPENING,
    FETCHES,
    EXECUTIONS,
    PX_SERVERS_EXECUTIONS,
    END_OF_FETCH_COUNT,
    USERS_EXECUTING,
    LOADS,
    FIRST_LOAD_TIME,
    INVALIDATIONS,
    PARSE_CALLS,
    DISK_READS,
    DIRECT_WRITES,
    DIRECT_READS,
    BUFFER_GETS,
    APPLICATION_WAIT_TIME,
    CONCURRENCY_WAIT_TIME,
    CLUSTER_WAIT_TIME,
    USER_IO_WAIT_TIME,
    PLSQL_EXEC_TIME,
    JAVA_EXEC_TIME,
    ROWS_PROCESSED,
    COMMAND_TYPE,
    OPTIMIZER_MODE,
    OPTIMIZER_COST,
    OPTIMIZER_ENV,
    OPTIMIZER_ENV_HASH_VALUE,
    PARSING_USER_ID,
    PARSING_SCHEMA_ID,
    PARSING_SCHEMA_NAME,
    KEPT_VERSIONS,
    ADDRESS,
    TYPE_CHK_HEAP,
    HASH_VALUE,
    OLD_HASH_VALUE,
    PLAN_HASH_VALUE,
    FULL_PLAN_HASH_VALUE,
    CHILD_NUMBER,
    SERVICE,
    SERVICE_HASH,
    MODULE,
    MODULE_HASH,
    ACTION,
    ACTION_HASH,
    SERIALIZABLE_ABORTS,
    OUTLINE_CATEGORY,
    CPU_TIME,
    ELAPSED_TIME,
    OUTLINE_SID,
    CHILD_ADDRESS,
    SQLTYPE,
    REMOTE,
    OBJECT_STATUS,
    LITERAL_HASH_VALUE,
    LAST_LOAD_TIME,
    IS_OBSOLETE,
    IS_BIND_SENSITIVE,
    IS_BIND_AWARE,
    IS_SHAREABLE,
    CHILD_LATCH,
    SQL_PROFILE,
    SQL_PATCH,
    SQL_PLAN_BASELINE,
    PROGRAM_ID,
    PROGRAM_LINE#,
    EXACT_MATCHING_SIGNATURE,
    FORCE_MATCHING_SIGNATURE,
    LAST_ACTIVE_TIME,
    BIND_DATA,
    TYPECHECK_MEM,
    IO_CELL_OFFLOAD_ELIGIBLE_BYTES,
    IO_INTERCONNECT_BYTES,
    PHYSICAL_READ_REQUESTS,
    PHYSICAL_READ_BYTES,
    PHYSICAL_WRITE_REQUESTS,
    PHYSICAL_WRITE_BYTES,
    OPTIMIZED_PHY_READ_REQUESTS,
    LOCKED_TOTAL,
    PINNED_TOTAL,
    IO_CELL_UNCOMPRESSED_BYTES,
    IO_CELL_OFFLOAD_RETURNED_BYTES,
    CON_ID,
    IS_REOPTIMIZABLE,
    IS_RESOLVED_ADAPTIVE_PLAN,
    IM_SCANS,
    IM_SCAN_BYTES_UNCOMPRESSED,
    IM_SCAN_BYTES_INMEMORY,
    DDL_NO_INVALIDATE,
    IS_ROLLING_INVALID,
    IS_ROLLING_REFRESH_INVALID,
    RESULT_CACHE,
    SQL_QUARANTINE,
    AVOIDED_EXECUTIONS,
    HEAP0_LOAD_TIME,
    HEAP6_LOAD_TIME,
    RESULT_CACHE_EXECUTIONS,
    RESULT_CACHE_REJECTION_REASON
FROM gv$sql;
/


-- Replicate gv$sqlstats with all queries into permanent table for debugging
CREATE TABLE gv_sqlstats_cache AS
SELECT
    INST_ID,
    SQL_TEXT,
    SQL_FULLTEXT,
    SQL_ID,
    LAST_ACTIVE_TIME,
    LAST_ACTIVE_CHILD_ADDRESS,
    PLAN_HASH_VALUE,
    PARSE_CALLS,
    DISK_READS,
    DIRECT_WRITES,
    DIRECT_READS,
    BUFFER_GETS,
    ROWS_PROCESSED,
    SERIALIZABLE_ABORTS,
    FETCHES,
    EXECUTIONS,
    END_OF_FETCH_COUNT,
    LOADS,
    VERSION_COUNT,
    INVALIDATIONS,
    PX_SERVERS_EXECUTIONS,
    CPU_TIME,
    ELAPSED_TIME,
    AVG_HARD_PARSE_TIME,
    APPLICATION_WAIT_TIME,
    CONCURRENCY_WAIT_TIME,
    CLUSTER_WAIT_TIME,
    USER_IO_WAIT_TIME,
    PLSQL_EXEC_TIME,
    JAVA_EXEC_TIME,
    SORTS,
    SHARABLE_MEM,
    TOTAL_SHARABLE_MEM,
    TYPECHECK_MEM,
    IO_CELL_OFFLOAD_ELIGIBLE_BYTES,
    IO_INTERCONNECT_BYTES,
    PHYSICAL_READ_REQUESTS,
    PHYSICAL_READ_BYTES,
    PHYSICAL_WRITE_REQUESTS,
    PHYSICAL_WRITE_BYTES,
    EXACT_MATCHING_SIGNATURE,
    FORCE_MATCHING_SIGNATURE,
    IO_CELL_UNCOMPRESSED_BYTES,
    IO_CELL_OFFLOAD_RETURNED_BYTES,
    DELTA_PARSE_CALLS,
    DELTA_DISK_READS,
    DELTA_DIRECT_WRITES,
    DELTA_DIRECT_READS,
    DELTA_BUFFER_GETS,
    DELTA_ROWS_PROCESSED,
    DELTA_FETCH_COUNT,
    DELTA_EXECUTION_COUNT,
    DELTA_PX_SERVERS_EXECUTIONS,
    DELTA_END_OF_FETCH_COUNT,
    DELTA_CPU_TIME,
    DELTA_ELAPSED_TIME,
    DELTA_APPLICATION_WAIT_TIME,
    DELTA_CONCURRENCY_TIME,
    DELTA_CLUSTER_WAIT_TIME,
    DELTA_USER_IO_WAIT_TIME,
    DELTA_PLSQL_EXEC_TIME,
    DELTA_JAVA_EXEC_TIME,
    DELTA_SORTS,
    DELTA_LOADS,
    DELTA_INVALIDATIONS,
    DELTA_PHYSICAL_READ_REQUESTS,
    DELTA_PHYSICAL_READ_BYTES,
    DELTA_PHYSICAL_WRITE_REQUESTS,
    DELTA_PHYSICAL_WRITE_BYTES,
    DELTA_IO_INTERCONNECT_BYTES,
    DELTA_CELL_OFFLOAD_ELIG_BYTES,
    DELTA_CELL_UNCOMPRESSED_BYTES,
    CON_ID,
    CON_DBID,
    OBSOLETE_COUNT,
    AVOIDED_EXECUTIONS,
    DELTA_AVOIDED_EXECUTIONS,
    RESULT_CACHE_EXECUTIONS,
    DELTA_RESULT_CACHE_EXECUTIONS,
    LAST_EXEC_USER_LOCAL,
    LAST_EXEC_USER_ID
FROM gv$sqlstats;
/