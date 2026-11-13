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
"""Tests for parameterized AWS Glue script lineage (job arguments, workflow run properties, loops)."""

import datetime
import logging
import tracemalloc
from typing import Any, cast
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest
from botocore.exceptions import ClientError
from cachetools import LRUCache

from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import EntityName, Uuid
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.pipeline.gluepipeline.metadata import (
    MAX_INSPECTED_RUNS,
    GluepipelineSource,
)
from metadata.ingestion.source.pipeline.gluepipeline.script_parser import (
    CatalogRef,
    JDBCRef,
    ParameterContext,
    SnowflakeRef,
    parse_glue_script,
    parse_glue_script_slices,
)
from metadata.ingestion.source.pipeline.gluepipeline.snowflake_parser import (
    MAX_EXPR_DEPTH,
    MAX_LOOP_UNROLLS,
    parse_snowflake_refs,
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
        "sourceConfig": {
            "config": {
                "type": "PipelineMetadata",
                "lineageInformation": {"dbServiceNames": ["snowflake_prod"]},
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://127.0.0.1:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}

ISSUE_37597_SCRIPT = """
import sys
import boto3
from awsglue.utils import getResolvedOptions

glue = boto3.client("glue")
sf_options = {
    "sfURL": "acme.eu-west-1.snowflakecomputing.com",
    "sfDatabase": "SALES_DB",
    "sfSchema": "CURATED",
}

args = getResolvedOptions(sys.argv, ["WORKFLOW_NAME", "WORKFLOW_RUN_ID"])
props = glue.get_workflow_run_properties(
    Name=args["WORKFLOW_NAME"], RunId=args["WORKFLOW_RUN_ID"]
)["RunProperties"]
market = props["MARKET"]
df.write.format("snowflake").options(**sf_options).option("dbtable", f"CONTRACT_{market}").mode("append").save()
"""

PIPELINE_UUID = "2aaa012e-099a-11ed-861d-0242ac120002"


def _make_table_ref(name: str) -> EntityReference:
    return EntityReference(id=Uuid(uuid4()), type="table", name=name)


def _mock_s3_body(script: str) -> dict[str, Any]:
    body = MagicMock()
    body.read.return_value = script.encode("utf-8")
    return {"Body": body}


@pytest.fixture
def glue_source() -> Any:
    with patch("metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"):
        config = OpenMetadataWorkflowConfig.model_validate(GLUE_CONFIG)
        source = GluepipelineSource.create(
            GLUE_CONFIG["source"],
            cast("Any", config.workflowConfig.openMetadataServerConfig),
        )
    source.metadata = MagicMock()
    source.glue = MagicMock()
    source._s3_client = MagicMock()
    object.__setattr__(source.context.get(), "pipeline", "market_workflow")
    object.__setattr__(source.context.get(), "pipeline_service", "local_gluepipeline")

    pipeline_entity = MagicMock(spec=Pipeline)
    pipeline_entity.id = Uuid(UUID(PIPELINE_UUID))
    pipeline_entity.name = EntityName("market_workflow")
    source.metadata.get_by_name.return_value = pipeline_entity
    return source


def _wire_table_catalog(glue_source: Any, table_refs: dict[str, EntityReference]) -> Any:
    """Wire fqn.build + get_entity_reference against an in-memory map of table_name -> EntityReference."""
    fqn_to_ref = {f"snowflake_prod.SALES_DB.CURATED.{name}": ref for name, ref in table_refs.items()}

    def fake_fqn_build(**kwargs: Any) -> Any:
        if kwargs.get("entity_type") is Pipeline:
            return f"{kwargs['service_name']}.{kwargs['pipeline_name']}"
        tbl = kwargs.get("table_name")
        if tbl in table_refs:
            fqn_str = f"snowflake_prod.SALES_DB.CURATED.{tbl}"
            return [fqn_str] if kwargs.get("fetch_multiple_entities") else fqn_str
        return [] if kwargs.get("fetch_multiple_entities") else None

    glue_source.metadata.get_entity_reference.side_effect = lambda entity, fqn: fqn_to_ref.get(fqn)
    return patch("metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build", side_effect=fake_fqn_build)


class TestIssue37597WorkflowRunProperties:
    def test_issue_37597_multi_market_workflow_runs_emit_pipeline_to_table_edges(self, glue_source: Any):
        markets = ["DE", "ES", "FR", "IT"]
        table_refs = {f"CONTRACT_{m}": _make_table_ref(f"CONTRACT_{m}") for m in markets}

        workflow_details = {
            "Name": "market_workflow",
            "DefaultRunProperties": {},
            "Graph": {
                "Nodes": [{"Type": "JOB", "Name": "load_contracts", "UniqueId": "n1"}],
                "Edges": [],
            },
        }
        glue_source.job_name_list = {"load_contracts"}
        glue_source.glue.get_job.return_value = {
            "Job": {
                "Command": {"Name": "glueetl", "ScriptLocation": "s3://glue-scripts/load_contracts.py"},
                "DefaultArguments": {"--job-language": "python"},
            }
        }
        glue_source.glue.get_workflow_runs.return_value = {
            "Runs": [
                {
                    "WorkflowRunId": f"wr_{m.lower()}",
                    "WorkflowRunProperties": {"MARKET": m},
                }
                for m in markets
            ]
        }
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(ISSUE_37597_SCRIPT)

        with _wire_table_catalog(glue_source, table_refs):
            results = list(glue_source.yield_pipeline_lineage_details(workflow_details))

        assert all(r.right is not None for r in results)
        edges = [r.right.edge for r in results]
        assert len(edges) == 4
        assert {model_str(e.fromEntity.id) for e in edges} == {PIPELINE_UUID}
        assert {e.fromEntity.type for e in edges} == {"pipeline"}
        assert {model_str(e.toEntity.id) for e in edges} == {model_str(ref.id) for ref in table_refs.values()}
        assert all(e.lineageDetails.source == LineageSource.PipelineLineage for e in edges)
        # S3 script downloaded once despite 4 run contexts
        glue_source._s3_client.get_object.assert_called_once()


class TestCrossRunCorrelationAndOneSidedEdges:
    def test_multi_market_runs_correlate_per_run_without_cartesian_pollution(self, glue_source: Any):
        script = """
import sys
import boto3
from awsglue.utils import getResolvedOptions

glue = boto3.client("glue")
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
args = getResolvedOptions(sys.argv, ["WORKFLOW_NAME", "WORKFLOW_RUN_ID", "table-suffix"])
props = glue.get_workflow_run_properties(Name=args["WORKFLOW_NAME"], RunId=args["WORKFLOW_RUN_ID"])["RunProperties"]
market = props["MARKET"]
suffix = args["table_suffix"]

raw = spark.read.format("snowflake").options(**sf_options).option("dbtable", f"RAW_{market}").load()
raw.write.format("snowflake").options(**sf_options).option("dbtable", f"CONTRACT_{market}_{suffix}").save()
"""
        table_refs = {
            "RAW_DE": _make_table_ref("RAW_DE"),
            "RAW_FR": _make_table_ref("RAW_FR"),
            "CONTRACT_DE_V1": _make_table_ref("CONTRACT_DE_V1"),
            "CONTRACT_FR_V2": _make_table_ref("CONTRACT_FR_V2"),
        }
        workflow_details = {
            "Name": "market_workflow",
            "DefaultRunProperties": {},
            "Graph": {"Nodes": [{"Type": "JOB", "Name": "sync_market", "UniqueId": "n1"}], "Edges": []},
        }
        glue_source.job_name_list = {"sync_market"}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/sync_market.py"}}
        }
        # Include duplicate DE run to verify deduplication too
        glue_source.glue.get_workflow_runs.return_value = {
            "Runs": [
                {
                    "WorkflowRunId": "wr_de_2",
                    "WorkflowRunProperties": {"MARKET": "DE"},
                    "Graph": {
                        "Nodes": [
                            {
                                "Type": "JOB",
                                "Name": "sync_market",
                                "JobDetails": {"JobRuns": [{"Id": "jr_de_2", "Arguments": {"--table-suffix": "V1"}}]},
                            }
                        ]
                    },
                },
                {
                    "WorkflowRunId": "wr_fr_1",
                    "WorkflowRunProperties": {"MARKET": "FR"},
                    "Graph": {
                        "Nodes": [
                            {
                                "Type": "JOB",
                                "Name": "sync_market",
                                "JobDetails": {"JobRuns": [{"Id": "jr_fr_1", "Arguments": {"--table-suffix": "V2"}}]},
                            }
                        ]
                    },
                },
                {
                    "WorkflowRunId": "wr_de_1",
                    "WorkflowRunProperties": {"MARKET": "DE"},
                    "Graph": {
                        "Nodes": [
                            {
                                "Type": "JOB",
                                "Name": "sync_market",
                                "JobDetails": {"JobRuns": [{"Id": "jr_de_1", "Arguments": {"--table-suffix": "V1"}}]},
                            }
                        ]
                    },
                },
            ]
        }
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, table_refs):
            results = list(glue_source.yield_pipeline_lineage_details(workflow_details))

        edges = [r.right.edge for r in results]
        id_to_name = {model_str(ref.id): name for name, ref in table_refs.items()}
        pairs = {(id_to_name[model_str(e.fromEntity.id)], id_to_name[model_str(e.toEntity.id)]) for e in edges}

        assert pairs == {
            ("RAW_DE", "CONTRACT_DE_V1"),
            ("RAW_FR", "CONTRACT_FR_V2"),
        }
        assert len(edges) == 2
        for edge in edges:
            assert model_str(edge.lineageDetails.pipeline.id) == PIPELINE_UUID
            assert edge.lineageDetails.source == LineageSource.PipelineLineage

    def test_one_sided_source_only_job_emits_table_to_pipeline_edge(self, glue_source: Any):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["MARKET"])
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
df = spark.read.format("snowflake").options(**sf_options).option("dbtable", f"RAW_{args['MARKET']}").load()
"""
        raw_de = _make_table_ref("RAW_DE")
        workflow_details = {"Name": "export_wf", "DefaultRunProperties": {}}
        glue_source.job_name_list = {"export_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {
                "Command": {"ScriptLocation": "s3://glue-scripts/export.py"},
                "DefaultArguments": {"--MARKET": "DE"},
            }
        }
        glue_source.glue.get_workflow_runs.return_value = {"Runs": []}
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, {"RAW_DE": raw_de}):
            results = list(glue_source.yield_pipeline_lineage_details(workflow_details))

        assert len(results) == 1
        edge = results[0].right.edge
        assert model_str(edge.fromEntity.id) == model_str(raw_de.id)
        assert model_str(edge.toEntity.id) == PIPELINE_UUID
        assert edge.toEntity.type == "pipeline"
        assert edge.lineageDetails.source == LineageSource.PipelineLineage


class TestResolvedOptionsAndRunPropertiesForms:
    def test_cli_flag_normalization_and_attribute_get_resolved_options(self):
        script = """
