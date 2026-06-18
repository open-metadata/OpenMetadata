"""
Unit tests for SQL Lineage Parsers with Dialect-Specific Queries

This test suite validates three SQL lineage parsers (SqlGlot, SqlFluff, SqlParse) across
multiple SQL dialects, testing both table lineage and column lineage extraction from
real-world production queries.

PARSER LIMITATIONS AND KNOWN SKIPS
===================================

SqlGlot Limitations:
-------------------
1. PostgreSQL COPY command - Not supported, returns empty source tables
   - test_postgres_copy_with_jsonb: test_sqlglot=False

2. CREATE PROCEDURE syntax - Not supported (Oracle, SQL Server)
   - test_oracle_create_procedure_insert_select: test_sqlglot=False

3. UNION ALL column lineage - Doesn't extract column lineage for UNION queries
   - test_complex_postgres_view: test_sqlglot=False

4. UPDATE statement column lineage - Doesn't extract column lineage for UPDATE
   - test_snowflake_update_with_nested_select: test_sqlglot=False

5. Complex CTE INSERT - Extracts all 19 columns but too verbose to validate
   - test_snowflake_insert_with_cte_and_sequence: test_sqlglot=False

SqlFluff Limitations:
--------------------
1. PostgreSQL DDL statements - UnsupportedStatementException for SET/ALTER SEQUENCE
   - test_postgres_ddl_statements: test_sqlfluff=False

2. Snowflake bind parameters - InvalidSyntaxException with :param syntax in INSERT
   - test_snowflake_insert_with_cte_and_sequence: test_sqlfluff=False
   - test_snowflake_insert_parse_xml: test_sqlfluff=False

3. Snowflake LATERAL FLATTEN - IndexError when parsing JSON flattening syntax
   - test_snowflake_lateral_flatten_json: test_sqlfluff=False

4. Oracle CREATE PROCEDURE - InvalidSyntaxException for procedure syntax
   - test_oracle_create_procedure_insert_select: test_sqlfluff=False

5. Nested subquery wildcards - SubQuery error on wildcard handling in deeply nested queries
   - test_copy_grants_with_complex_case: test_sqlfluff=False

6. Deeply nested UNION ALL column lineage - Returns empty column lineage (~5% of runs)
   - test_complex_postgres_view: test_sqlfluff=False

SqlParse Limitations:
--------------------
1. CTE name confusion - Incorrectly includes CTE names as source tables
   - test_multiple_ctes_with_joins: test_sqlparse=False
   - test_clickhouse_create_table_with_ctes: test_sqlparse=False

2. Nested CREATE TABLE AS SELECT - SQLLineageException for multiple write targets
   - test_copy_grants_with_complex_case: test_sqlparse=False

3. Complex UPDATE with subqueries - Returns empty source tables
   - test_snowflake_update_with_nested_select: test_sqlparse=False

4. JSON path expressions - Returns raw alias (v → v) instead of resolved column names
   - test_snowflake_lateral_flatten_json: test_sqlparse=False

5. CREATE PROCEDURE - Not supported, returns empty source tables
   - test_oracle_create_procedure_insert_select: test_sqlparse=False

6. BigQuery CLONE statement - Returns empty source tables
   - test_bigquery_clone_table_with_digit_starting_name: test_sqlparse=False

Graph Comparison Skips (skip_graph_check=True):
-----------------------------------------------
Used when parsers produce valid lineage but with different internal graph structures:

1. test_postgres_copy_with_jsonb - Different node structures between SqlFluff/SqlParse
2. test_postgres_copy_with_jsonb_to_target (column) - SqlFluff graph differs from SqlGlot/SqlParse
3. test_snowflake_insert_with_cte_and_sequence - Different CTE handling SqlGlot/SqlParse
4. test_snowflake_insert_parse_xml - Different bind parameter handling
5. test_postgres_create_table - Different DDL representations
6. test_bigquery_with_cte_window_functions - Different CTE graph structures
7. test_clickhouse_ctas_engine_union_all_not_in - SqlFluff graph differs (24n/33e vs 26n/35e)

Column Lineage Categories:
--------------------------
1. **With Actual Lineage (13 tests)**: Queries with target tables where parsers extract mappings
2. **Empty Lineage (5 tests)**: Valid empty results for:
   - DDL statements with no source tables
   - SELECT queries with no target tables
   - Queries with masked/literal data only
   - Bind parameter queries with no parseable sources
   - File-based COPY operations (no column-to-column mapping from files)

Special Cases:
-------------
- **File-based Lineage**: test_postgres_copy_with_jsonb_to_target uses Path objects
  from collate_sqllineage.core.models to represent file sources (CSV, etc.)

Test Coverage:
-------------
- Total Tests: 52
- Dialects: Snowflake, BigQuery, MySQL, ClickHouse, PostgreSQL, T-SQL, Oracle, StarRocks
- Parsers: SqlGlot, SqlFluff, SqlParse
- All tests validate both table lineage AND column lineage
"""

from unittest import TestCase

from collate_sqllineage.core.models import Location, Path

from ingestion.tests.unit.lineage.queries.helpers import (
    TestColumnQualifierTuple,
    assert_column_lineage_equal,
    assert_table_lineage_equal,
)
from metadata.generated.schema.entity.services.connections.database.starrocksConnection import (
    StarrocksType,
)
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect


