#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Tests for Snowflake lineage in the Glue pipeline connector (scripts and Glue Studio nodes)."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.pipeline.gluepipeline.metadata import (
    TABLE_MODEL_MAP,
    GluepipelineSource,
)
from metadata.ingestion.source.pipeline.gluepipeline.models import SnowflakeNode
from metadata.ingestion.source.pipeline.gluepipeline.script_parser import (
    SnowflakeRef,
    parse_glue_script,
)

GLUE_CONFIG = {
    "source": {
        "type": "gluepipeline",
        "serviceName": "local_gluepipeline",
        "serviceConnection": {
            "config": {
                "type": "GluePipeline",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-2",
                    "endPointURL": "https://endpoint.com/",
                },
            },
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}

FROM_OPTIONS_SOURCE = """
sf_df = glueContext.create_dynamic_frame.from_options(
    connection_type="snowflake",
    connection_options={
        "sfUrl": "acme.eu-west-1.snowflakecomputing.com",
        "sfDatabase": "SALES_DB",
        "sfSchema": "RAW",
        "dbtable": "ORDERS",
        "connectionName": "snowflake-connection",
    },
    transformation_ctx="sf_df",
)
"""

WRITE_OPTIONS_TARGET = """
glueContext.write_dynamic_frame.from_options(
    frame=transformed,
    connection_type="snowflake",
    connection_options={
        "sfDatabase": "SALES_DB",
        "sfSchema": "CURATED",
        "dbtable": "ORDERS_DAILY",
        "preactions": "TRUNCATE TABLE ORDERS_DAILY",
    },
    transformation_ctx="sf_sink",
)
"""

SPARK_SHARED_OPTIONS = """
sf_options = {
    "sfURL": "acme.eu-west-1.snowflakecomputing.com",
    "sfUser": args["SF_USER"],
    "sfPassword": args["SF_PASSWORD"],
    "sfDatabase": "SALES_DB",
    "sfSchema": "RAW",
    "sfWarehouse": "LOAD_WH",
}

orders = (
    spark.read.format("snowflake")
    .options(**sf_options)
    .option("dbtable", "ORDERS")
    .load()
)

(
    orders.groupBy("ORDER_DATE").count()
    .write.format("net.snowflake.spark.snowflake")
    .options(**sf_options)
    .option("sfSchema", "CURATED")
    .option("dbtable", "ORDERS_DAILY")
    .mode("overwrite")
    .save()
)
"""


class TestGlueScriptSnowflakeParser:
    def test_from_options_source(self):
        result = parse_glue_script(FROM_OPTIONS_SOURCE)

        assert result.has_lineage
        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]
        assert result.jdbc_sources == []

    def test_write_options_target(self):
        result = parse_glue_script(WRITE_OPTIONS_TARGET)

        assert result.snowflake_targets == [SnowflakeRef(table="ORDERS_DAILY", database="SALES_DB", schema="CURATED")]
        # before Snowflake support the generic branch stored it as a JDBC ref with no database/schema
        assert result.jdbc_targets == []

    def test_spark_dataframe_api_with_shared_options(self):
        result = parse_glue_script(SPARK_SHARED_OPTIONS)

        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]
        assert result.snowflake_targets == [SnowflakeRef(table="ORDERS_DAILY", database="SALES_DB", schema="CURATED")]

    def test_format_given_as_a_constant(self):
        """The Snowflake docs idiom: format(SNOWFLAKE_SOURCE_NAME)."""
        script = """
SNOWFLAKE_SOURCE_NAME = "net.snowflake.spark.snowflake"
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW"}
df = spark.read.format(SNOWFLAKE_SOURCE_NAME).options(**sf_options).option("dbtable", "ORDERS").load()
df.write.format(SNOWFLAKE_SOURCE_NAME).options(**sf_options).option("dbtable", "ORDERS_DAILY").save()
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]
        assert result.snowflake_targets == [SnowflakeRef(table="ORDERS_DAILY", database="SALES_DB", schema="RAW")]

    def test_other_formats_are_ignored(self):
        """A non-Snowflake read must not swallow the Snowflake read that follows it."""
        script = """