import sys
import awsglue.utils

args = awsglue.utils.getResolvedOptions(sys.argv, ["env-name", "TABLE"])
env = args["env_name"]
tbl = args["TABLE"]
spark.read.format("snowflake").option("sfDatabase", "DB").option("sfSchema", env).option("dbtable", tbl).load()
"""
        ctx = ParameterContext.from_mappings(job_args={"--env-name": "prod", "--TABLE": "sales"})
        sources, _ = parse_snowflake_refs(script, context=ctx)

        assert sources == [SnowflakeRef(table="sales", database="DB", schema="prod")]

    def test_args_get_known_missing_with_default_and_missing_without_default(self):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["KNOWN"])
t1 = args.get("KNOWN", "fallback_known")
t2 = args.get("MISSING_WITH_DEFAULT", "default_orders")
t3 = args.get("MISSING_NO_DEFAULT")
spark.read.format("snowflake").option("dbtable", t1).load()
spark.read.format("snowflake").option("dbtable", t2).load()
spark.read.format("snowflake").option("dbtable", t3).load()
"""
        ctx = ParameterContext.from_mappings(job_args={"--KNOWN": "actual_orders"})
        sources, _ = parse_snowflake_refs(script, context=ctx)

        assert sources == [
            SnowflakeRef(table="actual_orders"),
            SnowflakeRef(table="default_orders"),
        ]

    @pytest.mark.parametrize(
        ("snippet", "run_props", "expected_table"),
        [
            (
                """
resp = glue.get_workflow_run_properties(Name="wf", RunId="r1")
props = resp["RunProperties"]
mkt = props["MARKET"]
df.write.format("snowflake").option("dbtable", f"CONTRACT_{mkt}").save()
""",
                {"MARKET": "DE"},
                "CONTRACT_DE",
            ),
            (
                """
mkt = glue.get_workflow_run_properties(Name="wf", RunId="r1")["RunProperties"].get("MARKET", "US")
df.write.format("snowflake").option("dbtable", f"CONTRACT_{mkt}").save()
""",
                {},
                "CONTRACT_US",
            ),
            (
                """
mkt = glue.get_workflow_run_properties(Name="wf", RunId="r1")["RunProperties"].get("MARKET", "US")
df.write.format("snowflake").option("dbtable", f"CONTRACT_{mkt}").save()
""",
                {"MARKET": "IT"},
                "CONTRACT_IT",
            ),
            (
                """
resp = glue.get_workflow_run_properties(Name="wf", RunId="r1")
mkt = resp.get("RunProperties", {})["MARKET"]
df.write.format("snowflake").option("dbtable", f"CONTRACT_{mkt}").save()
""",
                {"MARKET": "ES"},
                "CONTRACT_ES",
            ),
        ],
    )
    def test_workflow_run_properties_access_patterns(
        self, snippet: str, run_props: dict[str, str], expected_table: str
    ):
        ctx = ParameterContext.from_mappings(run_props=run_props)
        _, targets = parse_snowflake_refs(snippet, context=ctx)

        assert targets == [SnowflakeRef(table=expected_table)]


class TestStringExpressionsDictsAndLoops:
    def test_fstring_with_qualified_name_and_string_methods(self):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["db", "schema", "market", "raw-prefix"])
db = args["db"].strip().upper()
schema = args["schema"].lstrip("_").rstrip("_").upper()
mkt = args["market"].lower().replace("-", "_").upper()
prefix = args["raw_prefix"].strip()
df = spark.read.format("snowflake").option("dbtable", f"{db}.{schema}.{prefix}_{mkt}").load()
"""
        ctx = ParameterContext.from_mappings(
            job_args={
                "--db": " finance ",
                "--schema": "__curated__",
                "--market": "de-at",
                "--raw-prefix": " ORDERS ",
            }
        )
        sources, _ = parse_snowflake_refs(script, context=ctx)

        assert sources == [SnowflakeRef(table="ORDERS_DE_AT", database="FINANCE", schema="CURATED")]

    def test_str_format_positional_indexed_keyword_and_dict_unpack(self):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["mkt", "prefix"])
mkt = args["mkt"]
prefix = args["prefix"]
fmt_kwargs = {"prefix": prefix, "mkt": mkt}

spark.read.format("snowflake").option("dbtable", "{}_{}".format(prefix, mkt)).load()
spark.read.format("snowflake").option("dbtable", "{1}_{0}".format(mkt, prefix)).load()
spark.read.format("snowflake").option("dbtable", "{prefix}_{mkt}_KW".format(prefix="T", mkt=mkt)).load()
df.write.format("snowflake").option("dbtable", "{prefix}_{mkt}_DICT".format(**fmt_kwargs)).save()
"""
        ctx = ParameterContext.from_mappings(job_args={"--mkt": "FR", "--prefix": "CONTRACT"})
        sources, targets = parse_snowflake_refs(script, context=ctx)

        assert [r.table for r in sources] == ["CONTRACT_FR", "CONTRACT_FR", "T_FR_KW"]
        assert [r.table for r in targets] == ["CONTRACT_FR_DICT"]

    def test_plus_concatenation_and_percent_formatting(self):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["mkt", "prefix"])
market = args["mkt"]
prefix = args["prefix"]
mapping = {"mkt": market, "pfx": prefix}

spark.read.format("snowflake").option("dbtable", "CONTRACT_" + market).load()
spark.read.format("snowflake").option("dbtable", "SINGLE_%s" % market).load()
spark.read.format("snowflake").option("dbtable", "%s_%s" % (prefix, market)).load()
df.write.format("snowflake").option("dbtable", "%(pfx)s_%(mkt)s" % mapping).save()
"""
        ctx = ParameterContext.from_mappings(job_args={"--mkt": "DE", "--prefix": "RAW"})
        sources, targets = parse_snowflake_refs(script, context=ctx)

        assert [r.table for r in sources] == ["CONTRACT_DE", "SINGLE_DE", "RAW_DE"]
        assert [r.table for r in targets] == ["RAW_DE"]

    def test_lookup_dictionary_mapping(self):
        script = """
import sys
from awsglue.utils import getResolvedOptions

ENV_SCHEMA = {"prod": "CURATED", "dev": "SANDBOX"}
args = getResolvedOptions(sys.argv, ["env", "tbl"])
schema = ENV_SCHEMA[args["env"]]
df.write.format("snowflake").option("sfDatabase", "SALES_DB").option("sfSchema", schema).option("dbtable", args["tbl"]).save()
"""
        ctx = ParameterContext.from_mappings(job_args={"--env": "prod", "--tbl": "REVENUE"})
        _, targets = parse_snowflake_refs(script, context=ctx)

        assert targets == [SnowflakeRef(table="REVENUE", database="SALES_DB", schema="CURATED")]

    def test_constant_and_split_loop_unrolling_without_cross_iteration_pollution(self, glue_source: Any):
        script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
for market in ["DE", "FR"]:
    src_tbl = f"RAW_{market}"
    tgt_tbl = f"CONTRACT_{market}"
    raw = spark.read.format("snowflake").options(**sf_options).option("dbtable", src_tbl).load()
    raw.write.format("snowflake").options(**sf_options).option("dbtable", tgt_tbl).save()
"""
        parsed = parse_glue_script(script)
        assert [r.table for r in parsed.snowflake_sources] == ["RAW_DE", "RAW_FR"]
        assert [r.table for r in parsed.snowflake_targets] == ["CONTRACT_DE", "CONTRACT_FR"]

        table_refs = {
            "RAW_DE": _make_table_ref("RAW_DE"),
            "RAW_FR": _make_table_ref("RAW_FR"),
            "CONTRACT_DE": _make_table_ref("CONTRACT_DE"),
            "CONTRACT_FR": _make_table_ref("CONTRACT_FR"),
        }
        workflow_details = {"Name": "loop_wf", "DefaultRunProperties": {}}
        glue_source.job_name_list = {"loop_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/loop_job.py"}}
        }
        glue_source.glue.get_workflow_runs.return_value = {"Runs": []}
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, table_refs):
            results = list(glue_source.yield_pipeline_lineage_details(workflow_details))

        edges = [r.right.edge for r in results]
        id_to_name = {model_str(ref.id): name for name, ref in table_refs.items()}
        pairs = {(id_to_name[model_str(e.fromEntity.id)], id_to_name[model_str(e.toEntity.id)]) for e in edges}
        assert pairs == {("RAW_DE", "CONTRACT_DE"), ("RAW_FR", "CONTRACT_FR")}


