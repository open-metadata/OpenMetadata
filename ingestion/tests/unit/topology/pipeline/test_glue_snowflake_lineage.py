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

import logging
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
sf = {"sfDatabase": "SALES_DB"}
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

    def test_reassigned_options_dict_uses_the_assignment_before_the_call(self):
        """sf_options is rebound before the write: each call reads the dict assigned just before it."""
        script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW", "dbtable": "ORDERS"}
orders = spark.read.format("snowflake").options(**sf_options).load()
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED", "dbtable": "ORDERS_DAILY"}
orders.write.format("snowflake").options(**sf_options).save()
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]
        assert result.snowflake_targets == [SnowflakeRef(table="ORDERS_DAILY", database="SALES_DB", schema="CURATED")]

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

    def test_empty_option_value_does_not_hide_the_next_setting(self):
        script = """
df = spark.read.format("snowflake").option("sfDatabase", "SALES_DB").option("sfSchema", "RAW").option("preactions", "").option("dbtable", "ORDERS").load()
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]

    def test_empty_dict_entry_does_not_hide_the_next_entry(self):
        script = """
sf_options = {"preactions": "", "dbtable": "ORDERS", "sfDatabase": "SALES_DB", "sfSchema": "RAW"}
df = spark.read.format("snowflake").options(**sf_options).load()
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]

    @pytest.mark.parametrize(
        "preactions",
        [
            '"""DELETE FROM AUDIT WHERE dbtable = \'STALE\'"""',
            "'''DELETE FROM AUDIT WHERE \"dbtable\": \"STALE\"'''",
            '"UPDATE AUDIT SET note = \\"dbtable=\\\'STALE\\\'\\""',
        ],
    )
    def test_settings_inside_a_string_value_are_ignored(self, preactions):
        """SQL in preactions mentions dbtable: triple-quoted or escaped, it must not replace the table."""
        script = f"""
sf_options = {{"sfDatabase": "SALES_DB", "sfSchema": "RAW"}}
df.write.format("snowflake").options(**sf_options).option("dbtable", "ORDERS").option("preactions", {preactions}).save()
"""
        result = parse_glue_script(script)

        assert result.snowflake_targets == [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]

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


SF_DICT = 'sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW"}'