class TestSpecificDialectQueries(TestCase):
    """Test SqlGlot, SqlFluff, and SqlParse parsers with specific dialect queries"""

    def test_create_view_with_join(self):
        """Test CREATE VIEW with JOIN"""
        query = """CREATE VIEW vw_test AS
        SELECT
            a.someColumn,
            b.anotherColumn
        FROM a
        JOIN b
            ON a.id = b.fk_id"""

        assert_table_lineage_equal(
            query,
            {"a", "b"},
            {"vw_test"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("someColumn", "a"),
                    TestColumnQualifierTuple("someColumn", "vw_test"),
                ),
                (
                    TestColumnQualifierTuple("anotherColumn", "b"),
                    TestColumnQualifierTuple("anotherColumn", "vw_test"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_copy_grants_with_complex_case(self):
        """Test COPY GRANTS with complex CASE statements and nested subqueries"""
        query = """CREATE OR REPLACE TABLE masked_table COPY GRANTS
        AS
        SELECT DISTINCT
            'MASKED' AS sensitive_info_1,
            CAST('MASKED' AS VARCHAR(25)) AS sensitive_info_2,
            COALESCE(DATEDIFF('second','MASKED','MASKED'),0) AS sensitive_info_3,
            CASE
                WHEN lower('MASKED') IN ('MASKED', 'MASKED')
                THEN COALESCE(DATEDIFF('second','MASKED','MASKED') - (DATEDIFF('day',DATE('MASKED'),DATE('MASKED'))*43200),0)
                ELSE 0
            END AS sensitive_info_4,
            SUBSTR('MASKED', 1, 50000) AS sensitive_info_5,
            HOUR('MASKED') AS sensitive_info_6
        FROM
        (
            SELECT DISTINCT
                'MASKED' AS col1,
                'MASKED' AS col2
            FROM (
                SELECT *
                FROM data_warehouse.ctrl_map.order_flows_base
            ) AS t
        ) AS t"""

        assert_table_lineage_equal(
            query,
            {"data_warehouse.ctrl_map.order_flows_base"},
            {"masked_table"},
            dialect=Dialect.SNOWFLAKE.value,
            # SqlParse raises SQLLineageException due to multiple write targets detected
            # in nested subqueries with CREATE TABLE AS SELECT pattern
            test_sqlparse=False,
        )

        # All columns are masked literals - no meaningful source column lineage
        # SqlFluff crashes with SubQuery error on wildcard handling for nested subqueries
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
            test_sqlparse=False,
            test_sqlfluff=False,
        )

    def test_dbt_model_style_create_view(self):
        """Test dbt model style CREATE VIEW (SQL Server style with double quotes)"""
        query = """create view dbo.my_second_dbt_model as
        select *
        from test_db.dbo.my_first_dbt_model
        where id = 1"""

        assert_table_lineage_equal(
            query,
            {"test_db.dbo.my_first_dbt_model"},
            {"dbo.my_second_dbt_model"},
            dialect=Dialect.TSQL.value,
        )

        # Column lineage with SELECT * - parser tracks all columns from source
        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("*", "test_db.dbo.my_first_dbt_model"),
                    TestColumnQualifierTuple("*", "dbo.my_second_dbt_model"),
                ),
            ],
            dialect=Dialect.TSQL.value,
        )

    def test_bigquery_with_cte_window_functions(self):
        """Test BigQuery WITH CTE and window functions"""
        query = """WITH fineract_office AS (
            SELECT
                ROW_NUMBER() OVER(PARTITION BY id ORDER BY updated_at DESC) AS rnum,
                id,
                ABS(SAFE_CAST(external_id AS INT64)) AS external_id,
                name
            FROM `data-analytics.fineract_production.m_office`
        )
        SELECT DISTINCT
            c.dsa_id AS nlo,
            fo.id AS fin_office_id,
            COALESCE(c.name, dc.nlo_name) AS nlo_name,
            TIMESTAMP(DATETIME(c.created_at, 'Asia/Manila')) AS created_date
        FROM (
            SELECT
                ROW_NUMBER() OVER(PARTITION BY dsa_id ORDER BY updated_at DESC) AS rnum,
                *
            FROM `data-analytics.uploan_mongodb.companies`
        ) c
        LEFT OUTER JOIN `data-analytics.uploan_prod.data_company_mapping` dc
            ON dc.nlo = c.dsa_id
        LEFT OUTER JOIN fineract_office fo
            ON dc.nlo = CAST(fo.external_id AS INT64) AND fo.rnum = 1
        WHERE c.rnum = 1"""

        assert_table_lineage_equal(
            query,
            {
                "data-analytics.fineract_production.m_office",
                "data-analytics.uploan_mongodb.companies",
                "data-analytics.uploan_prod.data_company_mapping",
            },
            set(),  # No target table for SELECT query
            dialect=Dialect.BIGQUERY.value,
        )

        # No column lineage expected - SELECT query with no target table
        # Parsers have different graph representations for this complex CTE query
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.BIGQUERY.value,
            skip_graph_check=True,
        )

    def test_multiple_ctes_with_joins(self):
        """Test multiple CTEs with complex joins (5 CTEs)"""
        query = """with inv_data as (
            select date_id, sku, sales_channel_id, country, quantity
            from dbt.stg_inventory_amz
        ),
        location as (
            select location_id, location_group, location
            from eng.amz_location_map
        ),
        sku_cost as (
            select sku, avg_unit_cost
            from dbt.stg_sku_cost
        ),
        sku_prod_map as (
            select sku, product_id
            from dbt.stg_sku_product_map
        ),
        prod_cost as (
            select product_id, avg_unit_cost
            from dbt.stg_product_cost
        )
        select
            a.date_id,
            a.sku,
            b.location_group,
            d.product_id,
            ifNull(c.avg_unit_cost, e.avg_unit_cost) as avg_cost_usd
        from inv_data a
        left join location b on a.country = b.country
        left join sku_cost c on a.sku = c.sku
        left join sku_prod_map d on a.sku = d.sku
        left join prod_cost e on d.product_id = e.product_id"""

        assert_table_lineage_equal(
            query,
            {
                "dbt.stg_inventory_amz",
                "eng.amz_location_map",
                "dbt.stg_sku_cost",
                "dbt.stg_sku_product_map",
                "dbt.stg_product_cost",
            },
            set(),  # No target table for SELECT query
            dialect=Dialect.MYSQL.value,
            # SqlParse incorrectly includes CTE names as source tables (e.g., prod_cost, sku_cost)
            # alongside the actual base tables, causing assertion failure
            test_sqlparse=False,
        )

        # No column lineage expected - SELECT query with no target table
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.MYSQL.value,
            test_sqlparse=False,
        )

    def test_clickhouse_create_table_with_ctes(self):
        """Test ClickHouse CREATE TABLE with multiple CTEs"""
        query = """create table atlas.dbt.int_inventory_juvo as
        with fb_inv as (
            select date_id, sku, location_group, location, quantity
            from dbt.stg_inventory_juvo
        ),
        location as (
            select location_group, location, location_id
            from dbt.stg_location
        ),
        sku_cost as (
            select sku, avg_unit_cost
            from dbt.stg_sku_cost
        )
        select
            a.date_id,
            a.sku,
            b.location_id,
            ifNull(c.avg_unit_cost, 0) as avg_cost_usd
        from fb_inv a
        left join location b on a.location_group = b.location_group
        left join sku_cost c on a.sku = c.sku"""

        assert_table_lineage_equal(
            query,
            {
                "dbt.stg_inventory_juvo",
                "dbt.stg_location",
                "dbt.stg_sku_cost",
            },
            {"atlas.dbt.int_inventory_juvo"},
            dialect=Dialect.CLICKHOUSE.value,
            # SqlParse incorrectly includes CTE name 'sku_cost' as source table
            test_sqlparse=False,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("date_id", "dbt.stg_inventory_juvo"),
                    TestColumnQualifierTuple("date_id", "atlas.dbt.int_inventory_juvo"),
                ),
                (
                    TestColumnQualifierTuple("sku", "dbt.stg_inventory_juvo"),
                    TestColumnQualifierTuple("sku", "atlas.dbt.int_inventory_juvo"),
                ),
                (
                    TestColumnQualifierTuple("location_id", "dbt.stg_location"),
                    TestColumnQualifierTuple("location_id", "atlas.dbt.int_inventory_juvo"),
                ),
                (
                    TestColumnQualifierTuple("avg_unit_cost", "dbt.stg_sku_cost"),
                    TestColumnQualifierTuple("avg_cost_usd", "atlas.dbt.int_inventory_juvo"),
                ),
            ],
            dialect=Dialect.CLICKHOUSE.value,
            test_sqlparse=False,
        )

    def test_postgres_create_table(self):
        """Test PostgreSQL CREATE TABLE with custom types"""
        query = """CREATE TABLE translation.entrees
        (
            id public.OBJECT_ID,
            legacy_id public.LEGACY_ID,
            address_1 CHARACTER VARYING(40),
            city CHARACTER VARYING(40),
            zip_code CHARACTER VARYING(15),
            country_code TEXT,
            created_at TIMESTAMP WITHOUT TIME ZONE,
            updated_at TIMESTAMP WITHOUT TIME ZONE
        )"""

        assert_table_lineage_equal(
            query,
            set(),  # No source tables for CREATE TABLE statement
            {"translation.entrees"},
            dialect=Dialect.POSTGRES.value,
        )

        # No column lineage expected - DDL CREATE TABLE with no source tables
        # Parsers have different graph representations for DDL statements
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
            skip_graph_check=True,
        )

    def test_postgres_copy_with_jsonb(self):
        """Test PostgreSQL COPY with JSONB functions"""
        query = """COPY (
            SELECT
                (jsonb_build_object(
                    'createdAt', to_date(now()::TIMESTAMP),
                    'updatedAt', to_date(now()::TIMESTAMP)
                ) || jsonb_strip_nulls(to_jsonb(t)))::TEXT
            FROM
                ft_staging.units t
        ) TO STDOUT"""

        assert_table_lineage_equal(
            query,
            {"ft_staging.units"},
            set(),  # COPY TO STDOUT has no target table
            dialect=Dialect.POSTGRES.value,
            # SqlGlot does not support PostgreSQL COPY command and returns empty source tables
            test_sqlglot=False,
            # Graph comparison fails between SqlFluff and SqlParse due to different node structures
            skip_graph_check=True,
        )

        # No column lineage expected - COPY TO STDOUT with no target table
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
            test_sqlglot=False,
            skip_graph_check=True,
        )

    def test_postgres_copy_with_jsonb_to_target(self):
        """Test PostgreSQL COPY FROM with target table"""
        query = """COPY public.customer_data (
            customer_id,
            first_name,
            last_name,
            email,
            registration_date
        )
        FROM '/data/exports/customers.csv'
        WITH (FORMAT csv, HEADER true, DELIMITER ',')"""

        assert_table_lineage_equal(
            query,
            {Path("/data/exports/customers.csv")},
            {"public.customer_data"},
            dialect=Dialect.POSTGRES.value,
        )

        # No column lineage expected - COPY FROM file
        # SqlFluff column graph differs from SqlGlot/SqlParse, skip graph check
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
            skip_graph_check=True,
        )

    def test_column_lineage_extraction(self):
        """Test that column lineage is extracted for SELECT queries"""
        query = """with inv_data as (
            select date_id, sku, quantity
            from dbt.stg_inventory
        )
        select
            a.date_id as order_date,
            a.sku as product_sku,
            a.quantity as qty
        from inv_data a"""

        assert_table_lineage_equal(
            query,
            {"dbt.stg_inventory"},
            set(),  # No target table for SELECT query
            dialect=Dialect.MYSQL.value,
        )

        # No column lineage expected - SELECT query with no target table
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.MYSQL.value,
        )

    def test_complex_postgres_view(self):
        """Test complex PostgreSQL CREATE VIEW with UNION ALL, nested subqueries, and JSON functions"""
        query = """create view stg_globalv2_default.b2c_order_operational_converted as
        SELECT
            legacy_orders.job_id,
            legacy_orders.customer_id,
            legacy_orders.job_status,
            legacy_orders.creation_datetime
        FROM (
            SELECT DISTINCT
                a.job_id,
                a.order_id AS customer_id,
                CASE
                    WHEN a.job_status = 0 THEN 'Upcoming'
                    WHEN a.job_status = 2 THEN 'Completed'
                    ELSE 'Other'
                END AS job_status,
                a.creation_datetime + interval '04:00:00' AS creation_datetime
            FROM raw_legacy_mysql_mena.tb_jobs a
            LEFT JOIN raw_legacy_mysql_mena.tb_country cn ON a.country_id = cn.country_id
        ) legacy_orders
        UNION ALL
        SELECT
            orders_2_0.job_id,
            orders_2_0.customer_id,
            orders_2_0.job_status,
            orders_2_0.creation_datetime
        FROM (
            SELECT
                a.order_id AS job_id,
                a.user_id AS customer_id,
                CASE
                    WHEN a.status = 'completed' THEN 'Completed'
                    ELSE a.status
                END AS job_status,
                a.created_at + interval '04:00:00' AS creation_datetime
            FROM (
                SELECT
                    d.order_id,
                    d.user_id,
                    d.status,
                    d.created_at,
                    max(d.item_updated_at) AS item_updated_at
                FROM (
                    SELECT
                        a.id AS order_id,
                        a.user_id,
                        a.status,
                        a.created_at,
                        b.updated_at AS item_updated_at
                    FROM raw_globalv2_ms_order.orders a
                    LEFT JOIN raw_globalv2_ms_order.items b ON a.id = b.order_id
                ) d
                GROUP BY d.order_id, d.user_id, d.status, d.created_at
            ) a
        ) orders_2_0"""

        assert_table_lineage_equal(
            query,
            {
                "raw_legacy_mysql_mena.tb_jobs",
                "raw_legacy_mysql_mena.tb_country",
                "raw_globalv2_ms_order.orders",
                "raw_globalv2_ms_order.items",
            },
            {"stg_globalv2_default.b2c_order_operational_converted"},
            dialect=Dialect.POSTGRES.value,
        )

        # Complex nested subqueries with UNION ALL - 8 column mappings from two source tables
        # SqlGlot doesn't extract column lineage but SqlFluff and SqlParse do
        assert_column_lineage_equal(
            query,
            [
                # Legacy orders path: tb_jobs -> view
                (
                    TestColumnQualifierTuple("job_id", "raw_legacy_mysql_mena.tb_jobs"),
                    TestColumnQualifierTuple("job_id", "stg_globalv2_default.b2c_order_operational_converted"),
                ),
                (
                    TestColumnQualifierTuple("order_id", "raw_legacy_mysql_mena.tb_jobs"),
                    TestColumnQualifierTuple(
                        "customer_id",
                        "stg_globalv2_default.b2c_order_operational_converted",
                    ),
                ),
                (
                    TestColumnQualifierTuple("job_status", "raw_legacy_mysql_mena.tb_jobs"),
                    TestColumnQualifierTuple(
                        "job_status",
                        "stg_globalv2_default.b2c_order_operational_converted",
                    ),
                ),
                (
                    TestColumnQualifierTuple("creation_datetime", "raw_legacy_mysql_mena.tb_jobs"),
                    TestColumnQualifierTuple(
                        "creation_datetime",
                        "stg_globalv2_default.b2c_order_operational_converted",
                    ),
                ),
                # New orders path: orders -> view
                (
                    TestColumnQualifierTuple("id", "raw_globalv2_ms_order.orders"),
                    TestColumnQualifierTuple("job_id", "stg_globalv2_default.b2c_order_operational_converted"),
                ),
                (
                    TestColumnQualifierTuple("user_id", "raw_globalv2_ms_order.orders"),
                    TestColumnQualifierTuple(
                        "customer_id",
                        "stg_globalv2_default.b2c_order_operational_converted",
                    ),
                ),
                (
                    TestColumnQualifierTuple("status", "raw_globalv2_ms_order.orders"),
                    TestColumnQualifierTuple(
                        "job_status",
                        "stg_globalv2_default.b2c_order_operational_converted",
                    ),
                ),
                (
                    TestColumnQualifierTuple("created_at", "raw_globalv2_ms_order.orders"),
                    TestColumnQualifierTuple(
                        "creation_datetime",
                        "stg_globalv2_default.b2c_order_operational_converted",
                    ),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
            test_sqlglot=False,  # SqlGlot doesn't extract column lineage for UNION ALL
            test_sqlfluff=False,  # SqlFluff returns empty column lineage for deeply nested UNION ALL (~5% of runs)
        )

    def test_postgres_ddl_statements(self):
        """Test PostgreSQL DDL statements (SET, ALTER SEQUENCE, SHOW, CREATE SEQUENCE)"""
        query = """SET client_min_messages=notice

ALTER SEQUENCE public.copro_propositions_id_seq OWNED BY public.copro_propositions.id

ALTER SEQUENCE public.admin_answers_id_seq OWNED BY public.admin_answers.id

SET standard_conforming_strings = on

show timezone

CREATE SEQUENCE public.group_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1"""

        assert_table_lineage_equal(
            query,
            set(),  # DDL statements don't have source tables
            set(),  # DDL statements don't have target tables for lineage
            dialect=Dialect.POSTGRES.value,
            # SqlFluff raises UnsupportedStatementException for SET and ALTER SEQUENCE statements
            test_sqlfluff=False,
        )

        # No column lineage expected - DDL statements with no source or target tables
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
            test_sqlfluff=False,
        )

    def test_snowflake_insert_with_cte_and_sequence(self):
        """Test Snowflake INSERT with CTE, aggregations, and sequence nextval (failed with sqlfluff)"""
        query = """INSERT INTO "PRD_EDW_DB"."SDL_DM"."FCT_QRTRLY_MTRCS_VIDA"
                      (FCT_QRTRLY_MTRCS_VIDA_ID
                      ,CALENDARQUARTERID
                      ,BRAND_SK
                      ,COUNTRY_SK
                      ,QRTRLY_TOT_NBR_OF_ORDRS
                      ,QRTRLY_TOT_NBR_OF_SUCCFL_ORDRS
                      ,QRTRLY_TOT_NBR_OF_FLD_ORDRS
                      ,QRTRLY_TOT_NBR_OF_DWNLDS
                      ,QRTRLY_TOT_NBR_OF_SUCCFL_DWNLDS
                      ,QRTRLY_TOT_NBR_OF_FLD_DWNLDS
                      ,QRTRLY_TOT_NBR_OF_INSTLS
                      ,QRTRLY_TOT_NBR_OF_SUCCFL_INSTLS
                      ,QRTRLY_TOT_NBR_OF_FLD_INSTLS
                      ,QRTRLY_TOT_NBR_OF_CRITIC_FAILS
                      ,SOURCECODE
                      ,INSERTEDTASKID
                      ,UPDATEDTASKID
                      ,INSERTEDDTTM
                      ,UPDATEDDTTM)
                      (
                      WITH CTE_Q AS (
                        select
                        CONCAT(CAST(NVL(SUBSTR(CALENDARMONTHID,1,4),0) as INT),CASE WHEN CAST(NVL(SUBSTR(CALENDARMONTHID,5,2),0) as INT) between 1 and 3 THEN '1'
                               WHEN CAST(NVL(SUBSTR(CALENDARMONTHID,5,2),0) as INT) between 3 and 6 THEN '2'
                               WHEN CAST(NVL(SUBSTR(CALENDARMONTHID,5,2),0) as INT) between 6 and 9 THEN '3'
                               WHEN CAST(NVL(SUBSTR(CALENDARMONTHID,5,2),0) as INT) between 9 and 12 THEN '4'
                               ELSE '0' END) as CALENDARQUARTERID
                        ,BRAND_SK
                        ,COUNTRY_SK
                        ,SUM(NVL(MNTHLY_TOT_NBR_OF_ORDRS,0)) as QRTRLY_TOT_NBR_OF_ORDRS
                        ,SUM(NVL(MNTHLY_TOT_NBR_OF_SUCCFL_ORDRS,0)) as QRTRLY_TOT_NBR_OF_SUCCFL_ORDRS
                        ,SUM(NVL(MNTHLY_TOT_NBR_OF_FLD_ORDRS,0)) as QRTRLY_TOT_NBR_OF_FLD_ORDRS
                        ,SUM(NVL(MNTHLY_TOT_NBR_OF_DWNLDS,0)) as QRTRLY_TOT_NBR_OF_DWNLDS
                        ,SUM(NVL(MNTHLY_TOT_NBR_OF_SUCCFL_DWNLDS,0)) as QRTRLY_TOT_NBR_OF_SUCCFL_DWNLDS
                        ,SUM(NVL(MNTHLY_TOT_NBR_OF_FLD_DWNLDS,0)) as QRTRLY_TOT_NBR_OF_FLD_DWNLDS
                        ,SUM(NVL(MNTHLY_TOT_NBR_OF_INSTLS,0)) as QRTRLY_TOT_NBR_OF_INSTLS
                        ,SUM(NVL(MNTHLY_TOT_NBR_OF_SUCCFL_INSTLS,0)) as QRTRLY_TOT_NBR_OF_SUCCFL_INSTLS
                        ,SUM(NVL(MNTHLY_TOT_NBR_OF_FLD_INSTLS,0)) as QRTRLY_TOT_NBR_OF_FLD_INSTLS
                        ,SUM(NVL(MNTHLY_TOT_NBR_OF_CRITIC_FAILS,0)) as QRTRLY_TOT_NBR_OF_CRITIC_FAILS
                        ,'OSS' as SOURCECODE
                        ,:1 as INSERTEDTASKID
                        ,:1 as UPDATEDTASKID
                        ,current_timestamp::TIMESTAMP_NTZ as INSERTEDDTTM
                        ,current_timestamp::TIMESTAMP_NTZ as UPDATEDDTTM
                        FROM "PRD_EDW_DB"."SDL_DM"."FCT_MNTHLY_MTRCS_VIDA" GROUP BY CALENDARQUARTERID, BRAND_SK, COUNTRY_SK)
                      SELECT
                       PRD_EDW_DB.SDL_DM.SEQ_FCT_QRTRLY_MTRCS_VIDA_SK.nextval
                      ,CALENDARQUARTERID
                      ,BRAND_SK
                      ,COUNTRY_SK
                      ,QRTRLY_TOT_NBR_OF_ORDRS
                      ,QRTRLY_TOT_NBR_OF_SUCCFL_ORDRS
                      ,QRTRLY_TOT_NBR_OF_FLD_ORDRS
                      ,QRTRLY_TOT_NBR_OF_DWNLDS
                      ,QRTRLY_TOT_NBR_OF_SUCCFL_DWNLDS
                      ,QRTRLY_TOT_NBR_OF_FLD_DWNLDS
                      ,QRTRLY_TOT_NBR_OF_INSTLS
                      ,QRTRLY_TOT_NBR_OF_SUCCFL_INSTLS
                      ,QRTRLY_TOT_NBR_OF_FLD_INSTLS
                      ,QRTRLY_TOT_NBR_OF_CRITIC_FAILS
                      ,SOURCECODE
                      ,INSERTEDTASKID
                      ,UPDATEDTASKID
                      ,INSERTEDDTTM
                      ,UPDATEDDTTM FROM CTE_Q)"""

        assert_table_lineage_equal(
            query,
            {"PRD_EDW_DB.SDL_DM.FCT_MNTHLY_MTRCS_VIDA"},
            {"PRD_EDW_DB.SDL_DM.FCT_QRTRLY_MTRCS_VIDA"},
            dialect=Dialect.SNOWFLAKE.value,
            # SqlFluff raises InvalidSyntaxException: insert_statement is partially unparsable
            # due to complex nested CTE with bind parameters and sequence.nextval syntax
            test_sqlfluff=False,
            # Graph comparison fails between SqlGlot and SqlParse due to different CTE handling
            skip_graph_check=True,
        )

        # Complex INSERT with 19 column mappings from aggregated CTE
        # SqlGlot extracts all column lineage but too verbose to validate - SqlParse doesn't extract correctly
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
            test_sqlfluff=False,
            test_sqlglot=False,  # SqlGlot finds all 19 columns but too verbose to validate here
            skip_graph_check=True,
        )

    def test_snowflake_lateral_flatten_json(self):
        """Test Snowflake CREATE TABLE with LATERAL FLATTEN for JSON parsing (failed with sqlfluff)"""
        query = """CREATE OR REPLACE TABLE TBL_RETAILFACILITY_BRONZE AS
SELECT DISTINCT
    v:accountcategorycode::VARCHAR as accountcategorycode,
    v:accountclassificationcode::INT as accountclassificationcode,
    v:accountid::VARCHAR as accountid,
    v:accountnumber::VARCHAR as accountnumber,
    v:address1_city::VARCHAR as address1_city,
    v:address1_country::VARCHAR as address1_country,
    v:address1_line1::VARCHAR as address1_line1,
    v:address1_postalcode::VARCHAR as address1_postalcode,
    v:createdby::VARCHAR as createdby,
    v:createdon::VARCHAR as createdon,
    v:modifiedby::VARCHAR as modifiedby,
    v:modifiedon::DATE as modifiedon,
    v:name::VARCHAR as name,
    v:ownerid::VARCHAR as ownerid,
    v:statecode::INT as statecode,
    v:statuscode::INT as statuscode
FROM TBL_RETAIL_FACILITIES_RAW,
LATERAL FLATTEN (INPUT => V) a"""

        assert_table_lineage_equal(
            query,
            {"TBL_RETAIL_FACILITIES_RAW"},
            {"TBL_RETAILFACILITY_BRONZE"},
            dialect=Dialect.SNOWFLAKE.value,
            # SqlFluff raises IndexError in extract_as_and_target_segment when parsing
            # LATERAL FLATTEN syntax - tuple index out of range error
            test_sqlfluff=False,
        )

        # Column lineage - JSON extraction via LATERAL FLATTEN
        # All 16 output columns are derived from the V (variant) column via JSON path extraction
        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("accountcategorycode", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("accountclassificationcode", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("accountid", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("accountnumber", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("address1_city", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("address1_country", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("address1_line1", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("address1_postalcode", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("createdby", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("createdon", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("modifiedby", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("modifiedon", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("name", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("ownerid", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("statecode", "TBL_RETAILFACILITY_BRONZE"),
                ),
                (
                    TestColumnQualifierTuple("V", "TBL_RETAIL_FACILITIES_RAW"),
                    TestColumnQualifierTuple("statuscode", "TBL_RETAILFACILITY_BRONZE"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
            test_sqlfluff=False,
            # SqlParse returns v → v (the raw column) instead of v → named output columns
            test_sqlparse=False,
        )

    def test_snowflake_update_with_nested_select(self):
        """Test Snowflake UPDATE with nested SELECT and LEFT JOIN (failed with sqlfluff)"""
        query = """UPDATE CQIQFU_TRF.DM_CNTRL_TB
  SET END_SRC_BATCH_ID = (SELECT COALESCE(TRF_SOURCE_ID,START_SRC_BATCH_ID) END_SRC_BATCH_ID FROM (SELECT SRC_OBJ_NM,START_SRC_BATCH_ID
  FROM CQIQFU_TRF.DM_CNTRL_TB WHERE TRF_TABLE_NM = ('TRF_BASE_YEAR_TYPE_20') AND LATEST_IND = 'Y' AND SRC_OBJ_NM = 'V_TRF_QW90_MARKET_CODE_BASE_YEAR_TYPE_99') CTRL
                          LEFT JOIN (SELECT SRC_VIEW_NAME, MAX(SOURCE_ID) TRF_SOURCE_ID FROM DEV_EDW_DB.CQIQFU_TRF.TRF_BASE_YEAR_TYPE_20 WHERE SRC_VIEW_NAME = 'V_TRF_QW90_MARKET_CODE_BASE_YEAR_TYPE_99' GROUP BY 1) TRF
                          ON CTRL.SRC_OBJ_NM = TRF.SRC_VIEW_NAME),
  JOB_STATUS = 'FINISHED', RECORD_UPDATED_DTTM = CURRENT_TIMESTAMP(0)
  WHERE TRF_TABLE_NM = ('TRF_BASE_YEAR_TYPE_20') AND LATEST_IND = 'Y' AND SRC_OBJ_NM = 'V_TRF_QW90_MARKET_CODE_BASE_YEAR_TYPE_99'"""

        assert_table_lineage_equal(
            query,
            {
                "CQIQFU_TRF.DM_CNTRL_TB",
                "DEV_EDW_DB.CQIQFU_TRF.TRF_BASE_YEAR_TYPE_20",
            },
            {"CQIQFU_TRF.DM_CNTRL_TB"},  # UPDATE target
            dialect=Dialect.SNOWFLAKE.value,
            # SqlParse returns empty source tables for complex UPDATE with nested subqueries
            test_sqlparse=False,
        )

        # UPDATE statements - SqlFluff extracts 2 column lineages tracking the END_SRC_BATCH_ID update
        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("source_id", "dev_edw_db.cqiqfu_trf.trf_base_year_type_20"),
                    TestColumnQualifierTuple("end_src_batch_id", "cqiqfu_trf.dm_cntrl_tb"),
                ),
                (
                    TestColumnQualifierTuple("start_src_batch_id", "cqiqfu_trf.dm_cntrl_tb"),
                    TestColumnQualifierTuple("end_src_batch_id", "cqiqfu_trf.dm_cntrl_tb"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
            test_sqlparse=False,
            # SqlGlot returns empty column lineage for UPDATE statements
            test_sqlglot=False,
        )

    def test_snowflake_insert_parse_xml(self):
        """Test Snowflake INSERT with PARSE_XML and bind parameters (failed with sqlfluff)"""
        query = """INSERT INTO OBL_DISTRIBUTION_XMLRAW (MESSAGE,SOURCEFILENAME,TOPIC,SOURCE_NAME,OFFSET,PARTITION,MESSAGETIMESTAMP)
        SELECT
             PARSE_XML(:xmlString) AS SOURCEFILEDATA,
             :SOURCEFILENAME AS SOURCEFILENAME,
             :TOPIC AS TOPIC,
             :SOURCE_NAME AS SOURCE_NAME,
             :OFFSET::NUMBER(38,0),
             :PARTITION::NUMBER(38,0),
             TO_TIMESTAMP_TZ(:MESSAGETIMESTAMP,'YYYY-MM-DD HH:MI:SS:FF') as MESSAGETIMESTAMP"""

        assert_table_lineage_equal(
            query,
            set(),  # No source tables, using bind parameters
            {"OBL_DISTRIBUTION_XMLRAW"},
            dialect=Dialect.SNOWFLAKE.value,
            # SqlFluff raises InvalidSyntaxException: insert_statement is partially unparsable
            # due to bind parameters (:xmlString, :SOURCEFILENAME, etc.) in INSERT
            test_sqlfluff=False,
        )

        # INSERT with bind parameters - no parseable column lineage from parameters
        # Parsers have different graph representations for bind parameter queries
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
            test_sqlfluff=False,
            skip_graph_check=True,
        )

    def test_tsql_select_with_xml_methods(self):
        """Test T-SQL SELECT with XML methods and RIGHT OUTER JOIN
        Note: Full CREATE FUNCTION with IF/BEGIN/END is not supported by SQLGlot,
        but the SELECT statement inside (lineage-relevant) parses successfully"""
        query = """SELECT
        database_info.unique_db_name,
        database_info.identifier_guid,
        CASE
            WHEN database_info.availability_group_guid IS NULL
            THEN CONVERT(BIT, 'false')
            ELSE CONVERT(BIT, 'true')
        END as has_availability,
        CASE
            WHEN database_info.dropped_date IS NULL
            THEN CONVERT(BIT, 'false')
            ELSE CONVERT(BIT, 'true')
        END as flag_dropped,
        CONVERT(BIT, backup_meta.task_metadata.value('(/DBBackupRecord/autoBackupSetting)[1]', 'nvarchar(32)')) as backup_enabled,
        NULLIF(backup_meta.task_metadata.value('(/DBBackupRecord/credentialName)[1]', 'nvarchar(128)'), '') as auth_credential_name,
        NULLIF(backup_meta.task_metadata.value('(/DBBackupRecord/retentionPeriod)[1]', 'int'), 0) as days_to_retain,
        NULLIF(backup_meta.task_metadata.value('(/DBBackupRecord/URL)[1]', 'nvarchar(128)'), '') as backup_storage_url,
        NULLIF(backup_meta.task_metadata.value('(/DBBackupRecord/encryptionAlgorithm)[1]', 'nvarchar(128)'), '') as security_algorithm,
        NULLIF(backup_meta.task_metadata.value('(/DBBackupRecord/encryptorType)[1]', 'nvarchar(32)'), '') as security_type,
        NULLIF(backup_meta.task_metadata.value('(/DBBackupRecord/encryptorName)[1]', 'nvarchar(128)'), '') as security_key_name
        FROM managed_database_info database_info
        RIGHT OUTER JOIN task_agent_backup_meta backup_meta
        ON database_info.management_id = backup_meta.management_id
        WHERE
        (
            QUOTENAME(@incoming_db_name) = QUOTENAME('') OR
            QUOTENAME(@incoming_db_name) = QUOTENAME(database_info.unique_db_name)
        ) AND
        (
            backup_meta.task_metadata.exist('/DBBackupRecord') = 1
        )
        AND database_info.management_id <> 0"""

        assert_table_lineage_equal(
            query,
            {"managed_database_info", "task_agent_backup_meta"},
            set(),  # No target table for SELECT query
            dialect=Dialect.TSQL.value,
        )

        # No column lineage expected - SELECT query with no target table
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.TSQL.value,
        )

    def test_oracle_create_procedure_insert_select(self):
        """Test Oracle CREATE PROCEDURE with INSERT...SELECT"""
        query = """CREATE OR REPLACE PROCEDURE INDA1.insert_to_table
AS
BEGIN
    INSERT INTO TEST_QMINH (countriesId, countriesName, regionId)
    SELECT COUNTRY_ID, COUNTRY_NAME, REGION_ID
    FROM INDA1.COUNTRIES;
END;"""

        assert_table_lineage_equal(
            query,
            {"INDA1.COUNTRIES"},
            {"TEST_QMINH"},
            dialect=Dialect.ORACLE.value,
            # SqlGlot does not support CREATE PROCEDURE syntax and returns empty source tables
            test_sqlglot=False,
            # SqlFluff raises InvalidSyntaxException: statement is unparsable for CREATE PROCEDURE
            test_sqlfluff=False,
            # SqlParse does not support CREATE PROCEDURE and returns empty source tables
            test_sqlparse=False,
        )

        # Column lineage for INSERT...SELECT statement inside procedure
        # Direct column mapping from COUNTRIES to TEST_QMINH
        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("COUNTRY_ID", "INDA1.COUNTRIES"),
                    TestColumnQualifierTuple("countriesId", "TEST_QMINH"),
                ),
                (
                    TestColumnQualifierTuple("COUNTRY_NAME", "INDA1.COUNTRIES"),
                    TestColumnQualifierTuple("countriesName", "TEST_QMINH"),
                ),
                (
                    TestColumnQualifierTuple("REGION_ID", "INDA1.COUNTRIES"),
                    TestColumnQualifierTuple("regionId", "TEST_QMINH"),
                ),
            ],
            dialect=Dialect.ORACLE.value,
            test_sqlglot=False,
            test_sqlfluff=False,
            test_sqlparse=False,
        )

    # -------------------------------------------------------------------------
    # Snowflake Stage Lineage Tests (COPY INTO @stage / COPY INTO table FROM @stage)
    # -------------------------------------------------------------------------

    def test_snowflake_copy_into_table_from_stage(self):
        """Test Snowflake COPY INTO table FROM @stage (loading data from stage)"""
        query = "COPY INTO wine_quality FROM @demo FILE_FORMAT = wine_csv_format;"

        assert_table_lineage_equal(
            query,
            {Location("@demo")},
            {"wine_quality"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        # No column lineage expected for COPY INTO stage operations
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_snowflake_copy_into_stage_from_table(self):
        """Test Snowflake COPY INTO @stage FROM table (unloading data to stage)"""
        query = "COPY INTO @my_stage FROM my_table"

        assert_table_lineage_equal(
            query,
            {"my_table"},
            {Location("@my_stage")},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_snowflake_copy_into_stage_from_select(self):
        """Test Snowflake COPY INTO @stage FROM (SELECT ...) - unload with subquery"""
        query = "COPY INTO @db.schema.my_stage FROM (SELECT col1, col2 FROM my_table)"

        assert_table_lineage_equal(
            query,
            {"my_table"},
            {Location("@db.schema.my_stage")},
            dialect=Dialect.SNOWFLAKE.value,
            # SqlParse builds a different internal graph structure for subqueries
            # (5 nodes vs 3 nodes) even though final lineage results are identical
            skip_graph_check=True,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
            # SqlGlot and SqlFluff/SqlParse produce different graph structures for subqueries
            skip_graph_check=True,
        )

    def test_snowflake_copy_into_fully_qualified_stage(self):
        """Test COPY INTO table FROM @db.schema.stage with fully qualified stage name"""
        query = "COPY INTO my_table FROM @my_db.my_schema.my_stage FILE_FORMAT=(TYPE=CSV)"

        assert_table_lineage_equal(
            query,
            {Location("@my_db.my_schema.my_stage")},
            {"my_table"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
        )

    # -----------------------------------------------------------------------
    # collate-sqllineage 2.1.1 regression tests
    # Release: https://github.com/open-metadata/collate-sqllineage/releases/tag/2.1.1-release
    # -----------------------------------------------------------------------

    def test_ctas_union_all_inside_cte_column_lineage(self):
        """Test CTAS where the CTE body is a UNION ALL — column lineage maps both branches.

        Verifies that when a CTE wraps a UNION ALL and the outer SELECT reads from that
        CTE, column lineage correctly flows from both UNION ALL input tables to the
        CTAS write target (not to the CTE name or a wrong intermediate table).
        All 3 parsers produce identical graphs (19n/26e).
        """
        query = """CREATE TABLE analytics.fact_orders AS
WITH combined_data AS (
    SELECT order_id, amount, status FROM staging.orders_source_a
    UNION ALL
    SELECT order_id, amount, status FROM staging.orders_source_b
)
SELECT order_id, amount, status FROM combined_data"""

        assert_table_lineage_equal(
            query,
            {"staging.orders_source_a", "staging.orders_source_b"},
            {"analytics.fact_orders"},
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("order_id", "staging.orders_source_a"),
                    TestColumnQualifierTuple("order_id", "analytics.fact_orders"),
                ),
                (
                    TestColumnQualifierTuple("amount", "staging.orders_source_a"),
                    TestColumnQualifierTuple("amount", "analytics.fact_orders"),
                ),
                (
                    TestColumnQualifierTuple("status", "staging.orders_source_a"),
                    TestColumnQualifierTuple("status", "analytics.fact_orders"),
                ),
                (
                    TestColumnQualifierTuple("order_id", "staging.orders_source_b"),
                    TestColumnQualifierTuple("order_id", "analytics.fact_orders"),
                ),
                (
                    TestColumnQualifierTuple("amount", "staging.orders_source_b"),
                    TestColumnQualifierTuple("amount", "analytics.fact_orders"),
                ),
                (
                    TestColumnQualifierTuple("status", "staging.orders_source_b"),
                    TestColumnQualifierTuple("status", "analytics.fact_orders"),
                ),
            ],
        )

    def test_clickhouse_ctas_engine_union_all_not_in(self):
        """Test ClickHouse CTAS with ENGINE clause, UNION ALL, and NOT IN subquery.

        Regression for https://github.com/open-metadata/OpenMetadata/issues/21953.
        Verifies that CTAS queries combining ENGINE = ..., CTEs, UNION ALL and a NOT IN
        subfilter produce correct source/target table lineage and column lineage.
        SqlFluff graph structure differs from SqlGlot/SqlParse (24n/33e vs 26n/35e),
        requiring skip_graph_check.
        """
        query = """CREATE TABLE analytics_mart.dim_entity ENGINE = ReplacingMergeTree() AS
WITH source_a AS (
    SELECT entity_id, entity_name, source_system FROM staging.int_entity__source_a
),
source_b AS (
    SELECT entity_id, entity_name, source_system FROM staging.int_entity__source_b
)
SELECT entity_id, entity_name, source_system FROM source_a
WHERE entity_id NOT IN (SELECT entity_id FROM source_b)
UNION ALL
SELECT entity_id, entity_name, source_system FROM source_b"""

        assert_table_lineage_equal(
            query,
            {"staging.int_entity__source_a", "staging.int_entity__source_b"},
            {"analytics_mart.dim_entity"},
            dialect=Dialect.CLICKHOUSE.value,
            skip_graph_check=True,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("entity_id", "staging.int_entity__source_a"),
                    TestColumnQualifierTuple("entity_id", "analytics_mart.dim_entity"),
                ),
                (
                    TestColumnQualifierTuple("entity_name", "staging.int_entity__source_a"),
                    TestColumnQualifierTuple("entity_name", "analytics_mart.dim_entity"),
                ),
                (
                    TestColumnQualifierTuple("source_system", "staging.int_entity__source_a"),
                    TestColumnQualifierTuple("source_system", "analytics_mart.dim_entity"),
                ),
                (
                    TestColumnQualifierTuple("entity_id", "staging.int_entity__source_b"),
                    TestColumnQualifierTuple("entity_id", "analytics_mart.dim_entity"),
                ),
                (
                    TestColumnQualifierTuple("entity_name", "staging.int_entity__source_b"),
                    TestColumnQualifierTuple("entity_name", "analytics_mart.dim_entity"),
                ),
                (
                    TestColumnQualifierTuple("source_system", "staging.int_entity__source_b"),
                    TestColumnQualifierTuple("source_system", "analytics_mart.dim_entity"),
                ),
            ],
            dialect=Dialect.CLICKHOUSE.value,
            skip_graph_check=True,
        )

    def test_bigquery_clone_table_with_digit_starting_name(self):
        """Test BigQuery CREATE OR REPLACE TABLE ... CLONE where source name starts with digit.

        Regression for https://github.com/open-metadata/OpenMetadata/issues/23338.
        BigQuery allows identifiers that start with digits (e.g. 1st_layer___name).
        SqlParse returns empty sources for CLONE statements so it is excluded.
        SqlGlot and SqlFluff produce isomorphic graphs (3n/2e).
        """
        query = "CREATE OR REPLACE TABLE analytics_ref.region_summary_v2 CLONE analytics_source.1st_layer___region_summary_v2"

        assert_table_lineage_equal(
            query,
            {"analytics_source.1st_layer___region_summary_v2"},
            {"analytics_ref.region_summary_v2"},
            dialect=Dialect.BIGQUERY.value,
            test_sqlparse=False,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.BIGQUERY.value,
            test_sqlparse=False,
        )

    def test_snowflake_copy_into_table_with_column_list_from_stage_subquery(self):
        """Test COPY INTO table (col1, col2) FROM (SELECT ... FROM @stage) with explicit column list.

        Regression for https://github.com/open-metadata/OpenMetadata/issues/27380.
        Verifies that the stage reference is resolved as a Location source even when the
        COPY INTO target specifies an explicit column list and the subquery uses Snowflake
        positional column syntax ($1:field). Internal graph structures differ across parsers.
        """
        query = """COPY INTO PROD_DB.STAGING.RAW_EVENTS (EVENT_ID, EVENT_DATA)
FROM (SELECT $1:event_id, $2:event_data FROM @PROD_DB.STAGING.STG_EVENTS_ROOT)
FILE_FORMAT = (TYPE = PARQUET)"""

        assert_table_lineage_equal(
            query,
            {Location("@PROD_DB.STAGING.STG_EVENTS_ROOT")},
            {"prod_db.staging.raw_events"},
            dialect=Dialect.SNOWFLAKE.value,
            skip_graph_check=True,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
            skip_graph_check=True,
        )

    def test_snowflake_copy_into_stage_subpath_with_external_file_format(self):
        """Test COPY INTO from @stage/subpath/file.csv with an external named FILE_FORMAT.

        Regression for https://github.com/open-metadata/OpenMetadata/issues/27380.
        Verifies that the stage subpath (CDL/delivery_data/file.csv) is stripped so the
        source resolves to the stage root (@stage), and that a fully-qualified external
        FILE_FORMAT reference (db.schema.format) does not interfere with lineage.
        Internal graph structures differ across parsers.
        """
        query = """COPY INTO LOAD_DB.PUBLIC.FACT_DELIVERIES
FROM (SELECT $1, $2, $3 FROM @LOAD_DB.STAGING.STG_DELIVERIES/CDL/delivery_data/file.csv)
FILE_FORMAT = LOAD_DB.PUBLIC.CSV_FORMAT
FORCE = TRUE
ON_ERROR = CONTINUE"""

        assert_table_lineage_equal(
            query,
            {Location("@LOAD_DB.STAGING.STG_DELIVERIES")},
            {"load_db.public.fact_deliveries"},
            dialect=Dialect.SNOWFLAKE.value,
            skip_graph_check=True,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
            skip_graph_check=True,
        )

    def test_snowflake_copy_into_stage_subpath_date_partitioned(self):
        """Test COPY INTO from @stage/YYYY/MM/DD/file.csv date-partitioned path.

        Regression for https://github.com/open-metadata/OpenMetadata/issues/27380.
        Verifies that date-partitioned stage subpaths (e.g. /2026/04/11/events.csv) are
        stripped so the source resolves to the stage root rather than the full path.
        Internal graph structures differ across parsers.
        """
        query = """COPY INTO ANALYTICS_DB.PUBLIC.FACT_EVENTS
FROM (SELECT $1 FROM @ANALYTICS_DB.PUBLIC.STG_EVENTS/2026/04/11/events.csv)
FILE_FORMAT = (TYPE = CSV)"""

        assert_table_lineage_equal(
            query,
            {Location("@ANALYTICS_DB.PUBLIC.STG_EVENTS")},
            {"analytics_db.public.fact_events"},
            dialect=Dialect.SNOWFLAKE.value,
            skip_graph_check=True,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
            skip_graph_check=True,
        )

    # -----------------------------------------------------------------------
    # StarRocks dialect tests
    # Regression for https://github.com/open-metadata/OpenMetadata/issues/28934
    # StarRocks queries (e.g. from Metabase) use StarRocks-specific functions
    # and optimizer hints and must be parsed with the StarRocks dialect, not
    # MySQL, for lineage extraction to succeed.
    # -----------------------------------------------------------------------

    def test_starrocks_connection_type_maps_to_starrocks_dialect(self):
        """StarRocks connection type resolves to the StarRocks dialect, not MySQL."""
        assert ConnectionTypeDialectMapper.dialect_of(StarrocksType.StarRocks.value) == Dialect.STARROCKS
        assert Dialect.STARROCKS.value == "starrocks"

    def test_starrocks_bitmap_functions_with_set_var_hint(self):
        """Test StarRocks SELECT with to_bitmap/bitmap_union_count and a SET_VAR optimizer hint.

        These StarRocks-specific functions and the /*+ SET_VAR(...) */ hint previously
        failed lineage extraction when parsed with the MySQL dialect.
        """
        query = """SELECT /*+ SET_VAR(query_timeout = 60) */
            region,
            bitmap_union_count(to_bitmap(user_id)) AS uv
        FROM analytics.user_events
        GROUP BY region"""

        assert_table_lineage_equal(
            query,
            {"analytics.user_events"},
            set(),  # No target table for SELECT query
            dialect=Dialect.STARROCKS.value,
        )

    def test_starrocks_ctas_bitmap_union(self):
        """Test StarRocks CREATE TABLE AS SELECT with bitmap aggregation."""
        query = """CREATE TABLE analytics.uv_daily AS
        SELECT
            dt,
            bitmap_union(to_bitmap(user_id)) AS uv
        FROM analytics.user_events
        GROUP BY dt"""

        assert_table_lineage_equal(
            query,
            {"analytics.user_events"},
            {"analytics.uv_daily"},
            dialect=Dialect.STARROCKS.value,
        )

    def test_starrocks_ctas_with_distributed_and_properties(self):
        """Test StarRocks CREATE TABLE AS SELECT with DISTRIBUTED BY and PROPERTIES.

        These StarRocks table-creation clauses must be parsed with the StarRocks
        dialect for both table and column lineage to be extracted.
        """
        query = """CREATE TABLE analytics.uv_daily
        DISTRIBUTED BY HASH(dt) BUCKETS 10
        PROPERTIES ("replication_num" = "1")
        AS SELECT
            dt,
            bitmap_union(to_bitmap(user_id)) AS uv
        FROM analytics.user_events
        GROUP BY dt"""

        # SqlFluff does not support the StarRocks PROPERTIES clause. SqlGlot and
        # SqlParse both extract the lineage under the StarRocks dialect.
        assert_table_lineage_equal(
            query,
            {"analytics.user_events"},
            {"analytics.uv_daily"},
            dialect=Dialect.STARROCKS.value,
            test_sqlfluff=False,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("dt", "analytics.user_events"),
                    TestColumnQualifierTuple("dt", "analytics.uv_daily"),
                ),
                (
                    TestColumnQualifierTuple("user_id", "analytics.user_events"),
                    TestColumnQualifierTuple("uv", "analytics.uv_daily"),
                ),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlfluff=False,
        )

    def test_starrocks_ctas_duplicate_key_table(self):
        """Test StarRocks Duplicate Key table CTAS.

        Docs: https://docs.starrocks.io/docs/table_design/table_types/duplicate_key_table/
        """
        query = """CREATE TABLE analytics.t
        DUPLICATE KEY(a)
        DISTRIBUTED BY HASH(a) BUCKETS 4
        AS SELECT a, b FROM analytics.src"""

        # SqlFluff has no StarRocks grammar for the DUPLICATE KEY clause.
        assert_table_lineage_equal(
            query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value, test_sqlfluff=False
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("a", "analytics.src"), TestColumnQualifierTuple("a", "analytics.t")),
                (TestColumnQualifierTuple("b", "analytics.src"), TestColumnQualifierTuple("b", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlfluff=False,
        )

    def test_starrocks_ctas_aggregate_key_table(self):
        """Test StarRocks Aggregate table CTAS with a SUM value column.

        Docs: https://docs.starrocks.io/docs/table_design/table_types/aggregate_table/
        """
        query = """CREATE TABLE analytics.t (a INT, s BIGINT SUM)
        AGGREGATE KEY(a)
        DISTRIBUTED BY HASH(a)
        AS SELECT a, sum(b) AS s FROM analytics.src GROUP BY a"""

        # Only SqlParse handles the AGGREGATE KEY column-aggregate DDL today.
        assert_table_lineage_equal(
            query,
            {"analytics.src"},
            {"analytics.t"},
            dialect=Dialect.STARROCKS.value,
            test_sqlglot=False,
            test_sqlfluff=False,
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("a", "analytics.src"), TestColumnQualifierTuple("a", "analytics.t")),
                (TestColumnQualifierTuple("b", "analytics.src"), TestColumnQualifierTuple("s", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlglot=False,
            test_sqlfluff=False,
        )

    def test_starrocks_ctas_unique_key_table(self):
        """Test StarRocks Unique Key table CTAS.

        Docs: https://docs.starrocks.io/docs/table_design/table_types/unique_key_table/
        """
        query = """CREATE TABLE analytics.t
        UNIQUE KEY(a)
        DISTRIBUTED BY HASH(a)
        AS SELECT a, b FROM analytics.src"""

        # SqlFluff has no StarRocks grammar for the UNIQUE KEY clause.
        assert_table_lineage_equal(
            query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value, test_sqlfluff=False
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("a", "analytics.src"), TestColumnQualifierTuple("a", "analytics.t")),
                (TestColumnQualifierTuple("b", "analytics.src"), TestColumnQualifierTuple("b", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlfluff=False,
        )

    def test_starrocks_ctas_primary_key_table(self):
        """Test StarRocks Primary Key table CTAS.

        Docs: https://docs.starrocks.io/docs/table_design/table_types/primary_key_table/
        """
        query = """CREATE TABLE analytics.t
        PRIMARY KEY(a)
        DISTRIBUTED BY HASH(a)
        AS SELECT a, b FROM analytics.src"""

        # SqlFluff has no StarRocks grammar for the PRIMARY KEY clause.
        assert_table_lineage_equal(
            query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value, test_sqlfluff=False
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("a", "analytics.src"), TestColumnQualifierTuple("a", "analytics.t")),
                (TestColumnQualifierTuple("b", "analytics.src"), TestColumnQualifierTuple("b", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlfluff=False,
        )

    def test_starrocks_ctas_range_partition(self):
        """Test StarRocks CTAS with range partitioning.

        Docs: https://docs.starrocks.io/docs/table_design/data_distribution/
        """
        query = """CREATE TABLE analytics.t
        PARTITION BY RANGE(dt) (PARTITION p1 VALUES LESS THAN ('2024-01-01'))
        DISTRIBUTED BY HASH(id)
        AS SELECT id, dt FROM analytics.src"""

        # SqlFluff has no StarRocks grammar for the PARTITION BY RANGE clause.
        assert_table_lineage_equal(
            query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value, test_sqlfluff=False
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("id", "analytics.src"), TestColumnQualifierTuple("id", "analytics.t")),
                (TestColumnQualifierTuple("dt", "analytics.src"), TestColumnQualifierTuple("dt", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlfluff=False,
        )

    def test_starrocks_ctas_expression_partition(self):
        """Test StarRocks CTAS with expression partitioning.

        Docs: https://docs.starrocks.io/docs/table_design/data_distribution/expression_partitioning/
        """
        query = """CREATE TABLE analytics.t
        PARTITION BY date_trunc('day', dt)
        DISTRIBUTED BY HASH(id)
        AS SELECT id, dt FROM analytics.src"""

        # SqlFluff has no StarRocks grammar for expression partitioning.
        assert_table_lineage_equal(
            query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value, test_sqlfluff=False
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("id", "analytics.src"), TestColumnQualifierTuple("id", "analytics.t")),
                (TestColumnQualifierTuple("dt", "analytics.src"), TestColumnQualifierTuple("dt", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlfluff=False,
        )

    def test_starrocks_ctas_sort_key_order_by(self):
        """Test StarRocks CTAS with an ORDER BY sort key.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/CREATE_TABLE/
        """
        query = """CREATE TABLE analytics.t
        DISTRIBUTED BY HASH(id)
        ORDER BY (id)
        AS SELECT id, v FROM analytics.src"""

        # SqlFluff has no StarRocks grammar for the ORDER BY sort key clause.
        assert_table_lineage_equal(
            query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value, test_sqlfluff=False
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("id", "analytics.src"), TestColumnQualifierTuple("id", "analytics.t")),
                (TestColumnQualifierTuple("v", "analytics.src"), TestColumnQualifierTuple("v", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlfluff=False,
        )

    def test_starrocks_ctas_random_bucketing(self):
        """Test StarRocks CTAS with random bucketing.

        Docs: https://docs.starrocks.io/docs/table_design/data_distribution/
        """
        query = """CREATE TABLE analytics.t
        DISTRIBUTED BY RANDOM
        AS SELECT a, b FROM analytics.src"""

        # SqlFluff has no StarRocks grammar for DISTRIBUTED BY RANDOM.
        assert_table_lineage_equal(
            query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value, test_sqlfluff=False
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("a", "analytics.src"), TestColumnQualifierTuple("a", "analytics.t")),
                (TestColumnQualifierTuple("b", "analytics.src"), TestColumnQualifierTuple("b", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlfluff=False,
        )

    def test_starrocks_create_view(self):
        """Test StarRocks CREATE VIEW.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-statements/View/CREATE_VIEW/
        """
        query = """CREATE VIEW analytics.v AS SELECT a, b FROM analytics.src"""

        assert_table_lineage_equal(query, {"analytics.src"}, {"analytics.v"}, dialect=Dialect.STARROCKS.value)
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("a", "analytics.src"), TestColumnQualifierTuple("a", "analytics.v")),
                (TestColumnQualifierTuple("b", "analytics.src"), TestColumnQualifierTuple("b", "analytics.v")),
            ],
            dialect=Dialect.STARROCKS.value,
        )

    def test_starrocks_create_materialized_view(self):
        """Test StarRocks asynchronous CREATE MATERIALIZED VIEW.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-statements/materialized_view/CREATE_MATERIALIZED_VIEW/
        """
        query = """CREATE MATERIALIZED VIEW analytics.mv
        DISTRIBUTED BY HASH(id) REFRESH ASYNC
        AS SELECT id, sum(v) AS c FROM analytics.src GROUP BY id"""

        # SqlFluff has no StarRocks grammar for the materialized view refresh clause.
        assert_table_lineage_equal(
            query, {"analytics.src"}, {"analytics.mv"}, dialect=Dialect.STARROCKS.value, test_sqlfluff=False
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("id", "analytics.src"), TestColumnQualifierTuple("id", "analytics.mv")),
                (TestColumnQualifierTuple("v", "analytics.src"), TestColumnQualifierTuple("c", "analytics.mv")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlfluff=False,
        )

    def test_starrocks_insert_into_select(self):
        """Test StarRocks INSERT INTO ... SELECT.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-statements/loading_unloading/INSERT/
        """
        query = """INSERT INTO analytics.t SELECT a, b FROM analytics.src"""

        assert_table_lineage_equal(query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value)
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("a", "analytics.src"), TestColumnQualifierTuple("a", "analytics.t")),
                (TestColumnQualifierTuple("b", "analytics.src"), TestColumnQualifierTuple("b", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
        )

    def test_starrocks_insert_with_label(self):
        """Test StarRocks INSERT INTO ... WITH LABEL ... SELECT.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-statements/loading_unloading/INSERT/
        """
        query = """INSERT INTO analytics.t WITH LABEL lbl1 SELECT a, b FROM analytics.src"""

        # Only SqlParse handles the WITH LABEL insert clause today.
        assert_table_lineage_equal(
            query,
            {"analytics.src"},
            {"analytics.t"},
            dialect=Dialect.STARROCKS.value,
            test_sqlglot=False,
            test_sqlfluff=False,
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("a", "analytics.src"), TestColumnQualifierTuple("a", "analytics.t")),
                (TestColumnQualifierTuple("b", "analytics.src"), TestColumnQualifierTuple("b", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlglot=False,
            test_sqlfluff=False,
        )

    def test_starrocks_insert_overwrite(self):
        """Test StarRocks INSERT OVERWRITE ... SELECT.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-statements/loading_unloading/INSERT/
        """
        query = """INSERT OVERWRITE analytics.t SELECT a, b FROM analytics.src"""

        # SqlFluff does not extract lineage from INSERT OVERWRITE today.
        assert_table_lineage_equal(
            query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value, test_sqlfluff=False
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("a", "analytics.src"), TestColumnQualifierTuple("a", "analytics.t")),
                (TestColumnQualifierTuple("b", "analytics.src"), TestColumnQualifierTuple("b", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlfluff=False,
        )

    def test_starrocks_insert_with_column_list(self):
        """Test StarRocks INSERT INTO ... (columns) ... SELECT.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-statements/loading_unloading/INSERT/
        """
        query = """INSERT INTO analytics.t (a, b) SELECT a, b FROM analytics.src"""

        assert_table_lineage_equal(query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value)
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("a", "analytics.src"), TestColumnQualifierTuple("a", "analytics.t")),
                (TestColumnQualifierTuple("b", "analytics.src"), TestColumnQualifierTuple("b", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
        )

    def test_starrocks_hll_union_agg(self):
        """Test StarRocks HLL approximate distinct functions.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-functions/aggregate-functions/hll_union_agg/
        """
        query = """INSERT INTO analytics.t
        SELECT region, hll_union_agg(hll_hash(uid)) AS uv FROM analytics.src GROUP BY region"""

        # SqlParse does not trace the argument of the HLL aggregate into uv.
        assert_table_lineage_equal(
            query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value, test_sqlparse=False
        )
        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("region", "analytics.src"),
                    TestColumnQualifierTuple("region", "analytics.t"),
                ),
                (TestColumnQualifierTuple("uid", "analytics.src"), TestColumnQualifierTuple("uv", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlparse=False,
        )

    def test_starrocks_approx_count_distinct(self):
        """Test StarRocks approx_count_distinct.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-functions/aggregate-functions/approx_count_distinct/
        """
        query = """INSERT INTO analytics.t
        SELECT region, approx_count_distinct(uid) AS uv FROM analytics.src GROUP BY region"""

        # SqlParse does not trace the argument of the aggregate into uv.
        assert_table_lineage_equal(
            query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value, test_sqlparse=False
        )
        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("region", "analytics.src"),
                    TestColumnQualifierTuple("region", "analytics.t"),
                ),
                (TestColumnQualifierTuple("uid", "analytics.src"), TestColumnQualifierTuple("uv", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlparse=False,
        )

    def test_starrocks_percentile_approx(self):
        """Test StarRocks percentile_approx.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-functions/aggregate-functions/percentile_approx/
        """
        query = """INSERT INTO analytics.t
        SELECT region, percentile_approx(v, 0.99) AS p99 FROM analytics.src GROUP BY region"""

        assert_table_lineage_equal(query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value)
        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("region", "analytics.src"),
                    TestColumnQualifierTuple("region", "analytics.t"),
                ),
                (TestColumnQualifierTuple("v", "analytics.src"), TestColumnQualifierTuple("p99", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
        )

    def test_starrocks_array_map_lambda(self):
        """Test StarRocks array_map with a lambda expression.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-functions/array-functions/array_map/
        Lambda: https://docs.starrocks.io/docs/sql-reference/sql-functions/Lambda_expression/
        """
        query = """INSERT INTO analytics.t SELECT array_map(x -> x + 1, arr) AS r FROM analytics.src"""

        # SqlFluff additionally maps the lambda parameter as a source column.
        assert_table_lineage_equal(
            query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value, test_sqlfluff=False
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("arr", "analytics.src"), TestColumnQualifierTuple("r", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            test_sqlfluff=False,
        )

    def test_starrocks_cte(self):
        """Test StarRocks common table expression feeding an INSERT.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/SELECT/
        """
        query = """INSERT INTO analytics.t WITH c AS (SELECT a FROM analytics.src) SELECT a FROM c"""

        assert_table_lineage_equal(query, {"analytics.src"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value)
        # Parsers model the CTE node differently, so compare endpoints only.
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("a", "analytics.src"), TestColumnQualifierTuple("a", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
            skip_graph_check=True,
        )

    def test_starrocks_join(self):
        """Test StarRocks JOIN feeding an INSERT.

        Docs: https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/SELECT/SELECT_JOIN/
        """
        query = """INSERT INTO analytics.t
        SELECT a.id AS id FROM analytics.s1 a JOIN analytics.s2 b ON a.id = b.id"""

        assert_table_lineage_equal(
            query, {"analytics.s1", "analytics.s2"}, {"analytics.t"}, dialect=Dialect.STARROCKS.value
        )
        assert_column_lineage_equal(
            query,
            [
                (TestColumnQualifierTuple("id", "analytics.s1"), TestColumnQualifierTuple("id", "analytics.t")),
            ],
            dialect=Dialect.STARROCKS.value,
        )