class TestParameterizedNonSnowflakeCalls:
    def test_parameterized_glue_context_catalog_options_and_jdbc_conf(self):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["db", "mkt", "conn"])
db = args["db"]
mkt = args["mkt"]
conn = args["conn"]

src1 = glueContext.create_dynamic_frame.from_catalog(database=db, table_name=f"raw_{mkt}")
src2 = glueContext.create_dynamic_frame.from_options(
    connection_type="s3",
    connection_options={"paths": [f"s3://lake-bucket/{mkt}/in/"]},
)
src3 = glueContext.create_dynamic_frame.from_options(
    connection_type="postgresql",
    connection_options={"dbtable": f"pg_src_{mkt}"},
    catalog_connection=conn,
)

glueContext.write_dynamic_frame.from_catalog(frame=src1, database=db, table_name=f"curated_{mkt}")
glueContext.purge_table(database=db, table_name=f"stage_{mkt}")
glueContext.write_dynamic_frame.from_options(
    frame=src2,
    connection_type="s3",
    connection_options={"path": f"s3://lake-bucket/{mkt}/out/"},
)
glueContext.write_dynamic_frame.from_options(
    frame=src3,
    connection_type="mysql",
    connection_options={"dbtable": f"mysql_tgt_{mkt}"},
    catalog_connection=conn,
)
glueContext.write_dynamic_frame.from_jdbc_conf(
    frame=src3,
    catalog_connection=conn,
    connection_options={"database": db, "dbtable": f"rs_tgt_{mkt}"},
)
"""
        ctx = ParameterContext.from_mappings(job_args={"--db": "analytics", "--mkt": "de", "--conn": "warehouse-conn"})
        result = parse_glue_script(script, context=ctx)

        assert result.catalog_sources == [CatalogRef(database="analytics", table="raw_de")]
        assert CatalogRef(database="analytics", table="curated_de") in result.catalog_targets
        assert CatalogRef(database="analytics", table="stage_de") in result.catalog_targets
        assert result.s3_sources == ["s3://lake-bucket/de/in/"]
        assert result.s3_targets == ["s3://lake-bucket/de/out/"]
        assert result.jdbc_sources == [JDBCRef(connection_name="warehouse-conn", table="pg_src_de")]
        assert JDBCRef(connection_name="warehouse-conn", table="mysql_tgt_de") in result.jdbc_targets
        assert JDBCRef(connection_name="warehouse-conn", database="analytics", table="rs_tgt_de") in result.jdbc_targets

    def test_parameterized_spark_read_and_write_calls(self):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["db", "mkt", "jdbc_url"])
db = args["db"]
mkt = args["mkt"]
url = args["jdbc_url"]

df1 = spark.read.parquet(f"s3://bucket/{mkt}/in/")
df2 = spark.read.format("parquet").load(f"s3://bucket/{mkt}/load/")
df3 = spark.read.jdbc(url, f"public.tbl_{mkt}")
df4 = spark.read.table(f"{db}.tbl_{mkt}")

df1.write.mode("overwrite").parquet(f"s3://bucket/{mkt}/out/")
df2.write.format("parquet").mode("append").save(f"s3://bucket/{mkt}/save/")
df3.write.jdbc(url, f"public.out_{mkt}")
df4.write.mode("overwrite").saveAsTable(f"{db}.out_{mkt}")
df4.write.insertInto(f"{db}.ins_{mkt}")
"""
        ctx = ParameterContext.from_mappings(
            job_args={
                "--db": "gold",
                "--mkt": "fr",
                "--jdbc_url": "jdbc:postgresql://db.internal:5432/appdb",
            }
        )
        result = parse_glue_script(script, context=ctx)

        assert result.s3_sources == ["s3://bucket/fr/in/", "s3://bucket/fr/load/"]
        assert result.s3_targets == ["s3://bucket/fr/out/", "s3://bucket/fr/save/"]
        assert result.jdbc_sources == [
            JDBCRef(jdbc_url="jdbc:postgresql://db.internal:5432/appdb", table="public.tbl_fr")
        ]
        assert result.jdbc_targets == [
            JDBCRef(jdbc_url="jdbc:postgresql://db.internal:5432/appdb", table="public.out_fr")
        ]
        assert result.catalog_sources == [CatalogRef(database="gold", table="tbl_fr")]
        assert result.catalog_targets == [
            CatalogRef(database="gold", table="out_fr"),
            CatalogRef(database="gold", table="ins_fr"),
        ]


class TestPrecedenceAndFallbacks:
    def test_precedence_job_defaults_trigger_args_and_job_run_args(self, glue_source: Any):
        script = """
import sys
import boto3
from awsglue.utils import getResolvedOptions

glue = boto3.client("glue")
args = getResolvedOptions(sys.argv, ["env", "tier", "region", "WORKFLOW_NAME", "WORKFLOW_RUN_ID"])
props = glue.get_workflow_run_properties(Name=args["WORKFLOW_NAME"], RunId=args["WORKFLOW_RUN_ID"])["RunProperties"]
tbl = f"{props['MARKET']}_{props['CHANNEL']}_{args['env']}_{args['tier']}_{args['region']}".upper()
df.write.format("snowflake").option("sfDatabase", "SALES_DB").option("sfSchema", "CURATED").option("dbtable", tbl).save()
"""
        expected_name = "FR_B2B_PROD_GOLD_EU"
        expected_ref = _make_table_ref(expected_name)

        workflow_details = {
            "Name": "prec_wf",
            "DefaultRunProperties": {"MARKET": "DE", "CHANNEL": "B2B"},
            "Graph": {
                "Nodes": [
                    {
                        "Type": "TRIGGER",
                        "Name": "start_trigger",
                        "TriggerDetails": {
                            "Trigger": {
                                "Name": "start_trigger",
                                "Actions": [
                                    {
                                        "JobName": "prec_job",
                                        "Arguments": {"--env": "staging", "--tier": "gold"},
                                    }
                                ],
                            }
                        },
                    },
                    {"Type": "JOB", "Name": "prec_job", "UniqueId": "j1"},
                ],
                "Edges": [],
            },
        }
        glue_source.job_name_list = {"prec_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {
                "Command": {"ScriptLocation": "s3://glue-scripts/prec.py"},
                "DefaultArguments": {"--env": "dev", "--tier": "silver", "--region": "eu"},
            }
        }
        glue_source.glue.get_workflow_runs.return_value = {
            "Runs": [
                {
                    "WorkflowRunId": "wr_1",
                    "WorkflowRunProperties": {"MARKET": "FR"},
                    "Graph": {
                        "Nodes": [
                            {
                                "Type": "JOB",
                                "Name": "prec_job",
                                "JobDetails": {
                                    "JobRuns": [
                                        {
                                            "Id": "jr_1",
                                            "TriggerName": "start_trigger",
                                            "Arguments": {"--env": "prod"},
                                        }
                                    ]
                                },
                            }
                        ]
                    },
                }
            ]
        }
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, {expected_name: expected_ref}):
            results = list(glue_source.yield_pipeline_lineage_details(workflow_details))

        assert len(results) == 1
        assert model_str(results[0].right.edge.toEntity.id) == model_str(expected_ref.id)

    def test_empty_runs_fall_back_to_default_arguments_and_default_run_properties(self, glue_source: Any):
        script = """
import sys
import boto3
from awsglue.utils import getResolvedOptions

glue = boto3.client("glue")
args = getResolvedOptions(sys.argv, ["env"])
props = glue.get_workflow_run_properties(Name="wf", RunId="r0")["RunProperties"]
df.write.format("snowflake").option("sfDatabase", "SALES_DB").option("sfSchema", "CURATED").option(
    "dbtable", f"CONTRACT_{props['MARKET']}_{args['env'].upper()}"
).save()
"""
        target_ref = _make_table_ref("CONTRACT_DE_DEV")
        workflow_details = {
            "Name": "never_ran_wf",
            "DefaultRunProperties": {"MARKET": "DE"},
            "Graph": {"Nodes": [{"Type": "JOB", "Name": "never_ran_job", "UniqueId": "j1"}], "Edges": []},
        }
        glue_source.job_name_list = {"never_ran_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {
                "Command": {"ScriptLocation": "s3://glue-scripts/never_ran.py"},
                "DefaultArguments": {"--env": "dev"},
            }
        }
        glue_source.glue.get_workflow_runs.return_value = {"Runs": []}
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, {"CONTRACT_DE_DEV": target_ref}):
            results = list(glue_source.yield_pipeline_lineage_details(workflow_details))

        assert len(results) == 1
        assert model_str(results[0].right.edge.toEntity.id) == model_str(target_ref.id)

    def test_missing_get_workflow_runs_permission_falls_back_to_last_run_and_defaults(
        self, glue_source: Any, caplog: pytest.LogCaptureFixture
    ):
        target_ref = _make_table_ref("CONTRACT_IT")
        workflow_details = {
            "Name": "restricted_wf",
            "DefaultRunProperties": {"MARKET": "DE"},
            "LastRun": {
                "WorkflowRunId": "wr_last",
                "WorkflowRunProperties": {"MARKET": "IT"},
            },
            "Graph": {"Nodes": [{"Type": "JOB", "Name": "restricted_job", "UniqueId": "j1"}], "Edges": []},
        }
        glue_source.job_name_list = {"restricted_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/restricted.py"}}
        }
        glue_source.glue.get_workflow_runs.side_effect = ClientError(
            {"Error": {"Code": "AccessDeniedException", "Message": "User is not authorized: glue:GetWorkflowRuns"}},
            "GetWorkflowRuns",
        )
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(ISSUE_37597_SCRIPT)

        with (
            _wire_table_catalog(glue_source, {"CONTRACT_IT": target_ref}),
            caplog.at_level(logging.DEBUG),
        ):
            results = list(glue_source.yield_pipeline_lineage_details(workflow_details))

        assert len(results) == 1
        assert model_str(results[0].right.edge.toEntity.id) == model_str(target_ref.id)
        debug_msgs = [rec.getMessage() for rec in caplog.records if rec.levelno == logging.DEBUG]
        assert any("AccessDeniedException" in msg or "workflow runs" in msg.lower() for msg in debug_msgs)