PARQUET = "parquet"
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW"}
events = spark.read.format(PARQUET).option("dbtable", "NOT_SNOWFLAKE").schema(s)
orders = spark.read.format("snowflake").options(**sf_options).option("dbtable", "ORDERS").load()
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]

    @pytest.mark.parametrize(
        ("dbtable", "expected"),
        [
            ("ORDERS", SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")),
            ("CURATED.ORDERS", SnowflakeRef(table="ORDERS", database="SALES_DB", schema="CURATED")),
            ("FINANCE.CURATED.ORDERS", SnowflakeRef(table="ORDERS", database="FINANCE", schema="CURATED")),
            ('"FINANCE"."CURATED"."ORDERS"', SnowflakeRef(table="ORDERS", database="FINANCE", schema="CURATED")),
        ],
    )
    def test_qualified_dbtable(self, dbtable, expected):
        script = f"""
sf_options = {{"sfDatabase": "SALES_DB", "sfSchema": "RAW"}}
df = spark.read.format("snowflake").options(**sf_options).option("dbtable", '{dbtable}').load()
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [expected]

    def test_script_wide_fallback_needs_a_single_value(self):
        """Two blocks with their own sfSchema: a block without one must not inherit the first match."""
        script = """
raw = spark.read.format("snowflake").options(**sf).option("sfSchema", "RAW").option("dbtable", "ORDERS").load()
cur = spark.read.format("snowflake").options(**sf).option("sfSchema", "CURATED").option("dbtable", "ORDERS_DAILY").load()
other = spark.read.format("snowflake").options(**sf).option("dbtable", "CUSTOMERS").load()
"""
        result = parse_glue_script(script)

        assert [(ref.table, ref.schema) for ref in result.snowflake_sources] == [
            ("ORDERS", "RAW"),
            ("ORDERS_DAILY", "CURATED"),
            ("CUSTOMERS", None),
        ]

    def test_dbtable_missing_is_ignored(self):
        script = """
df = spark.read.format("snowflake").options(**sf_options).option("query", "select 1").load()
"""
        result = parse_glue_script(script)

        assert not result.has_lineage

    def test_other_connection_types_unchanged(self):
        script = """
df = glueContext.create_dynamic_frame.from_options(
    connection_type="mysql",
    connection_options={"dbtable": "customers", "connectionName": "mysql-conn"},
)
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == []
        assert [ref.table for ref in result.jdbc_sources] == ["customers"]

    def test_calls_before_format_are_accepted(self):
        """mode() / option() may come before format() in a read or write chain."""
        script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW"}
orders = spark.read.option("dbtable", "ORDERS").options(**sf_options).format("snowflake").load()
orders.write.mode("append").format("snowflake").options(**sf_options).option("dbtable", "ORDERS_DAILY").save()
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]
        assert result.snowflake_targets == [SnowflakeRef(table="ORDERS_DAILY", database="SALES_DB", schema="RAW")]

    def test_dbtable_kept_in_the_shared_options_dict(self):
        """dbtable, sfDatabase and sfSchema may all live in the dict passed as **name / connection_options=name."""
        script = """
src_options = {"sfURL": "acme.snowflakecomputing.com", "sfDatabase": "SALES_DB", "sfSchema": "RAW", "dbtable": "ORDERS"}
tgt_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED", "dbtable": "ORDERS_DAILY"}
orders = spark.read.format("snowflake").options(**src_options).load()
orders.write.format("snowflake").options(**tgt_options).mode("overwrite").save()
glueContext.create_dynamic_frame.from_options(connection_type="snowflake", connection_options=src_options)
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [
            SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW"),
            SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW"),
        ]
        assert result.snowflake_targets == [SnowflakeRef(table="ORDERS_DAILY", database="SALES_DB", schema="CURATED")]

    def test_reassigned_options_dict_is_not_trusted(self):
        """sf_options is rebound before the write: neither call may take dbtable from the first dict."""
        script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW", "dbtable": "ORDERS"}
orders = spark.read.format("snowflake").options(**sf_options).load()
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED", "dbtable": "ORDERS_DAILY"}
orders.write.format("snowflake").options(**sf_options).save()
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == []
        assert result.snowflake_targets == []

    def test_quoted_name_with_a_dot_is_one_identifier(self):
        script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW"}
df = spark.read.format("snowflake").options(**sf_options).option("dbtable", '"ORDERS.V2"').load()
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS.V2", database="SALES_DB", schema="RAW")]

    def test_later_setting_overrides_an_earlier_one(self):
        """Spark keeps the last value: the shared dict passed after .option() wins."""
        script = """