class TestSnowflakeScriptParsedAsPython:
    """Snowflake calls are read from the Python AST: comments, quoting and scoping cannot fool it."""

    def test_apostrophe_in_a_comment(self):
        script = f"""
{SF_DICT}
df = (spark.read.format('snowflake')
    # don't hardcode
    .options(**sf_options)
    .option('dbtable', 'ORDERS')
    .load())
"""
        assert parse_glue_script(script).snowflake_sources == [
            SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")
        ]

    def test_settings_in_a_comment_are_ignored(self):
        script = f"""
{SF_DICT}
df = (spark.read.format("snowflake")
    .options(**sf_options)
    .option("dbtable", "ORDERS")
    # .option("dbtable", "FAKE")
    .load())
"""
        assert [ref.table for ref in parse_glue_script(script).snowflake_sources] == ["ORDERS"]

    def test_format_constant_used_inside_a_function(self):
        script = f"""
SNOWFLAKE_SOURCE_NAME = "net.snowflake.spark.snowflake"
{SF_DICT}

def main():
    spark.read.format(SNOWFLAKE_SOURCE_NAME).options(**sf_options).option("dbtable", "ORDERS").load()
"""
        assert [ref.table for ref in parse_glue_script(script).snowflake_sources] == ["ORDERS"]

    def test_later_unknown_value_overrides_a_literal(self):
        script = f"""
{SF_DICT}
df = spark.read.format("snowflake").options(**sf_options).option("dbtable", "ORDERS").option("dbtable", args["TABLE"]).load()
"""
        assert parse_glue_script(script).snowflake_sources == []

    def test_unknown_schema_is_left_to_the_resolver(self):
        """A schema passed as a job parameter is left unset: the resolver links the table only when it is unique."""
        script = f"""
{SF_DICT}
df = spark.read.format("snowflake").options(**sf_options).option("sfSchema", args["SCHEMA"]).option("dbtable", "ORDERS").load()
"""
        assert parse_glue_script(script).snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB")]

    def test_unknown_schema_in_the_options_dict(self):
        script = """
sf = {"sfDatabase": "SALES_DB", "sfSchema": args["SCHEMA"]}
df = spark.read.format("snowflake").options(**sf).option("dbtable", "ORDERS").load()
"""
        assert parse_glue_script(script).snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB")]

    def test_function_parameter_is_unknown(self):
        script = f"""
{SF_DICT}

def write(df, table):
    df.write.format("snowflake").options(**sf_options).option("dbtable", table).save()
"""
        assert parse_glue_script(script).snowflake_targets == []

    def test_branches_keep_the_values_they_agree_on(self):
        script = """
if args["ENV"] == "prod":
    sf_options = {"sfDatabase": "PROD", "sfSchema": "RAW", "dbtable": "ORDERS"}
else:
    sf_options = {"sfDatabase": "DEV", "sfSchema": "RAW", "dbtable": "ORDERS"}
df = spark.read.format("snowflake").options(**sf_options).load()
"""
        assert parse_glue_script(script).snowflake_sources == [SnowflakeRef(table="ORDERS", schema="RAW")]

    def test_branches_that_disagree_on_the_table_are_not_linked(self):
        script = """
if args["ENV"] == "prod":
    sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW", "dbtable": "ORDERS"}
else:
    sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW", "dbtable": "ORDERS_DEV"}
df = spark.read.format("snowflake").options(**sf_options).load()
"""
        assert parse_glue_script(script).snowflake_sources == []

    def test_dict_changed_in_place_is_unknown(self):
        script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW", "dbtable": "ORDERS"}
sf_options["dbtable"] = args["TABLE"]
df = spark.read.format("snowflake").options(**sf_options).load()
"""
        assert parse_glue_script(script).snowflake_sources == []

    def test_unlisted_options_leave_database_and_schema_unset(self):
        """**get_options() may set sfDatabase / sfSchema: neither is guessed, the resolver needs a unique table."""
        script = """
df = spark.read.format("snowflake").options(**get_options()).option("dbtable", "ORDERS").load()
"""
        assert parse_glue_script(script).snowflake_sources == [SnowflakeRef(table="ORDERS")]

    def test_unlisted_options_after_the_table_may_set_it(self):
        script = """
df = spark.read.format("snowflake").option("dbtable", "ORDERS").options(**get_options()).load()
"""
        assert parse_glue_script(script).snowflake_sources == []

    @pytest.mark.parametrize(
        "options",
        ['{**base, "dbtable": "ORDERS"}', 'dict(base, dbtable="ORDERS")', 'dict(**base, dbtable="ORDERS")'],
    )
    def test_merged_dicts(self, options):
        script = f"""
base = {{"sfDatabase": "SALES_DB", "sfSchema": "RAW"}}
df = glueContext.create_dynamic_frame.from_options(connection_type="snowflake", connection_options={options})
"""
        assert parse_glue_script(script).snowflake_sources == [
            SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")
        ]

    def test_glue_context_positional_and_flat_forms(self):
        script = """