class TestSafetyAndBoundedResources:
    def test_partial_unknown_in_templates_emits_zero_refs(self):
        script = """
df.write.format("snowflake").option("dbtable", f"CONTRACT_{unknown_fn()}").save()
df.write.format("snowflake").option("dbtable", "CONTRACT_{}".format(unknown_fn())).save()
df.write.format("snowflake").option("dbtable", "CONTRACT_%s" % unknown_fn()).save()
df.write.format("snowflake").option("dbtable", "CONTRACT_" + unknown_fn()).save()
glueContext.write_dynamic_frame.from_catalog(frame=df, database="prod", table_name=f"orders_{unknown_fn()}")
df.write.parquet(f"s3://bucket/{unknown_fn()}/out/")
df.write.saveAsTable("analytics.orders_{market}".format(market=unknown_fn()))
"""
        ctx = ParameterContext.from_mappings(job_args={"--env": "prod"})
        result = parse_glue_script(script, context=ctx)

        assert not result.has_lineage

    def test_unparseable_script_regex_fallback_skips_template_placeholders(self):
        broken_script = """
df1 = spark.read.parquet("s3://bucket/valid_static/in/")
df2 = spark.read.parquet("s3://bucket/{market}/in/")
df3 = spark.read.table("analytics.CONTRACT_{market}")
df4 = spark.read.table("analytics.orders_%s")
df4.write.saveAsTable(
"""
        result = parse_glue_script(broken_script)

        assert result.s3_sources == ["s3://bucket/valid_static/in/"]
        assert result.catalog_sources == []

    def test_unknown_schema_with_resolved_parameterized_table_preserves_adr_2026_10_22(self):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["MARKET", "SCHEMA"])
sf = {"sfDatabase": "SALES_DB", "sfSchema": args["SCHEMA"]}
df.write.format("snowflake").options(**sf).option("dbtable", f"CONTRACT_{args['MARKET']}").save()
"""
        ctx = ParameterContext.from_mappings(job_args={"--MARKET": "DE"})
        _, targets = parse_snowflake_refs(script, context=ctx)

        assert targets == [SnowflakeRef(table="CONTRACT_DE", database="SALES_DB", schema=None)]

    def test_deeply_nested_expressions_and_huge_multiplications_return_safely(self):
        deep_concat = " + ".join(['"A"'] * (MAX_EXPR_DEPTH + 40))
        script = f"""
huge = "A" * (10 ** 9)
deep = {deep_concat}
df.write.format("snowflake").option("dbtable", huge).save()
df.write.format("snowflake").option("dbtable", f"PREFIX_{{huge}}").save()
df.write.format("snowflake").option("dbtable", deep).save()
"""
        result = parse_glue_script(script, context=ParameterContext())

        assert not result.has_lineage

    def test_inspected_runs_capped_and_caches_are_bounded_lru(self, glue_source: Any):
        assert isinstance(glue_source._glue_connection_cache, LRUCache)
        assert isinstance(glue_source._job_runs_cache, LRUCache)
        assert isinstance(glue_source._script_cache, LRUCache)

        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["idx"])
df.write.format("snowflake").option("sfDatabase", "SALES_DB").option("sfSchema", "CURATED").option(
    "dbtable", f"TBL_{args['idx']}"
).save()
"""
        all_refs = {f"TBL_{i}": _make_table_ref(f"TBL_{i}") for i in range(25)}
        now = datetime.datetime(2026, 11, 13, 7, 0, tzinfo=datetime.timezone.utc)
        job_runs = [
            {
                "Id": f"jr_{i}",
                "JobName": "capped_job",
                "JobRunState": "SUCCEEDED",
                "StartedOn": now,
                "CompletedOn": now,
                "Arguments": {"--idx": str(i)},
            }
            for i in range(25)
        ]
        workflow_details = {"Name": "capped_wf", "DefaultRunProperties": {}}
        glue_source.job_name_list = {"capped_job"}
        glue_source.glue.get_job.return_value = {"Job": {"Command": {"ScriptLocation": "s3://glue-scripts/capped.py"}}}
        glue_source.glue.get_workflow_runs.return_value = {"Runs": []}
        glue_source.glue.get_job_runs.return_value = {"JobRuns": job_runs}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, all_refs):
            statuses = list(glue_source.yield_pipeline_status(workflow_details))
            results = list(glue_source.yield_pipeline_lineage_details(workflow_details))

        assert len(statuses) == 25
        assert len(results) == MAX_INSPECTED_RUNS == 10
        # Shared _job_runs_cache avoids a second get_job_runs call during lineage
        glue_source.glue.get_job_runs.assert_called_once_with(JobName="capped_job")


class TestExtendedCoverageAndEdgeCases:
    def test_loop_sequence_forms_nested_loops_sibling_loops_and_unroll_cap(self):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["markets_csv", "spaced"])
markets_tuple = ("DE", "FR")
env_map = {"prod": "CURATED", "dev": "SANDBOX"}

for m in markets_tuple:
    spark.read.format("snowflake").option("dbtable", f"TUP_{m}").load()

for env_key in env_map:
    spark.read.format("snowflake").option("dbtable", f"KEY_{env_key.upper()}").load()

for schema_val in env_map.values():
    spark.read.format("snowflake").option("dbtable", f"VAL_{schema_val}").load()

for k2 in env_map.keys():
    spark.read.format("snowflake").option("dbtable", f"KEYS_{k2.upper()}").load()

for part in args["markets_csv"].split(",", 1):
    df.write.format("snowflake").option("dbtable", f"SPLIT_{part}").save()

for word in args["spaced"].split():
    df.write.format("snowflake").option("dbtable", f"WORD_{word}").save()
"""
        ctx = ParameterContext.from_mappings(job_args={"--markets-csv": "ES,IT,PT", "--spaced": "NORTH SOUTH"})
        slices = parse_glue_script_slices(script, context=ctx)
        combined = parse_glue_script(script, context=ctx)

        assert len(slices) == 12
        assert [r.table for r in combined.snowflake_sources] == [
            "TUP_DE",
            "TUP_FR",
            "KEY_PROD",
            "KEY_DEV",
            "VAL_CURATED",
            "VAL_SANDBOX",
            "KEYS_PROD",
            "KEYS_DEV",
        ]
        assert [r.table for r in combined.snowflake_targets] == [
            "SPLIT_ES",
            "SPLIT_IT,PT",
            "WORD_NORTH",
            "WORD_SOUTH",
        ]

        nested_script = """
for env in ["DEV", "PROD"]:
    for mkt in ["DE", "FR"]:
        df.write.format("snowflake").option("dbtable", f"{env}_{mkt}").save()
"""
        _, nested_targets = parse_snowflake_refs(nested_script)
        assert [r.table for r in nested_targets] == ["DEV_DE", "DEV_FR", "PROD_DE", "PROD_FR"]

        assert MAX_LOOP_UNROLLS == 32
        items_32 = ", ".join(f'"M{i}"' for i in range(32))
        script_32 = f"""
for mkt in [{items_32}]:
    df.write.format("snowflake").option("dbtable", f"CAP_{{mkt}}").save()
"""
        _, targets_32 = parse_snowflake_refs(script_32)
        assert [r.table for r in targets_32] == [f"CAP_M{i}" for i in range(32)]

        items_33 = ", ".join(f'"M{i}"' for i in range(33))
        script_33 = f"""
for mkt in [{items_33}]:
    df.write.format("snowflake").option("dbtable", f"CAP_{{mkt}}").save()
"""
        assert parse_snowflake_refs(script_33) == ([], [])

    def test_advanced_string_dict_and_branch_expressions(self):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["idx"])
parts = ("SALES", "EU")
idx = 7
first_part = parts[0]
base_opts = {"sfDatabase": "FINANCE"}
extra_opts = {"sfSchema": "PUBLIC"}
merged_opts = dict(base_opts, **extra_opts, dbtable="{}_{}_{:02d}".format(*parts, idx))

if unknown_cond():
    branch_opts = {"sfDatabase": "FINANCE", "sfSchema": "AGREED"}
else:
    branch_opts = {"sfDatabase": "FINANCE", "sfSchema": "OTHER"}

replaced = "RAW__DE__OLD".replace("__", "_", 1)
spark.read.format("snowflake").options(**merged_opts).load()
df.write.format("snowflake").options(**branch_opts).option("dbtable", f"{first_part}_{replaced}_{idx:02d}").save()
"""
        ctx = ParameterContext.from_mappings(job_args={"--idx": "7"})
        sources, targets = parse_snowflake_refs(script, context=ctx)

        assert sources == [SnowflakeRef(table="SALES_EU_07", database="FINANCE", schema="PUBLIC")]
        assert targets == [SnowflakeRef(table="SALES_RAW_DE__OLD_07", database="FINANCE", schema=None)]

    def test_spark_and_glue_options_variants_in_ast_and_empty_inputs(self):
        assert not parse_glue_script(None).has_lineage
        assert parse_glue_script_slices(None) == []
        assert parse_glue_script_slices("x = 1\n") == []

        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["mkt", "db"])
mkt = args["mkt"]
db = args["db"]