target_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED", "dbtable": "ORDERS_DAILY"}
df.write.format("snowflake").option("sfSchema", "RAW").options(**target_options).save()
"""
        result = parse_glue_script(script)

        assert result.snowflake_targets == [SnowflakeRef(table="ORDERS_DAILY", database="SALES_DB", schema="CURATED")]

    def test_repeated_dbtable_keeps_the_last(self):
        script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW"}
df = spark.read.format("snowflake").options(**sf_options).option("dbtable", "ORDERS").option("dbtable", "CUSTOMERS").load()
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [SnowflakeRef(table="CUSTOMERS", database="SALES_DB", schema="RAW")]

    def test_option_keys_are_case_insensitive(self):
        script = """
df = spark.read.format("snowflake").option("sfdatabase", "SALES_DB").option("SFSCHEMA", "RAW").option("DBTABLE", "ORDERS").load()
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]

    def test_backslash_continued_chain(self):
        script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW"}
orders = spark.read \\
    .format("snowflake") \\
    .options(**sf_options) \\
    .option("dbtable", "ORDERS") \\
    .load()
orders.write \\
    .format("snowflake") \\
    .options(**sf_options) \\
    .option("dbtable", "ORDERS_DAILY") \\
    .save()
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]
        assert result.snowflake_targets == [SnowflakeRef(table="ORDERS_DAILY", database="SALES_DB", schema="RAW")]


class TestSnowflakeStudioNode:
    def test_visual_nodes_are_mapped(self):
        assert TABLE_MODEL_MAP["SnowflakeSource"] is SnowflakeNode
        assert TABLE_MODEL_MAP["SnowflakeTarget"] is SnowflakeNode

    def test_node_data(self):
        node = SnowflakeNode.model_validate(
            {
                "Name": "Snowflake target",
                "Inputs": ["node-1"],
                "Data": {
                    "Database": "SALES_DB",
                    "Schema": "CURATED",
                    "Table": "ORDERS_DAILY",
                    "Action": "truncate",
                    "Connection": {"Value": "snowflake-connection"},
                },
            }
        )

        assert (node.database_name, node.schema_name, node.table_name) == ("SALES_DB", "CURATED", "ORDERS_DAILY")

    def test_query_source_has_no_table(self):
        node = SnowflakeNode.model_validate(
            {"Name": "Snowflake query", "Data": {"SourceType": "query", "SampleQuery": "select 1"}}
        )

        assert node.table_name is None


@pytest.fixture
def glue_source():
    with patch("metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"):
        config = OpenMetadataWorkflowConfig.model_validate(GLUE_CONFIG)
        source = GluepipelineSource.create(GLUE_CONFIG["source"], config.workflowConfig.openMetadataServerConfig)
    source.metadata = MagicMock()
    source.glue = MagicMock()
    return source


ORDERS_REF = EntityReference(id="85811038-099a-11ed-861d-0242ac120002", type="table", name="ORDERS")


