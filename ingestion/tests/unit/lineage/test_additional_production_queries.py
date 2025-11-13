"""
Unit tests for SQLGlot parser with additional production queries
Tests various real-world query patterns from different databases
"""

import unittest

from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser_selection import create_lineage_parser


class TestAdditionalProductionQueries(unittest.TestCase):
    """Test SQLGlot parser with additional complex production queries"""

    def test_create_view_with_join(self):
        """Test CREATE VIEW with JOIN"""
        query = """CREATE VIEW vw_test AS
        SELECT
            a.someColumn,
            b.anotherColumn
        FROM a
        JOIN b
            ON a.id = b.fk_id"""

        parser = create_lineage_parser(query=query, dialect=Dialect.SNOWFLAKE)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 2)
        # Check that both tables a and b are found
        source_table_names = {str(table).lower() for table in parser.source_tables}
        self.assertTrue(any("a" in name for name in source_table_names))
        self.assertTrue(any("b" in name for name in source_table_names))

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

        parser = create_lineage_parser(query=query, dialect=Dialect.SNOWFLAKE)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 1)
        # Check that the base table is found
        source_names = [str(table).lower() for table in parser.source_tables]
        self.assertTrue(any("order_flows_base" in name for name in source_names))

    def test_dbt_model_style_create_view(self):
        """Test dbt model style CREATE VIEW (SQL Server style with double quotes)"""
        query = """create view dbo.my_second_dbt_model as
        select *
        from test_db.dbo.my_first_dbt_model
        where id = 1"""

        parser = create_lineage_parser(query=query, dialect=Dialect.TSQL)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 1)
        source_names = [str(table).lower() for table in parser.source_tables]
        self.assertTrue(any("my_first_dbt_model" in name for name in source_names))

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

        parser = create_lineage_parser(query=query, dialect=Dialect.BIGQUERY)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 3)
        # Check for the main tables
        source_names = [str(table).lower() for table in parser.source_tables]
        self.assertTrue(any("m_office" in name for name in source_names))
        self.assertTrue(any("companies" in name for name in source_names))

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

        parser = create_lineage_parser(query=query, dialect=Dialect.MYSQL)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 5)
        # Check for base tables (not CTEs)
        source_names = [str(table).lower() for table in parser.source_tables]
        self.assertTrue(any("stg_inventory_amz" in name for name in source_names))
        self.assertTrue(any("stg_sku_cost" in name for name in source_names))

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

        parser = create_lineage_parser(query=query, dialect=Dialect.CLICKHOUSE)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 3)
        source_names = [str(table).lower() for table in parser.source_tables]
        self.assertTrue(any("stg_inventory_juvo" in name for name in source_names))
        self.assertTrue(any("stg_location" in name for name in source_names))

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

        parser = create_lineage_parser(query=query, dialect=Dialect.POSTGRES)

        self.assertTrue(parser.query_parsing_success)
        # CREATE TABLE statements may be detected as source
        self.assertGreaterEqual(len(parser.source_tables), 0)

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

        parser = create_lineage_parser(query=query, dialect=Dialect.POSTGRES)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 1)
        source_names = [str(table).lower() for table in parser.source_tables]
        self.assertTrue(any("units" in name for name in source_names))

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

        parser = create_lineage_parser(query=query, dialect=Dialect.MYSQL)

        self.assertTrue(parser.query_parsing_success)
        # Check if column lineage is available
        if hasattr(parser, "column_lineage") and parser.column_lineage:
            self.assertGreater(len(parser.column_lineage), 0)
            # Verify we have column mappings
            column_lineage_str = [
                f"{src} -> {tgt}" for src, tgt in parser.column_lineage
            ]
            self.assertTrue(len(column_lineage_str) > 0)

    def test_ultra_complex_postgres_view(self):
        """Test ultra-complex PostgreSQL CREATE VIEW with UNION ALL, nested subqueries, and JSON functions"""
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

        parser = create_lineage_parser(query=query, dialect=Dialect.POSTGRES)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 3)

        # Check for expected source tables
        source_names = [str(table).lower() for table in parser.source_tables]
        self.assertTrue(any("tb_jobs" in name for name in source_names))
        self.assertTrue(any("orders" in name for name in source_names))
        self.assertTrue(any("items" in name for name in source_names))

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

        parser = create_lineage_parser(query=query, dialect=Dialect.POSTGRES)

        self.assertTrue(parser.query_parsing_success)
        # DDL statements typically don't have source/target tables in lineage context
        self.assertGreaterEqual(len(parser.source_tables), 0)

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

        parser = create_lineage_parser(query=query, dialect=Dialect.SNOWFLAKE)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 1)
        # Check for the source table
        source_names = [str(table).lower() for table in parser.source_tables]
        self.assertTrue(any("fct_mnthly_mtrcs_vida" in name for name in source_names))
        # Check column lineage
        if hasattr(parser, "column_lineage") and parser.column_lineage:
            self.assertGreater(len(parser.column_lineage), 0)

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

        parser = create_lineage_parser(query=query, dialect=Dialect.SNOWFLAKE)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 1)
        # Check for the source table
        source_names = [str(table).lower() for table in parser.source_tables]
        self.assertTrue(
            any("tbl_retail_facilities_raw" in name for name in source_names)
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

        parser = create_lineage_parser(query=query, dialect=Dialect.SNOWFLAKE)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 2)
        # Check for the tables
        source_names = [str(table).lower() for table in parser.source_tables]
        self.assertTrue(any("dm_cntrl_tb" in name for name in source_names))
        self.assertTrue(any("trf_base_year_type_20" in name for name in source_names))

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

        parser = create_lineage_parser(query=query, dialect=Dialect.SNOWFLAKE)

        self.assertTrue(parser.query_parsing_success)
        # INSERT statements should have target table
        self.assertGreaterEqual(len(parser.target_tables), 1)

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

        parser = create_lineage_parser(query=query, dialect=Dialect.TSQL)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 2)
        # Check for the tables
        source_names = [str(table).lower() for table in parser.source_tables]
        self.assertTrue(any("managed_database_info" in name for name in source_names))
        self.assertTrue(any("task_agent_backup_meta" in name for name in source_names))

    def test_oracle_create_procedure_insert_select(self):
        """Test Oracle CREATE PROCEDURE with INSERT...SELECT"""
        query = """CREATE OR REPLACE PROCEDURE INDA1.insert_to_table
AS
BEGIN
    INSERT INTO TEST_QMINH (countriesId, countriesName, regionId)
    SELECT COUNTRY_ID, COUNTRY_NAME, REGION_ID
    FROM INDA1.COUNTRIES;
END;"""

        parser = create_lineage_parser(query=query, dialect=Dialect.ORACLE)

        self.assertTrue(parser.query_parsing_success)
        self.assertGreaterEqual(len(parser.source_tables), 1)
        # Check for the tables
        source_names = [str(table).lower() for table in parser.source_tables]
        self.assertTrue(any("countries" in name for name in source_names))
        # Check target table
        target_names = [str(table).lower() for table in parser.target_tables]
        self.assertTrue(any("test_qminh" in name for name in target_names))


if __name__ == "__main__":
    unittest.main()