df0 = spark.table(f"AwsDataCatalog.{db}.orders_{mkt}")
df1 = spark.read.format("jdbc").option("url", "jdbc:postgresql://host:5432/appdb").option(
    "dbtable", f"public.src_{mkt}"
).load()
df2 = spark.read.load(path=f"s3://lake/{mkt}/landing/", format="parquet")
df3 = glueContext.create_dynamic_frame.from_options(
    connection_type="s3",
    connection_options={"paths": [f"s3://lake/{mkt}/p1/", f"s3://lake/{mkt}/p2/"]},
)
df4 = glueContext.create_dynamic_frame.from_options(
    connection_type="dynamodb",
    connection_options={"dynamodb.input.tableName": f"ddb_{mkt}"},
)
df1.write.format("jdbc").options(url="jdbc:postgresql://host:5432/appdb", dbtable=f"public.tgt_{mkt}").save()
df2.write.jdbc("jdbc:postgresql://host:5432/appdb", f"public.direct_{mkt}")
df3.write.option("path", f"s3://lake/{mkt}/curated/").save()
"""
        ctx = ParameterContext.from_mappings(job_args={"--mkt": "nl", "--db": "bronze"})
        result = parse_glue_script(script, context=ctx)

        assert result.catalog_sources == [CatalogRef(database="bronze", table="orders_nl")]
        assert result.jdbc_sources == [
            JDBCRef(jdbc_url="jdbc:postgresql://host:5432/appdb", table="public.src_nl"),
            JDBCRef(table="ddb_nl"),
        ]
        assert result.jdbc_targets == [
            JDBCRef(jdbc_url="jdbc:postgresql://host:5432/appdb", table="public.tgt_nl"),
            JDBCRef(jdbc_url="jdbc:postgresql://host:5432/appdb", table="public.direct_nl"),
        ]
        assert result.s3_sources == [
            "s3://lake/nl/landing/",
            "s3://lake/nl/p1/",
            "s3://lake/nl/p2/",
        ]
        assert result.s3_targets == ["s3://lake/nl/curated/"]

    def test_scala_unparseable_script_regex_fallback_extracts_static_and_skips_templates(self):
        scala_script = """
object GlueApp {
  val src0 = glueContext.create_dynamic_frame.from_catalog(database = "raw_db", table_name = "events")
  val srcSkip = glueContext.create_dynamic_frame.from_catalog(database = "raw_db", table_name = "$dynamicTbl")
  val src1 = glueContext.create_dynamic_frame.from_options(connection_type = "s3", connection_options = Map("path" -> "s3://scala-bucket/in/", "bad" -> "s3://scala-bucket/$env/in/"))
  val srcSf = glueContext.create_dynamic_frame.from_options(connection_type = "snowflake", connection_options = Map("dbtable" -> "SF_IGNORED"))
  val srcJdbc = glueContext.create_dynamic_frame.from_options(connection_type = "postgresql", connection_options = {"dbtable": "public.scala_in"}, catalog_connection = "pg-conn")
  val outJdbcConf = glueContext.write_dynamic_frame.from_jdbc_conf(frame = src0, catalog_connection = "pg-conn", connection_options = {"dbtable": "public.conf_out", "database": "appdb"})
  val outS3 = glueContext.write_dynamic_frame.from_options(frame = src0, connection_type = "s3", connection_options = {"path": "s3://scala-bucket/out/"})
  val outSf = glueContext.write_dynamic_frame.from_options(frame = src0, connection_type = "snowflake", connection_options = {"dbtable": "SF_OUT_IGNORED"})
  val outJdbc = glueContext.write_dynamic_frame.from_options(frame = src0, connection_type = "mysql", connection_options = {"dbtable": "scala_mysql_out"}, catalog_connection = "mysql-conn")
  glueContext.write_dynamic_frame.from_catalog(frame = src0, database = "gold_db", table_name = "events_curated")
  glueContext.purge_table(database = "gold_db", table_name = "events_staging")
  val rj = spark.read.jdbc("jdbc:postgresql://db:5432/app", "public.read_j")
  val rt = spark.read.table("gold_db.read_tbl")
  df.write.parquet("s3://scala-bucket/parquet_out/")
  df.write.jdbc("jdbc:postgresql://db:5432/app", "public.write_j")
  df.write.saveAsTable("gold_db.saved_tbl")
  df.write.insertInto("gold_db.inserted_tbl")
  df.write.saveAsTable("gold_db.bad_{market}")
}
"""
        slices = parse_glue_script_slices(scala_script)
        assert len(slices) == 1
        res = slices[0]
        assert res.catalog_sources == [
            CatalogRef(database="raw_db", table="events"),
            CatalogRef(database="gold_db", table="read_tbl"),
        ]
        assert res.catalog_targets == [
            CatalogRef(database="gold_db", table="events_curated"),
            CatalogRef(database="gold_db", table="events_staging"),
            CatalogRef(database="gold_db", table="saved_tbl"),
            CatalogRef(database="gold_db", table="inserted_tbl"),
        ]
        assert res.s3_sources == ["s3://scala-bucket/in/"]
        assert res.s3_targets == ["s3://scala-bucket/out/", "s3://scala-bucket/parquet_out/"]
        assert res.jdbc_sources == [
            JDBCRef(connection_name="pg-conn", table="public.scala_in"),
            JDBCRef(jdbc_url="jdbc:postgresql://db:5432/app", table="public.read_j"),
        ]
        assert res.jdbc_targets == [
            JDBCRef(connection_name="pg-conn", database="appdb", table="public.conf_out"),
            JDBCRef(connection_name="mysql-conn", table="scala_mysql_out"),
            JDBCRef(jdbc_url="jdbc:postgresql://db:5432/app", table="public.write_j"),
        ]

    def test_glue_source_end_to_end_helpers_and_error_paths(self, glue_source: Any):
        glue_source.glue.list_workflows.return_value = {"Workflows": ["wf_a"]}
        glue_source.glue.get_workflow.return_value = {"Workflow": {"Name": "wf_a", "Graph": {"Nodes": [], "Edges": []}}}
        assert list(glue_source.get_pipelines_list()) == [{"Name": "wf_a", "Graph": {"Nodes": [], "Edges": []}}]

        # Correlation via --WORKFLOW_RUN_ID in get_job_runs + get_lineage_details aggregation
        de_ref = _make_table_ref("CONTRACT_DE")
        fr_ref = _make_table_ref("CONTRACT_FR")
        workflow_details = {"Name": "market_workflow", "DefaultRunProperties": {}}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/by_wfrun.py"}}
        }
        glue_source.glue.get_workflow_runs.return_value = {
            "Runs": [
                {"WorkflowRunId": "wr_de", "WorkflowRunProperties": {"MARKET": "DE"}},
                {"WorkflowRunId": "wr_fr", "WorkflowRunProperties": {"MARKET": "FR"}},
            ]
        }
        glue_source.glue.get_job_runs.return_value = {
            "JobRuns": [
                {"Id": "jr_de", "Arguments": {"--WORKFLOW_RUN_ID": "wr_de"}},
                {"Id": "jr_fr", "Arguments": {"--WORKFLOW_RUN_ID": "wr_fr"}},
            ]
        }
        glue_source._s3_client.get_object.return_value = _mock_s3_body(ISSUE_37597_SCRIPT)

        with _wire_table_catalog(glue_source, {"CONTRACT_DE": de_ref, "CONTRACT_FR": fr_ref}):
            agg = glue_source.get_lineage_details("correlate_job", workflow_details)

        assert agg["sources"] == []
        assert [r.name for r in agg["targets"]] == ["CONTRACT_DE", "CONTRACT_FR"]

        # Glue connection cache (hit + error) & S3 invalid URI / download failure caching
        glue_source.glue.get_connection.return_value = {
            "Connection": {"ConnectionProperties": {"JDBC_CONNECTION_URL": "jdbc:postgresql://host:5432/analytics"}}
        }
        assert glue_source._resolve_glue_connection("pg-analytics") == {"database": "analytics", "schema": None}
        assert glue_source._resolve_glue_connection("pg-analytics") == {"database": "analytics", "schema": None}
        glue_source.glue.get_connection.assert_called_once()

        # Visual ETL (Catalog + S3Source + S3Target + JDBCConnectorTarget) via get_lineage_details
        s3_in_container = MagicMock()
        s3_in_container.id = Uuid(uuid4())
        s3_in_container.name = "raw_landing"
        s3_in_container.fullyQualifiedName = "s3_prod.lake.raw_landing"
        glue_source.metadata.es_search_container_by_path.return_value = [s3_in_container]
        visual_cat_ref = _make_table_ref("cat_orders")
        visual_jdbc_ref = _make_table_ref("jdbc_orders")
        glue_source.glue.get_job.return_value = {
            "Job": {
                "CodeGenConfigurationNodes": {
                    "n1": {"GlueCatalogSource": {"Name": "cat_in", "Database": "raw_db", "Table": "cat_orders"}},
                    "n2": {"S3ParquetSource": {"Name": "s3_in", "Paths": ["s3://lake/raw_landing"]}},
                    "n3": {"S3DirectTarget": {"Name": "s3_out", "Path": "s3://lake/curated_out"}},
                    "n4": {"JDBCConnectorTarget": {"Name": "jdbc_out", "ConnectionTable": "jdbc_orders"}},
                }
            }
        }
        with _wire_table_catalog(glue_source, {"cat_orders": visual_cat_ref, "jdbc_orders": visual_jdbc_ref}):
            visual_lineage = glue_source.get_lineage_details("visual_job")
        assert len(visual_lineage["sources"]) == 2
        assert len(visual_lineage["targets"]) == 2

        glue_source.glue.get_connection.side_effect = RuntimeError("conn boom")
        assert glue_source._resolve_glue_connection("broken-conn") is None
        assert glue_source._download_s3_script("s3://bucket-only") is None
        glue_source._s3_client.get_object.side_effect = RuntimeError("s3 boom")
        assert glue_source._download_s3_script("s3://glue-scripts/missing.py") is None

        # Status & lineage graceful error Either.left paths
        glue_source.job_name_list = {"err_job"}
        glue_source._job_runs_cache.clear()
        glue_source.glue.get_job_runs.side_effect = RuntimeError("runs boom")
        status_res = list(glue_source.yield_pipeline_status(workflow_details))
        assert len(status_res) == 1 and status_res[0].left is not None

        glue_source.metadata.get_by_name.side_effect = RuntimeError("ometa boom")
        lineage_err = list(glue_source.yield_pipeline_lineage_details(workflow_details))
        assert len(lineage_err) == 1 and lineage_err[0].left is not None

    def test_end_to_end_parameterized_s3_catalog_and_jdbc_script_lineage(self, glue_source: Any):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["market", "db"])
mkt = args["market"]
db = args["db"]
s3_df = spark.read.parquet(f"s3://lake/{mkt}/in/")
cat_df = glueContext.create_dynamic_frame.from_catalog(database=db, table_name=f"orders_{mkt}")
glueContext.write_dynamic_frame.from_jdbc_conf(
    frame=cat_df,
    catalog_connection="pg-analytics",
    connection_options={"dbtable": f"summary_{mkt}"},
)
s3_df.write.jdbc("jdbc:postgresql://host:5432/analytics", f"audit_{mkt}")
"""
        workflow_details = {
            "Name": "market_workflow",
            "DefaultRunProperties": {},
            "Graph": {
                "Nodes": [
                    {"Type": "TRIGGER", "Name": "t1", "UniqueId": "u_t1"},
                    {"Type": "JOB", "Name": "polyglot_job", "UniqueId": "u_j1"},
                ],
                "Edges": [{"SourceId": "u_t1", "DestinationId": "u_j1"}],
            },
        }
        assert glue_source.get_pipeline_name(workflow_details) == "market_workflow"
        created_pipelines = list(glue_source.yield_pipeline(workflow_details))
        assert len(created_pipelines) == 1 and created_pipelines[0].right is not None

        s3_container = MagicMock()
        s3_container.id = Uuid(uuid4())
        s3_container.name = "de_in"
        s3_container.fullyQualifiedName = "s3_prod.lake.de.in"
        glue_source.metadata.es_search_container_by_path.side_effect = [[], [s3_container]]

        orders_ref = _make_table_ref("orders_de")
        summary_ref = _make_table_ref("summary_de")
        audit_ref = _make_table_ref("audit_de")
        glue_source.glue.get_connection.return_value = {
            "Connection": {"ConnectionProperties": {"JDBC_CONNECTION_URL": "jdbc:postgresql://host:5432/analytics"}}
        }
        glue_source.glue.get_job.return_value = {
            "Job": {
                "Command": {"ScriptLocation": "s3://glue-scripts/polyglot.py"},
                "DefaultArguments": {"--market": "de", "--db": "bronze"},
            }
        }
        glue_source.glue.get_workflow_runs.return_value = {"Runs": []}
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(
            glue_source,
            {"orders_de": orders_ref, "summary_de": summary_ref, "audit_de": audit_ref},
        ):
            edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right]

        # 2 sources (s3_container, orders_de) x 2 targets (summary_de, audit_de) = 4 correlated edges
        assert len(edges) == 4
        # Cached script reused on second call
        assert glue_source._download_s3_script("s3://glue-scripts/polyglot.py") == script