class TestResolveSnowflakeEntities:
    def test_exact_match(self, glue_source):
        glue_source.metadata.get_entity_reference.return_value = ORDERS_REF
        lineage_details = {"sources": [], "targets": []}

        with patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build") as build:
            build.return_value = ["snowflake_prod.SALES_DB.RAW.ORDERS"]
            glue_source._resolve_snowflake_entities(
                [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")], lineage_details, "sources"
            )

        assert lineage_details["sources"] == [ORDERS_REF]
        assert build.call_args.kwargs["database_name"] == "SALES_DB"
        assert build.call_args.kwargs["schema_name"] == "RAW"
        glue_source.metadata.get_entity_reference.assert_called_once()
        assert glue_source.metadata.get_entity_reference.call_args.kwargs["fqn"] == "snowflake_prod.SALES_DB.RAW.ORDERS"

    def test_falls_back_to_schema_and_table(self, glue_source):
        """The script's sfDatabase does not exist in OpenMetadata: match on schema.table."""
        glue_source.metadata.get_entity_reference.return_value = ORDERS_REF
        lineage_details = {"sources": [], "targets": []}

        with patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build") as build:
            build.side_effect = [None, ["snowflake_prod.SALES.RAW.ORDERS"]]
            glue_source._resolve_snowflake_entities(
                [SnowflakeRef(table="ORDERS", database="SALES_DB_ALIAS", schema="RAW")], lineage_details, "targets"
            )

        assert lineage_details["targets"] == [ORDERS_REF]
        assert [call.kwargs["database_name"] for call in build.call_args_list] == ["SALES_DB_ALIAS", None]

    def test_ambiguous_match_is_skipped(self, glue_source):
        lineage_details = {"sources": [], "targets": []}

        with patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build") as build:
            build.return_value = ["svc.SALES_DB.RAW.ORDERS", "svc.SALES_DB.RAW_OLD.ORDERS"]
            glue_source._resolve_snowflake_entities([SnowflakeRef(table="ORDERS")], lineage_details, "sources")

        assert lineage_details["sources"] == []

    def test_known_schema_never_falls_back_to_bare_name(self, glue_source):
        """ORDERS is not ingested in RAW yet: a same-named table in another schema must not be linked."""
        lineage_details = {"sources": [], "targets": []}

        with patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build") as build:
            build.side_effect = [None, None, ["svc.SALES_DB.ARCHIVE.ORDERS"]]
            glue_source._resolve_snowflake_entities(
                [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")], lineage_details, "targets"
            )

        assert lineage_details["targets"] == []
        assert [call.kwargs["schema_name"] for call in build.call_args_list] == ["RAW", "RAW"]
        glue_source.metadata.get_entity_reference.assert_not_called()

    def test_unknown_schema_uses_bare_name_once(self, glue_source):
        glue_source.metadata.get_entity_reference.return_value = ORDERS_REF
        lineage_details = {"sources": [], "targets": []}

        with patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build") as build:
            build.return_value = ["svc.SALES_DB.RAW.ORDERS"]
            glue_source._resolve_snowflake_entities([SnowflakeRef(table="ORDERS")], lineage_details, "sources")

        assert lineage_details["sources"] == [ORDERS_REF]
        assert len(build.call_args_list) == 1
        assert build.call_args.kwargs["schema_name"] is None

    def test_same_table_in_two_services_is_ambiguous(self, glue_source):
        """Two Snowflake services with the same table: do not link whichever service is listed first."""
        glue_source.get_db_service_names = MagicMock(return_value=["snowflake_prod", "snowflake_dr"])
        lineage_details = {"sources": [], "targets": []}

        with patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build") as build:
            build.side_effect = lambda **kwargs: [f"{kwargs['service_name']}.SALES_DB.RAW.ORDERS"]
            glue_source._resolve_snowflake_entities(
                [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")], lineage_details, "sources"
            )

        assert lineage_details["sources"] == []
        assert [call.kwargs["service_name"] for call in build.call_args_list] == ["snowflake_prod", "snowflake_dr"] * 2

    def test_unmatched_service_does_not_make_an_exact_match_ambiguous(self, glue_source):
        """A search miss in one service returns a name built from the parts; it is not a second match."""
        glue_source.get_db_service_names = MagicMock(return_value=["snowflake_prod", "redshift_dw"])
        glue_source.metadata.get_entity_reference.side_effect = lambda entity, fqn: (
            ORDERS_REF if fqn == "snowflake_prod.SALES_DB.RAW.ORDERS" else None
        )
        lineage_details = {"sources": [], "targets": []}

        with patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build") as build:
            build.side_effect = lambda **kwargs: [f"{kwargs['service_name']}.SALES_DB.RAW.ORDERS"]
            glue_source._resolve_snowflake_entities(
                [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")], lineage_details, "sources"
            )

        assert lineage_details["sources"] == [ORDERS_REF]
        assert len(build.call_args_list) == 2

    def test_not_found(self, glue_source):
        lineage_details = {"sources": [], "targets": []}

        with patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build", return_value=None):
            glue_source._resolve_snowflake_entities(
                [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")], lineage_details, "sources"
            )

        assert lineage_details["sources"] == []

    def test_script_lineage_end_to_end(self, glue_source):
        glue_source.metadata.get_entity_reference.return_value = ORDERS_REF
        lineage_details = {"sources": [], "targets": []}

        with (
            patch.object(glue_source, "_download_s3_script", return_value=SPARK_SHARED_OPTIONS),
            patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build") as build,
        ):
            build.side_effect = lambda **kwargs: [
                f"svc.{kwargs['database_name']}.{kwargs['schema_name']}.{kwargs['table_name']}"
            ]
            glue_source._extract_script_lineage("s3://bucket/scripts/orders.py", lineage_details)

        assert len(lineage_details["sources"]) == 1
        assert len(lineage_details["targets"]) == 1
        searched = {call.kwargs["fqn"] for call in glue_source.metadata.get_entity_reference.call_args_list}
        assert searched == {"svc.SALES_DB.RAW.ORDERS", "svc.SALES_DB.CURATED.ORDERS_DAILY"}


VISUAL_NODES = {
    "node-src": {
        "SnowflakeSource": {
            "Name": "Snowflake orders",
            "Data": {"SourceType": "table", "Database": "SALES_DB", "Schema": "RAW", "Table": "ORDERS"},
        }
    },
    "node-tgt": {
        "SnowflakeTarget": {
            "Name": "Snowflake orders daily",
            "Inputs": ["node-src"],
            "Data": {"Database": "SALES_DB", "Schema": "CURATED", "Table": "ORDERS_DAILY"},
        }
    },
}


class TestVisualSnowflakeLineage:
    def test_nodes_resolve_through_the_snowflake_resolver(self, glue_source):
        glue_source.metadata.get_entity_reference.return_value = ORDERS_REF
        lineage_details = {"sources": [], "targets": []}

        with patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build") as build:
            build.side_effect = lambda **kwargs: [
                f"svc.{kwargs['database_name']}.{kwargs['schema_name']}.{kwargs['table_name']}"
            ]
            glue_source._extract_visual_etl_lineage(VISUAL_NODES, lineage_details)

        assert lineage_details == {"sources": [ORDERS_REF], "targets": [ORDERS_REF]}
        assert all(call.kwargs["fetch_multiple_entities"] for call in build.call_args_list)

    def test_same_table_in_two_services_is_not_linked(self, glue_source):
        """The visual path must not link whichever configured service is listed first."""
        glue_source.get_db_service_names = MagicMock(return_value=["snowflake_prod", "snowflake_dr"])
        glue_source.metadata.get_entity_reference.return_value = ORDERS_REF
        lineage_details = {"sources": [], "targets": []}

        with patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build") as build:
            build.side_effect = lambda **kwargs: [
                f"{kwargs['service_name']}.{kwargs['database_name']}.{kwargs['schema_name']}.{kwargs['table_name']}"
            ]
            glue_source._extract_visual_etl_lineage(VISUAL_NODES, lineage_details)

        assert lineage_details == {"sources": [], "targets": []}