opts = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED", "dbtable": "ORDERS_DAILY"}
glueContext.write_dynamic_frame.from_options(frame, "snowflake", opts)
glueContext.write_dynamic_frame_from_options(frame=frame, connection_type="SNOWFLAKE", connection_options=opts)
"""
        assert (
            parse_glue_script(script).snowflake_targets
            == [SnowflakeRef(table="ORDERS_DAILY", database="SALES_DB", schema="CURATED")] * 2
        )

    def test_option_with_keywords_may_set_any_key(self):
        script = f"""
{SF_DICT}
df = spark.read.format("snowflake").options(**sf_options).option("dbtable", "ORDERS").option(key=k, value=v).load()
"""
        assert parse_glue_script(script).snowflake_sources == []

    @pytest.mark.parametrize(
        "option",
        ['option(key="preactions", value="")', 'option("preactions", value="")'],
    )
    def test_option_with_literal_keywords_is_read(self, option):
        script = f"""
{SF_DICT}
df = spark.read.format("snowflake").options(**sf_options).option("dbtable", "ORDERS").{option}.load()
"""
        assert parse_glue_script(script).snowflake_sources == [
            SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")
        ]

    def test_option_with_a_literal_keyword_key_sets_it(self):
        script = f"""
{SF_DICT}
df = spark.read.format("snowflake").options(**sf_options).option("dbtable", "ORDERS").option(value="CUSTOMERS", key="dbtable").load()
"""
        assert [ref.table for ref in parse_glue_script(script).snowflake_sources] == ["CUSTOMERS"]

    def test_load_and_save_keywords_are_options(self):
        script = f"""
{SF_DICT}
df = spark.read.options(**sf_options).load(format="snowflake", dbtable="ORDERS")
df.write.format("snowflake").options(**sf_options).option("dbtable", "STAGE").save(mode="overwrite", dbtable="ORDERS_DAILY")
"""
        result = parse_glue_script(script)

        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]
        assert result.snowflake_targets == [SnowflakeRef(table="ORDERS_DAILY", database="SALES_DB", schema="RAW")]

    def test_name_with_more_than_three_parts_is_not_linked(self):
        script = """
df = spark.read.format("snowflake").option("dbtable", "A.B.C.D").load()
"""
        assert parse_glue_script(script).snowflake_sources == []

    def test_unparseable_script_keeps_other_lineage(self):
        script = """