class TestAuditReviewRegressions:
    def test_shared_job_across_workflows_isolates_runs_and_aged_out_workflow_runs(self, glue_source: Any):
        script = """
import sys
import boto3
from awsglue.utils import getResolvedOptions

glue = boto3.client("glue")
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
args = getResolvedOptions(sys.argv, ["MARKET", "WORKFLOW_NAME", "WORKFLOW_RUN_ID"])
props = glue.get_workflow_run_properties(
    Name=args.get("WORKFLOW_NAME", "wf"),
    RunId=args.get("WORKFLOW_RUN_ID", "r0"),
)["RunProperties"]

df.write.format("snowflake").options(**sf_options).option("dbtable", f"JOB_{args['MARKET']}").save()
df.write.format("snowflake").options(**sf_options).option("dbtable", f"PROP_{props.get('PROP_MKT', 'FALLBACK')}").save()
"""
        table_refs = {
            name: _make_table_ref(name)
            for name in ("JOB_DE", "JOB_US", "JOB_APAC", "PROP_EU_LIVE", "PROP_DEFAULT_LEAK", "PROP_FALLBACK")
        }
        workflow_details = {
            "Name": "wf_eu",
            "DefaultRunProperties": {"PROP_MKT": "DEFAULT_LEAK"},
            "Graph": {
                "Nodes": [
                    {
                        "Type": "TRIGGER",
                        "Name": "trig_eu",
                        "TriggerDetails": {
                            "Trigger": {
                                "Name": "trig_eu",
                                "Actions": [{"JobName": "shared_job", "Arguments": {}}],
                            }
                        },
                    },
                    {"Type": "JOB", "Name": "shared_job", "UniqueId": "j1"},
                ],
                "Edges": [],
            },
        }
        glue_source.job_name_list = {"shared_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/shared_job.py"}}
        }
        glue_source.glue.get_workflow_runs.return_value = {
            "Runs": [
                {
                    "WorkflowRunId": "wr_eu_live",
                    "WorkflowRunProperties": {"PROP_MKT": "EU_LIVE"},
                    "Graph": {
                        "Nodes": [
                            {
                                "Type": "JOB",
                                "Name": "shared_job",
                                "JobDetails": {
                                    "JobRuns": [
                                        {
                                            "Id": "jr_eu_live",
                                            "TriggerName": "trig_eu",
                                            "Arguments": {
                                                "--WORKFLOW_NAME": "wf_eu",
                                                "--WORKFLOW_RUN_ID": "wr_eu_live",
                                                "--MARKET": "DE",
                                            },
                                        }
                                    ]
                                },
                            }
                        ]
                    },
                }
            ]
        }
        glue_source.glue.get_job_runs.return_value = {
            "JobRuns": [
                {
                    "Id": "jr_us_other_wf",
                    "TriggerName": "trig_us",
                    "Arguments": {
                        "--WORKFLOW_NAME": "wf_us",
                        "--WORKFLOW_RUN_ID": "wr_us_1",
                        "--MARKET": "US",
                    },
                },
                {
                    "Id": "jr_other_trigger",
                    "TriggerName": "external_schedule_trigger",
                    "Arguments": {"--MARKET": "APAC"},
                },
                {
                    "Id": "jr_eu_aged_out",
                    "TriggerName": "trig_eu",
                    "Arguments": {
                        "--WORKFLOW_NAME": "wf_eu",
                        "--WORKFLOW_RUN_ID": "wr_eu_aged_out",
                        "--MARKET": "DE",
                    },
                },
            ]
        }
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, table_refs):
            edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right]

        id_to_name = {model_str(ref.id): name for name, ref in table_refs.items()}
        emitted_targets = {id_to_name[model_str(e.toEntity.id)] for e in edges}
        assert emitted_targets == {"JOB_DE", "PROP_EU_LIVE"}

    def test_multiple_triggers_in_same_workflow_do_not_cross_merge_arguments(self, glue_source: Any):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["MARKET", "BATCH"])
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
df.write.format("snowflake").options(**sf_options).option(
    "dbtable", f"CONTRACT_{args['MARKET']}_{args['BATCH']}"
).save()
"""
        table_refs = {
            name: _make_table_ref(name)
            for name in ("CONTRACT_DE_1", "CONTRACT_FR_0", "CONTRACT_FR_1", "CONTRACT_IT_0", "CONTRACT_IT_1")
        }
        workflow_details = {
            "Name": "multi_trig_wf",
            "DefaultRunProperties": {},
            "Graph": {
                "Nodes": [
                    {
                        "Type": "TRIGGER",
                        "Name": "trig_de",
                        "TriggerDetails": {
                            "Trigger": {
                                "Name": "trig_de",
                                "Actions": [
                                    {"JobName": "multi_trig_job", "Arguments": {"--MARKET": "DE", "--BATCH": "1"}}
                                ],
                            }
                        },
                    },
                    {
                        "Type": "TRIGGER",
                        "Name": "trig_fr",
                        "TriggerDetails": {
                            "Trigger": {
                                "Name": "trig_fr",
                                "Actions": [{"JobName": "multi_trig_job", "Arguments": {"--MARKET": "FR"}}],
                            }
                        },
                    },
                    {"Type": "JOB", "Name": "multi_trig_job", "UniqueId": "j1"},
                ],
                "Edges": [],
            },
        }
        glue_source.job_name_list = {"multi_trig_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {
                "Command": {"ScriptLocation": "s3://glue-scripts/multi_trig.py"},
                "DefaultArguments": {"--BATCH": "0"},
            }
        }
        glue_source.glue.get_workflow_runs.return_value = {"Runs": []}
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, table_refs):
            edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right]

        id_to_name = {model_str(ref.id): name for name, ref in table_refs.items()}
        assert {id_to_name[model_str(e.toEntity.id)] for e in edges} == {"CONTRACT_DE_1", "CONTRACT_FR_0"}

        # A JobRun with no TriggerName must not inherit --BATCH=1 from trig_de
        glue_source._job_runs_cache.clear()
        glue_source.glue.get_job_runs.return_value = {
            "JobRuns": [{"Id": "jr_manual", "Arguments": {"--WORKFLOW_NAME": "multi_trig_wf", "--MARKET": "IT"}}]
        }
        with _wire_table_catalog(glue_source, table_refs):
            edges_with_jr = [
                r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right
            ]
        assert {id_to_name[model_str(e.toEntity.id)] for e in edges_with_jr} == {"CONTRACT_IT_0"}

    def test_access_denied_on_workflow_runs_or_job_runs_marks_context_opaque(self, glue_source: Any):
        script = """
import sys
import boto3
from awsglue.utils import getResolvedOptions

glue = boto3.client("glue")
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
args = getResolvedOptions(sys.argv, ["MARKET"])
props = glue.get_workflow_run_properties(Name="wf", RunId="r0")["RunProperties"]

df.write.format("snowflake").options(**sf_options).option("dbtable", f"PROP_{props.get('MARKET', 'US')}").save()
df.write.format("snowflake").options(**sf_options).option("dbtable", f"ARG_{args.get('MARKET', 'SANDBOX')}").save()
"""
        table_refs = {name: _make_table_ref(name) for name in ("PROP_US", "PROP_DE", "ARG_SANDBOX", "ARG_FR")}
        access_denied = ClientError(
            {"Error": {"Code": "AccessDeniedException", "Message": "Access denied"}},
            "GlueRead",
        )
        glue_source.job_name_list = {"opaque_job"}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        # Empty DefaultRunProperties & DefaultArguments + AccessDenied -> zero fabricated defaults
        workflow_empty = {"Name": "opaque_wf", "DefaultRunProperties": {}}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/opaque.py"}, "DefaultArguments": {}}
        }
        glue_source.glue.get_workflow_runs.side_effect = access_denied
        glue_source.glue.get_job_runs.side_effect = access_denied

        with _wire_table_catalog(glue_source, table_refs):
            empty_edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_empty) if r.right]
        assert empty_edges == []

        # Explicit keys in DefaultRunProperties / DefaultArguments still resolve despite AccessDenied
        workflow_explicit = {"Name": "opaque_wf", "DefaultRunProperties": {"MARKET": "DE"}}
        glue_source.glue.get_job.return_value = {
            "Job": {
                "Command": {"ScriptLocation": "s3://glue-scripts/opaque.py"},
                "DefaultArguments": {"--MARKET": "FR"},
            }
        }
        with _wire_table_catalog(glue_source, table_refs):
            explicit_edges = [
                r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_explicit) if r.right
            ]
        id_to_name = {model_str(ref.id): name for name, ref in table_refs.items()}
        assert {id_to_name[model_str(e.toEntity.id)] for e in explicit_edges} == {"PROP_DE", "ARG_FR"}

    def test_non_io_helper_for_loop_and_unknown_sibling_loop_do_not_emit_false_edges(self, glue_source: Any):
        helper_cols = ", ".join(f'"col_{i}"' for i in range(20))
        script_with_helper_and_unknown_siblings = f"""