df = spark.read.parquet("s3://bucket/input/")
df.write.format("snowflake").option("dbtable", "ORDERS").save(
"""
        result = parse_glue_script(script)

        assert result.s3_sources == ["s3://bucket/input/"]
        assert result.snowflake_targets == []

    def test_deeply_nested_expression_keeps_lineage(self):
        """A long string concatenation parses deep; analysing the script must not overflow the stack."""
        sql = " + ".join(['"SELECT 1"'] * 1500)
        script = f"""
df = spark.read.parquet("s3://bucket/input/")
query = {sql}
spark.read.format("snowflake").option("dbtable", "ORDERS").load()
"""
        result = parse_glue_script(script)

        assert result.s3_sources == ["s3://bucket/input/"]
        assert result.snowflake_sources == [SnowflakeRef(table="ORDERS")]


READ_ORDERS = 'spark.read.format("snowflake").options(**sf_options).option("dbtable", "ORDERS").load()'
SALES_RAW = 'sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW"}'
DEV_RAW = 'sf_options = {"sfDatabase": "DEV_DB", "sfSchema": "RAW"}'


def _sources(script: str) -> list[SnowflakeRef]:
    return parse_glue_script(script).snowflake_sources


ORDERS = [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")]


# assignments that disagree on sfDatabase but agree on sfSchema
RAW_ANY_DATABASE = [SnowflakeRef(table="ORDERS", schema="RAW")]


class TestSnowflakeNameResolution:
    """Which assignments of an options dict a read may see: module and function scope, in order."""

    @pytest.mark.parametrize(
        "wrapper",
        ['if __name__ == "__main__":', "try:", 'with open("job.conf") as conf:'],
    )
    def test_binding_and_read_in_one_block(self, wrapper):
        handler = "except Exception:\n    raise\n" if wrapper == "try:" else ""
        script = f"""
{wrapper}
    {SALES_RAW}
    {READ_ORDERS}
{handler}"""
        assert _sources(script) == ORDERS

    def test_reassigned_in_the_same_block_reads_the_latest(self):
        script = f"""
if __name__ == "__main__":
    {DEV_RAW}
    {SALES_RAW}
    {READ_ORDERS}
"""
        assert _sources(script) == ORDERS

    def test_rebound_in_an_enclosing_block(self):
        script = f"""
{DEV_RAW}
if __name__ == "__main__":
    {SALES_RAW}
    {READ_ORDERS}
"""
        assert _sources(script) == ORDERS

    def test_rebound_in_a_branch_before_the_read_keeps_agreed_values(self):
        script = f"""
{SALES_RAW}
if args["ENV"] == "dev":
    {DEV_RAW}
{READ_ORDERS}
"""
        assert _sources(script) == RAW_ANY_DATABASE

    def test_rebound_later_in_a_loop_keeps_agreed_values(self):
        """The second iteration reads the dict assigned at the end of the first."""
        script = f"""
{SALES_RAW}
for env in ("dev", "prod"):
    {READ_ORDERS}
    {DEV_RAW}
"""
        assert _sources(script) == RAW_ANY_DATABASE

    def test_single_binding_is_seen_from_anywhere(self):
        """One binding, even in a branch: wherever the read runs, that is the only value it can have."""
        script = f"""
def main():
    {READ_ORDERS}

if __name__ == "__main__":
    {SALES_RAW}
    main()
"""
        assert _sources(script) == ORDERS

    def test_reassigned_global_read_in_a_function_keeps_agreed_values(self):
        """The function reads the global when it is called, so any of its assignments may be in effect."""
        script = f"""
{DEV_RAW}

def main():
    {READ_ORDERS}

{SALES_RAW}
main()
"""
        assert _sources(script) == RAW_ANY_DATABASE

    @pytest.mark.parametrize(
        "helper",
        [
            "def write(df, sf_options):\n    pass",
            "merge = lambda sf_options: sf_options",
            "names = [sf_options for sf_options in configs]",
            "class Config:\n    sf_options = {}",
            "def reset():\n    sf_options = {}",
        ],
    )
    def test_names_in_other_scopes_do_not_hide_the_global(self, helper):
        script = f"""
{SALES_RAW}

{helper}

{READ_ORDERS}
"""
        assert _sources(script) == ORDERS

    def test_local_dict_shadows_the_global(self):
        script = f"""
{DEV_RAW}

def main():
    {SALES_RAW}
    {READ_ORDERS}
"""
        assert _sources(script) == ORDERS

    @pytest.mark.parametrize("annotation", ["sf_options: dict", "sf_options: dict[str, str]"])
    def test_bare_annotation_binds_nothing(self, annotation):
        script = f"""
{SALES_RAW}
{annotation}
{READ_ORDERS}
"""
        assert _sources(script) == ORDERS

    def test_global_reassigned_from_a_function_keeps_agreed_values(self):
        script = f"""
{SALES_RAW}

def switch():
    global sf_options
    {DEV_RAW}

{READ_ORDERS}
"""
        assert _sources(script) == RAW_ANY_DATABASE

    def test_local_dict_changed_in_place_leaves_the_global(self):
        script = f"""
{SALES_RAW}

def build():
    sf_options = {{}}
    sf_options.update(sfSchema="STAGE")
    return sf_options

{READ_ORDERS}
"""
        assert _sources(script) == ORDERS

    def test_schema_changed_in_place_from_a_function_is_unknown(self):
        script = f"""
{SALES_RAW}

def switch():
    sf_options.update(sfSchema="STAGE")

{READ_ORDERS}
"""
        assert _sources(script) == [SnowflakeRef(table="ORDERS", database="SALES_DB")]

    @pytest.mark.parametrize(
        "change",
        [
            'sf_options["sfWarehouse"] = "WH"',
            'sf_options.update({"sfWarehouse": "WH", "sfRole": "R"})',
            'sf_options.update(sfWarehouse="WH")',
            'sf_options |= {"sfWarehouse": "WH"}',
            'sf_options.setdefault("sfRole", "R")',
            'del sf_options["sfRole"]',
        ],
    )
    def test_other_keys_changed_in_place_keep_the_link(self, change):
        script = f"""
{SALES_RAW}
{change}
{READ_ORDERS}
"""
        assert _sources(script) == ORDERS

    @pytest.mark.parametrize(
        "change",
        ['sf_options["SFSCHEMA"] = args["S"]', 'sf_options.pop("sfSchema")', 'sf_options |= {"sfSchema": "STAGE"}'],
    )
    def test_schema_changed_in_place_is_left_to_the_resolver(self, change):
        script = f"""
{SALES_RAW}
{change}
{READ_ORDERS}
"""
        assert _sources(script) == [SnowflakeRef(table="ORDERS", database="SALES_DB")]

    @pytest.mark.parametrize(
        "change", ["sf_options[key] = value", "sf_options.update(overrides)", "sf_options.clear()"]
    )
    def test_unreadable_change_in_place_is_unknown(self, change):
        script = f"""
{SALES_RAW}
{change}
{READ_ORDERS}
"""
        assert _sources(script) == [SnowflakeRef(table="ORDERS")]

    def test_class_attribute_read_in_the_class_body_is_unknown(self):
        """Class attributes are not tracked: a read of one leaves database and schema to the resolver."""
        script = f"""
{SALES_RAW}

class Job:
    {DEV_RAW}
    source = {READ_ORDERS}
"""
        assert _sources(script) == [SnowflakeRef(table="ORDERS")]

    @pytest.mark.parametrize(
        "deferred",
        [
            f"job = lambda: {READ_ORDERS}",
            f"jobs = ({READ_ORDERS} for _ in range(2))",
        ],
    )
    def test_lambda_or_generator_reads_any_assignment(self, deferred):
        """They run when called or consumed, after the dict may have been reassigned."""
        script = f"""
{DEV_RAW}
{deferred}
{SALES_RAW}
"""
        assert _sources(script) == RAW_ANY_DATABASE

    def test_walrus_in_a_lambda_binds_in_the_lambda(self):
        script = f"""
{SALES_RAW}
pick = lambda c: (sf_options := c)
{READ_ORDERS}
"""
        assert _sources(script) == ORDERS

    def test_walrus_in_a_comprehension_rebinds_the_enclosing_name(self):
        script = f"""
{SALES_RAW}
found = [sf_options := pick(c) for c in configs]
{READ_ORDERS}
"""
        assert _sources(script) == [SnowflakeRef(table="ORDERS")]

    @pytest.mark.parametrize("change", ['opts["dbtable"] = "CURRENT"', 'opts.update(dbtable="CURRENT")'])
    def test_change_through_an_alias_reaches_the_original(self, change):
        script = f"""
sf_options = {{"sfDatabase": "SALES_DB", "sfSchema": "RAW", "dbtable": "OLD"}}
opts = sf_options
{change}
spark.read.format("snowflake").options(**sf_options).load()
"""
        assert _sources(script) == []

    def test_local_change_after_a_nested_assignment_stays_local(self):
        """The change is indexed after every binding, so it finds the function's own sf_options."""
        script = """
def main():
    if ready:
        sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW", "dbtable": "OLD"}
    sf_options.update(dbtable="CURRENT")
    spark.read.format("snowflake").options(**sf_options).load()
"""
        assert _sources(script) == []

    def test_nonlocal_assignment_reaches_the_function_that_binds_the_name(self):
        script = """
def outer():
    sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW", "dbtable": "OLD"}

    def middle():
        def change():
            nonlocal sf_options
            sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW", "dbtable": "CURRENT"}

        change()

    middle()
    spark.read.format("snowflake").options(**sf_options).load()
"""
        assert _sources(script) == []

    @pytest.mark.parametrize("pattern", ["case str() as table:", "case [*table]:", "case {**table}:", "case table:"])
    def test_match_capture_rebinds_the_name(self, pattern):
        script = f"""
table = "OLD"
{SALES_RAW}
match args["TABLE"]:
    {pattern}
        spark.read.format("snowflake").options(**sf_options).option("dbtable", table).load()
"""
        assert _sources(script) == []

    def test_global_write_from_an_earlier_defined_function_is_a_candidate(self):
        """switch() is defined first but runs after the module assignment."""
        script = """
def switch():
    global sf_options
    sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW", "dbtable": "CURRENT"}

sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "RAW", "dbtable": "OLD"}
switch()
spark.read.format("snowflake").options(**sf_options).load()
"""
        assert _sources(script) == []

    def test_comprehension_variable_is_unknown(self):
        script = f"""
table = "ORDERS"
{SALES_RAW}
frames = [spark.read.format("snowflake").options(**sf_options).option("dbtable", table).load() for table in tables]
"""
        assert _sources(script) == []

    def test_string_concatenation_rebinds_only_the_copy(self):
        """`+=` on a str rebinds the name it is applied to; the name it was copied from is unchanged."""
        script = f"""
{SALES_RAW}
FORMAT = "snowflake"
table = "ORDERS"
f = FORMAT
f += "_suffix"
t = table
t += "_V2"
spark.read.format(FORMAT).options(**sf_options).option("dbtable", table).load()
"""
        assert _sources(script) == ORDERS

    def test_function_annotation_keeps_the_name_local(self):
        """`name: dict` in a function makes it local: a nested nonlocal assignment is not the global's."""
        script = f"""
{SALES_RAW}

def unrelated():
    sf_options: dict

    def fill():
        nonlocal sf_options
        sf_options = {{}}

    fill()

{READ_ORDERS}
"""
        assert _sources(script) == ORDERS

    def test_copy_changed_in_place_leaves_the_original(self):
        script = f"""
{SALES_RAW}
opts = dict(sf_options)
opts["sfSchema"] = "STAGE"
{READ_ORDERS}
"""
        assert _sources(script) == ORDERS

    def test_dict_built_from_itself_reads_the_earlier_binding(self):
        script = f"""
{SALES_RAW}
sf_options = {{**sf_options, "dbtable": "ORDERS"}}
df = spark.read.format("snowflake").options(**sf_options).load()
"""
        assert _sources(script) == ORDERS

    def test_scala_script_has_no_snowflake_lineage(self):
        """Snowflake script lineage is Python-only: a Scala job does not parse."""
        script = """
val df = spark.read.format("snowflake").options(sfOptions).option("dbtable", "ORDERS").load()
"""
        assert _sources(script) == []


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

    def test_same_table_in_two_services_is_ambiguous(self, glue_source, caplog):
        """Two Snowflake services with the same table: do not link whichever service is listed first."""
        glue_source.get_db_service_names = MagicMock(return_value=["snowflake_prod", "snowflake_dr"])
        lineage_details = {"sources": [], "targets": []}

        with (
            patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build") as build,
            caplog.at_level(logging.WARNING),
        ):
            build.side_effect = lambda **kwargs: [f"{kwargs['service_name']}.SALES_DB.RAW.ORDERS"]
            glue_source._resolve_snowflake_entities(
                [SnowflakeRef(table="ORDERS", database="SALES_DB", schema="RAW")], lineage_details, "sources"
            )

        assert lineage_details["sources"] == []
        # a less specific lookup would only match more: the ambiguous attempt ends the search
        assert [call.kwargs["service_name"] for call in build.call_args_list] == ["snowflake_prod", "snowflake_dr"]
        warnings = [record.getMessage() for record in caplog.records if record.levelno == logging.WARNING]
        assert len(warnings) == 1
        assert "matches several tables" in warnings[0]

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