sf_options = {{"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}}
df = spark.read.format("snowflake").options(**sf_options).option("dbtable", "RAW_GLOBAL").load()

for col in [{helper_cols}]:
    df = df.withColumnRenamed(col, col.upper())

for mkt in ["DE", "FR"]:
    df.write.format("snowflake").options(**sf_options).option("dbtable", f"CONTRACT_{{mkt}}").save()

for dyn_mkt in dynamic_markets():
    df.write.format("snowflake").options(**sf_options).option("dbtable", f"OTHER_{{dyn_mkt}}").save()

for bad_mkt in ["X", "Y"]:
    df.write.format("snowflake").options(**sf_options).option("dbtable", f"BAD_{{unknown_fn(bad_mkt)}}").save()
"""
        table_refs = {
            "RAW_GLOBAL": _make_table_ref("RAW_GLOBAL"),
            "CONTRACT_DE": _make_table_ref("CONTRACT_DE"),
            "CONTRACT_FR": _make_table_ref("CONTRACT_FR"),
        }
        workflow_details = {"Name": "helper_loop_wf", "DefaultRunProperties": {}}
        glue_source.job_name_list = {"helper_loop_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/helper_loop.py"}}
        }
        glue_source.glue.get_workflow_runs.return_value = {"Runs": []}
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script_with_helper_and_unknown_siblings)

        with _wire_table_catalog(glue_source, table_refs):
            edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right]

        name_by_id = {model_str(ref.id): name for name, ref in table_refs.items()}
        name_by_id[PIPELINE_UUID] = "PIPELINE"
        pairs = {(name_by_id[model_str(e.fromEntity.id)], name_by_id[model_str(e.toEntity.id)]) for e in edges}
        assert pairs == {("RAW_GLOBAL", "CONTRACT_DE"), ("RAW_GLOBAL", "CONTRACT_FR")}

    def test_two_sided_incomplete_or_ambiguous_slices_skip_and_one_sided_dedups_linked_tables(self, glue_source: Any):
        ambiguous_script = """
sf_db = {"sfDatabase": "SALES_DB"}
df = spark.read.format("snowflake").options(**sf_db).option("dbtable", "ORDERS").load()
df.write.format("snowflake").option("sfDatabase", "SALES_DB").option("sfSchema", "CURATED").option(
    "dbtable", "CONTRACT_DE"
).save()
"""
        contract_de = _make_table_ref("CONTRACT_DE")
        orders_raw = _make_table_ref("ORDERS")
        orders_archive = _make_table_ref("ORDERS")

        def ambiguous_fqn_build(**kwargs: Any) -> Any:
            if kwargs.get("entity_type") is Pipeline:
                return f"{kwargs['service_name']}.{kwargs['pipeline_name']}"
            if kwargs.get("table_name") == "ORDERS":
                return ["snowflake_prod.SALES_DB.RAW.ORDERS", "snowflake_prod.SALES_DB.ARCHIVE.ORDERS"]
            if kwargs.get("table_name") == "CONTRACT_DE":
                return ["snowflake_prod.SALES_DB.CURATED.CONTRACT_DE"]
            return []

        fqn_map = {
            "snowflake_prod.SALES_DB.RAW.ORDERS": orders_raw,
            "snowflake_prod.SALES_DB.ARCHIVE.ORDERS": orders_archive,
            "snowflake_prod.SALES_DB.CURATED.CONTRACT_DE": contract_de,
        }
        glue_source.metadata.get_entity_reference.side_effect = lambda entity, fqn: fqn_map.get(fqn)
        workflow_details = {"Name": "two_sided_wf", "DefaultRunProperties": {}}
        glue_source.job_name_list = {"ambig_job"}
        glue_source.glue.get_job.return_value = {"Job": {"Command": {"ScriptLocation": "s3://glue-scripts/ambig.py"}}}
        glue_source.glue.get_workflow_runs.return_value = {"Runs": []}
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(ambiguous_script)

        with patch(
            "metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build", side_effect=ambiguous_fqn_build
        ):
            ambig_edges = [
                r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right
            ]
        assert ambig_edges == []

        # Unknown upstream read + resolved downstream write -> zero edges (never Pipeline -> CONTRACT_DE)
        unknown_read_script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
df = spark.read.format("snowflake").options(**sf_options).option("dbtable", f"RAW_{unknown_fn()}").load()
df.write.format("snowflake").options(**sf_options).option("dbtable", "CONTRACT_DE").save()
"""
        glue_source._s3_client.get_object.return_value = _mock_s3_body(unknown_read_script)
        with _wire_table_catalog(glue_source, {"CONTRACT_DE": contract_de}):
            unknown_src_edges = [
                r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right
            ]
        assert unknown_src_edges == []

        # Workflow with one-sided QC/seed jobs + two-sided ETL job + self-referencing table -> only RAW_DE -> CONTRACT_DE
        raw_de = _make_table_ref("RAW_DE")
        scripts_by_uri = {
            "s3://glue-scripts/0_seed.py": """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
df.write.format("snowflake").options(**sf_options).option("dbtable", "CONTRACT_DE").save()
""",
            "s3://glue-scripts/1_etl.py": """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
df = spark.read.format("snowflake").options(**sf_options).option("dbtable", "RAW_DE").load()
df.write.format("snowflake").options(**sf_options).option("dbtable", "CONTRACT_DE").save()
df.write.format("snowflake").options(**sf_options).option("dbtable", "RAW_DE").save()
""",
            "s3://glue-scripts/2_qc.py": """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
spark.read.format("snowflake").options(**sf_options).option("dbtable", "RAW_DE").load()
""",
        }
        jobs_map = {
            "job_0_seed": "s3://glue-scripts/0_seed.py",
            "job_1_etl": "s3://glue-scripts/1_etl.py",
            "job_2_qc": "s3://glue-scripts/2_qc.py",
        }
        glue_source.job_name_list = set(jobs_map)
        glue_source.glue.get_job.side_effect = lambda JobName: {  # noqa: N803
            "Job": {"Command": {"ScriptLocation": jobs_map[JobName]}}
        }
        glue_source._s3_client.get_object.side_effect = lambda Bucket, Key: _mock_s3_body(  # noqa: N803
            scripts_by_uri[f"s3://{Bucket}/{Key}"]
        )

        with _wire_table_catalog(glue_source, {"RAW_DE": raw_de, "CONTRACT_DE": contract_de}):
            multi_job_edges = [
                r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right
            ]

        assert len(multi_job_edges) == 1
        assert model_str(multi_job_edges[0].fromEntity.id) == model_str(raw_de.id)
        assert model_str(multi_job_edges[0].toEntity.id) == model_str(contract_de.id)

    def test_spark_chain_options_opaque_unpack_clears_prior_options_and_keeps_later_options(self):
        stale_script = """
df.write.format("jdbc").option("url", "jdbc:postgresql://host:5432/appdb").option(
    "dbtable", "public.old"
).options(**unknown_fn()).save()
"""
        assert parse_glue_script(stale_script).jdbc_targets == []

        override_script = """
df.write.format("jdbc").options(**unknown_fn()).option(
    "url", "jdbc:postgresql://host:5432/appdb"
).option("dbtable", "public.final").save()
"""
        assert parse_glue_script(override_script).jdbc_targets == [
            JDBCRef(jdbc_url="jdbc:postgresql://host:5432/appdb", table="public.final")
        ]

    def test_percent_d_formatting_positional_and_named_dict(self):
        script = """
spark.read.format("snowflake").option("dbtable", "ORDERS_%d" % 5).load()
df.write.format("snowflake").option("dbtable", "ORDERS_%(idx)d" % {"idx": 5}).save()
"""
        sources, targets = parse_snowflake_refs(script)
        assert sources == [SnowflakeRef(table="ORDERS_5")]
        assert targets == [SnowflakeRef(table="ORDERS_5")]

    def test_case_insensitive_snowflake_options_merge_across_branches(self):
        script = """
CASE_SENSITIVE_MAP = {"DE": "GERMANY", "de": "lower_de"}
if unknown_cond():
    opts = {"sfSchema": "RAW", "sfDatabase": "DB1"}
else:
    opts = {"sfschema": "RAW", "sfDatabase": "DB2"}

df.write.format("snowflake").options(**opts).option("dbtable", f"T_{CASE_SENSITIVE_MAP['DE']}").save()
"""
        _, targets = parse_snowflake_refs(script)
        assert targets == [SnowflakeRef(table="T_GERMANY", database=None, schema="RAW")]

    def test_extract_script_lineage_deduplicates_top_level_source_across_loop_slices(self, glue_source: Any):
        script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
df = spark.read.format("snowflake").options(**sf_options).option("dbtable", "RAW_GLOBAL").load()
for mkt in ["DE", "ES", "FR", "IT"]:
    df.write.format("snowflake").options(**sf_options).option("dbtable", f"CONTRACT_{mkt}").save()
"""
        table_refs = {
            name: _make_table_ref(name)
            for name in ("RAW_GLOBAL", "CONTRACT_DE", "CONTRACT_ES", "CONTRACT_FR", "CONTRACT_IT")
        }
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)
        lineage_details: dict[str, list[EntityReference]] = {"sources": [], "targets": []}

        with _wire_table_catalog(glue_source, table_refs):
            glue_source._extract_script_lineage("s3://glue-scripts/dedup_loop.py", lineage_details)

        assert [r.name for r in lineage_details["sources"]] == ["RAW_GLOBAL"]
        assert [r.name for r in lineage_details["targets"]] == [
            "CONTRACT_DE",
            "CONTRACT_ES",
            "CONTRACT_FR",
            "CONTRACT_IT",
        ]
        queried_fqns = [c.kwargs["fqn"] for c in glue_source.metadata.get_entity_reference.call_args_list]
        assert queried_fqns.count("snowflake_prod.SALES_DB.CURATED.RAW_GLOBAL") == 1

    def test_get_workflow_runs_response_uses_runs_key(self, glue_source: Any):
        # boto3 Glue GetWorkflowRuns returns {"Runs": [...], "NextToken": ...}; there is no
        # "WorkflowRuns" member, so reading that key silently drops every real run.
        run = {"WorkflowRunId": "wr1", "WorkflowRunProperties": {"MARKET": "DE"}}
        glue_source.glue.get_workflow_runs.return_value = {"Runs": [run]}

        runs, fetch_ok = glue_source._get_workflow_runs_for_lineage({"Name": "market_workflow"})

        assert fetch_ok is True
        assert runs == [run]

    def test_graph_present_workflow_run_without_job_runs_emits_no_synthetic_contexts(self, glue_source: Any):
        # The run's Graph proves the job produced no job runs in this workflow run, so its
        # run properties must not be combined with every trigger's arguments.
        script = """
import sys
import boto3
from awsglue.utils import getResolvedOptions

glue = boto3.client("glue")
args = getResolvedOptions(sys.argv, ["SUFFIX", "WORKFLOW_NAME", "WORKFLOW_RUN_ID"])
props = glue.get_workflow_run_properties(
    Name=args["WORKFLOW_NAME"], RunId=args["WORKFLOW_RUN_ID"]
)["RunProperties"]
df.write.format("snowflake").option("sfDatabase", "SALES_DB").option("sfSchema", "CURATED").option(
    "dbtable", f"CONTRACT_{props['MARKET']}_{args['SUFFIX']}"
).save()
"""
        table_refs = {
            "CONTRACT_DE_V1": _make_table_ref("CONTRACT_DE_V1"),
            "CONTRACT_DE_V2": _make_table_ref("CONTRACT_DE_V2"),
        }
        workflow_details = {
            "Name": "graph_wf",
            "DefaultRunProperties": {},
            "Graph": {
                "Nodes": [
                    {
                        "Type": "TRIGGER",
                        "Name": "trig_v1",
                        "TriggerDetails": {
                            "Trigger": {
                                "Name": "trig_v1",
                                "Actions": [{"JobName": "graph_job", "Arguments": {"--SUFFIX": "V1"}}],
                            }
                        },
                    },
                    {
                        "Type": "TRIGGER",
                        "Name": "trig_v2",
                        "TriggerDetails": {
                            "Trigger": {
                                "Name": "trig_v2",
                                "Actions": [{"JobName": "graph_job", "Arguments": {"--SUFFIX": "V2"}}],
                            }
                        },
                    },
                    {"Type": "JOB", "Name": "graph_job", "UniqueId": "j1"},
                ],
                "Edges": [],
            },
        }
        glue_source.job_name_list = {"graph_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/graph_job.py"}}
        }
        glue_source.glue.get_workflow_runs.return_value = {
            "Runs": [
                {
                    "WorkflowRunId": "wr_graph",
                    "WorkflowRunProperties": {"MARKET": "DE"},
                    "Graph": {
                        "Nodes": [
                            {
                                "Type": "JOB",
                                "Name": "graph_job",
                                "JobDetails": {"JobRuns": []},
                            }
                        ]
                    },
                }
            ]
        }
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, table_refs):
            edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right]

        assert edges == []

    def test_graph_absent_workflow_run_keeps_synthetic_fallback(self, glue_source: Any):
        # Same shape as above but the run carries no Graph (e.g. LastRun-style data): the
        # synthetic fallback still combines the run's properties with each trigger's arguments.
        script = """
import sys
import boto3
from awsglue.utils import getResolvedOptions

glue = boto3.client("glue")
args = getResolvedOptions(sys.argv, ["SUFFIX", "WORKFLOW_NAME", "WORKFLOW_RUN_ID"])
props = glue.get_workflow_run_properties(
    Name=args["WORKFLOW_NAME"], RunId=args["WORKFLOW_RUN_ID"]
)["RunProperties"]
df.write.format("snowflake").option("sfDatabase", "SALES_DB").option("sfSchema", "CURATED").option(
    "dbtable", f"CONTRACT_{props['MARKET']}_{args['SUFFIX']}"
).save()
"""
        table_refs = {
            "CONTRACT_DE_V1": _make_table_ref("CONTRACT_DE_V1"),
            "CONTRACT_DE_V2": _make_table_ref("CONTRACT_DE_V2"),
        }
        workflow_details = {
            "Name": "graph_wf",
            "DefaultRunProperties": {},
            "Graph": {
                "Nodes": [
                    {
                        "Type": "TRIGGER",
                        "Name": "trig_v1",
                        "TriggerDetails": {
                            "Trigger": {
                                "Name": "trig_v1",
                                "Actions": [{"JobName": "graph_job", "Arguments": {"--SUFFIX": "V1"}}],
                            }
                        },
                    },
                    {
                        "Type": "TRIGGER",
                        "Name": "trig_v2",
                        "TriggerDetails": {
                            "Trigger": {
                                "Name": "trig_v2",
                                "Actions": [{"JobName": "graph_job", "Arguments": {"--SUFFIX": "V2"}}],
                            }
                        },
                    },
                    {"Type": "JOB", "Name": "graph_job", "UniqueId": "j1"},
                ],
                "Edges": [],
            },
        }
        glue_source.job_name_list = {"graph_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/graph_job.py"}}
        }
        glue_source.glue.get_workflow_runs.return_value = {
            "Runs": [{"WorkflowRunId": "wr_plain", "WorkflowRunProperties": {"MARKET": "DE"}}]
        }
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, table_refs):
            edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right]

        id_to_name = {model_str(ref.id): name for name, ref in table_refs.items()}
        assert {id_to_name[model_str(e.toEntity.id)] for e in edges} == {"CONTRACT_DE_V1", "CONTRACT_DE_V2"}

    @pytest.mark.parametrize(
        "script",
        [
            'tbl = "T"\ndf.write.format("snowflake").option("dbtable", f"{tbl:>2000000}").save()\n',
            'tbl = "T"\ndf.write.format("snowflake").option("dbtable", "{:>2000000}".format(tbl)).save()\n',
            'df.write.format("snowflake").option("dbtable", "%.200000f" % 1.5).save()\n',
            'df.write.format("snowflake").option("dbtable", "%*s" % (2000000, "x")).save()\n',
            'tbl = "T"\nw = 2000000\ndf.write.format("snowflake").option("dbtable", f"{tbl:>{w}}").save()\n',
        ],
        ids=[
            "fstring-width",
            "str-format-width",
            "percent-precision",
            "percent-star-width",
            "fstring-dynamic-width",
        ],
    )
    def test_huge_format_specs_rejected_without_huge_allocation(self, script: str):
        tracemalloc.start()
        try:
            sources, targets = parse_snowflake_refs(script)
            _, peak = tracemalloc.get_traced_memory()
        finally:
            tracemalloc.stop()

        assert sources == []
        assert targets == []
        assert peak < 262144
