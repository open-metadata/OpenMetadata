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

import ast
import datetime
import logging
import tracemalloc
from pathlib import Path
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
from metadata.ingestion.source.pipeline.gluepipeline import script_parser as script_parser_module
from metadata.ingestion.source.pipeline.gluepipeline.context_builder import (
    WorkflowSnapshot,
    build_parameter_contexts,
)
from metadata.ingestion.source.pipeline.gluepipeline.metadata import (
    MAX_INSPECTED_RUNS,
    GluepipelineSource,
    plan_lineage_edges,
)
from metadata.ingestion.source.pipeline.gluepipeline.models import JobNodes
from metadata.ingestion.source.pipeline.gluepipeline.script_evaluator import (
    LineageGroup,
    Resolved,
    ScriptReader,
    build_execution_slices,
    merge_sides,
    parse_python_script,
)
from metadata.ingestion.source.pipeline.gluepipeline.script_parser import (
    CatalogRef,
    JDBCRef,
    ParameterContext,
    S3Ref,
    SnowflakeRef,
    parse_glue_script,
    parse_glue_script_slices,
    parse_script_lineage_groups,
)
from metadata.ingestion.source.pipeline.gluepipeline.snowflake_parser import (
    MAX_EXPR_DEPTH,
    MAX_LOOP_UNROLLS,
    parse_snowflake_refs,
)
from metadata.utils.logger import Loggers

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
        ctx = ParameterContext.from_mappings(run_props=run_props, workflow_name="wf", workflow_run_id="r1")
        _, targets = parse_snowflake_refs(snippet, context=ctx)

        assert targets == [SnowflakeRef(table=expected_table)]


class TestResolvedOptionsHonorRequestedOptions:
    @pytest.mark.parametrize(
        ("resolve_call", "table_expr", "expected_targets"),
        [
            pytest.param(
                'getResolvedOptions(sys.argv, ["KNOWN"])',
                'args.get("MARKET", "US")',
                [SnowflakeRef(table="CONTRACT_US")],
                id="unrequested_get_returns_default",
            ),
            pytest.param(
                'getResolvedOptions(sys.argv, ["KNOWN"])', 'args["MARKET"]', [], id="unrequested_subscript_unresolved"
            ),
            pytest.param(
                'getResolvedOptions(sys.argv, ["REGION"])',
                'args.get("REGION", "EU")',
                [],
                id="requested_option_missing_from_context_unresolved",
            ),
            pytest.param(
                "getResolvedOptions(sys.argv, some_unknown_name)",
                'args.get("MARKET", "US")',
                [],
                id="non_literal_options_list_unresolved",
            ),
            pytest.param(
                'getResolvedOptions(["prog", "--MARKET", "XX"], ["MARKET"])',
                'args.get("MARKET", "US")',
                [],
                id="argv_other_than_sys_argv_unresolved",
            ),
            pytest.param(
                'getResolvedOptions(sys.argv, ["env-name"])',
                'args["env-name"]',
                [],
                id="dashed_option_exposed_only_under_dest_name",
            ),
            pytest.param(
                'getResolvedOptions(sys.argv, ["KNOWN"])',
                'args.get("TempDir", "TMP")',
                [],
                id="absent_builtin_option_unresolved",
            ),
        ],
    )
    def test_only_requested_and_builtin_options_are_exposed(
        self, resolve_call: str, table_expr: str, expected_targets: list[SnowflakeRef]
    ):
        script = f"""
import sys
from awsglue.utils import getResolvedOptions

args = {resolve_call}
table = {table_expr}
df.write.format("snowflake").option("dbtable", f"CONTRACT_{{table}}").save()
"""
        ctx = ParameterContext.from_mappings(job_args={"--KNOWN": "x", "--MARKET": "DE", "--env-name": "prod"})
        _, targets = parse_snowflake_refs(script, context=ctx)

        assert targets == expected_targets

    @pytest.mark.parametrize(
        ("options_setup", "expected_targets"),
        [
            pytest.param('opts = ["KNOWN"]; opts.append("MARKET")', [], id="append"),
            pytest.param('opts = ["KNOWN"]; opts.extend(["MARKET"])', [], id="extend"),
            pytest.param('opts = ["KNOWN"]; opts.insert(1, "MARKET")', [], id="insert"),
            pytest.param('opts = ["KNOWN"]; alias = opts; alias.append("MARKET")', [], id="alias_append"),
            pytest.param('opts = ["KNOWN"]; alias = opts; alias += ["MARKET"]', [], id="alias_iadd"),
            pytest.param('original = ["KNOWN"]; opts = original; original += ["MARKET"]', [], id="source_iadd"),
            pytest.param('opts = ["KNOWN", "MARKET"]; alias = opts; alias *= 0', [], id="alias_imul"),
            pytest.param('original = ["KNOWN", "MARKET"]; opts = original; original *= 0', [], id="source_imul"),
            pytest.param(
                'opts = ["KNOWN"]; alias = opts; nested = alias; nested.extend(["MARKET"])',
                [],
                id="chained_alias_extend",
            ),
            pytest.param('original = ["KNOWN"]; opts = original; original.append("MARKET")', [], id="source_append"),
            pytest.param('opts = ["KNOWN"]; opts[0] = "MARKET"', [], id="item_assignment"),
            pytest.param('opts = ["KNOWN", "MARKET"]', [SnowflakeRef(table="CONTRACT_DE")], id="unchanged_list"),
            pytest.param(
                'opts = ["KNOWN", "MARKET"]; unrelated = []; unrelated.append("OTHER")',
                [SnowflakeRef(table="CONTRACT_DE")],
                id="unrelated_list_mutation",
            ),
        ],
    )
    def test_requested_options_list_mutations(self, options_setup: str, expected_targets: list[SnowflakeRef]):
        script = f"""
import sys
from awsglue.utils import getResolvedOptions

{options_setup}
args = getResolvedOptions(sys.argv, opts)
market = args.get("MARKET", "FALLBACK")
df.write.format("snowflake").option("dbtable", f"CONTRACT_{{market}}").save()
"""
        ctx = ParameterContext.from_mappings(job_args={"--KNOWN": "x", "--MARKET": "DE"})

        _, targets = parse_snowflake_refs(script, context=ctx)

        assert targets == expected_targets
        assert parse_glue_script(script, context=ctx).snowflake_targets == expected_targets

    def test_augmented_assignment_to_options_dict_does_not_crash(self):
        script = """
options = {"dbtable": "ORDERS"}
alias = options
alias += {}
df.write.format("snowflake").options(**options).save()
"""

        assert parse_snowflake_refs(script) == ([], [])

    @pytest.mark.parametrize(
        ("argv_statement", "expected_targets"),
        [
            pytest.param('sys.argv.extend(["--MARKET", "US"])', [], id="extended"),
            pytest.param('sys.argv += ["--MARKET", "US"]', [], id="augmented"),
            pytest.param('sys.argv = ["prog", "--MARKET", "US"]', [], id="rebound"),
            pytest.param('sys.argv[1:] = ["--MARKET", "US"]', [], id="slice_assigned"),
            pytest.param(
                'has_market = "--MARKET" in sys.argv',
                [SnowflakeRef(table="CONTRACT_DE")],
                id="read_only_still_resolves",
            ),
        ],
    )
    def test_script_that_changes_sys_argv_leaves_options_unresolved(
        self, argv_statement: str, expected_targets: list[SnowflakeRef]
    ):
        script = f"""
import sys
from awsglue.utils import getResolvedOptions

{argv_statement}
args = getResolvedOptions(sys.argv, ["MARKET"])
df.write.format("snowflake").option("dbtable", f"CONTRACT_{{args['MARKET']}}").save()
"""
        ctx = ParameterContext.from_mappings(job_args={"--MARKET": "DE"})
        _, targets = parse_snowflake_refs(script, context=ctx)

        assert targets == expected_targets


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
args = getResolvedOptions(sys.argv, ["env", "WORKFLOW_NAME", "WORKFLOW_RUN_ID"])
props = glue.get_workflow_run_properties(Name=args["WORKFLOW_NAME"], RunId=args["WORKFLOW_RUN_ID"])["RunProperties"]
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
            caplog.at_level(logging.DEBUG, logger=Loggers.INGESTION.value),
        ):
            results = list(glue_source.yield_pipeline_lineage_details(workflow_details))

        assert len(results) == 1
        assert model_str(results[0].right.edge.toEntity.id) == model_str(target_ref.id)
        debug_msgs = [rec.getMessage() for rec in caplog.records if rec.levelno == logging.DEBUG]
        assert any("AccessDeniedException" in msg or "workflow runs" in msg.lower() for msg in debug_msgs)


class TestNonOverridableArgumentsPrecedence:
    @pytest.mark.parametrize(
        ("workflow_nodes", "workflow_runs", "job_runs_call"),
        [
            pytest.param(
                [],
                [
                    {
                        "WorkflowRunId": "wr_1",
                        "Graph": {
                            "Nodes": [
                                {
                                    "Type": "JOB",
                                    "Name": "market_job",
                                    "JobDetails": {"JobRuns": [{"Id": "jr_1", "Arguments": {"--MARKET": "FR"}}]},
                                }
                            ]
                        },
                    }
                ],
                {"return_value": {"JobRuns": []}},
                id="job_run_linked_to_workflow_run",
            ),
            pytest.param(
                [
                    {
                        "Type": "TRIGGER",
                        "Name": "start_trigger",
                        "TriggerDetails": {
                            "Trigger": {
                                "Name": "start_trigger",
                                "Actions": [{"JobName": "market_job", "Arguments": {"--MARKET": "ES"}}],
                            }
                        },
                    }
                ],
                [{"WorkflowRunId": "wr_1", "WorkflowRunProperties": {}}],
                {"return_value": {"JobRuns": []}},
                id="workflow_run_without_job_run_uses_trigger_args",
            ),
            pytest.param(
                [],
                [],
                {"return_value": {"JobRuns": [{"Id": "jr_1", "Arguments": {"--MARKET": "FR"}}]}},
                id="job_run_not_linked_to_workflow_run",
            ),
            pytest.param([], [], {"return_value": {"JobRuns": []}}, id="no_runs_fallback"),
            pytest.param(
                [],
                [],
                {
                    "side_effect": ClientError(
                        {"Error": {"Code": "AccessDeniedException", "Message": "Access denied"}}, "GetJobRuns"
                    )
                },
                id="job_runs_denied_fallback",
            ),
        ],
    )
    def test_non_overridable_arguments_win_in_every_context_path(
        self,
        glue_source: Any,
        workflow_nodes: list[dict[str, Any]],
        workflow_runs: list[dict[str, Any]],
        job_runs_call: dict[str, Any],
    ):
        script = """
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["MARKET"])
df.write.format("snowflake").option("sfDatabase", "SALES_DB").option("sfSchema", "CURATED").option(
    "dbtable", f"CONTRACT_{args['MARKET']}"
).save()
"""
        table_refs = {f"CONTRACT_{m}": _make_table_ref(f"CONTRACT_{m}") for m in ("DE", "ES", "FR", "IT")}
        workflow_details = {
            "Name": "market_workflow",
            "DefaultRunProperties": {},
            "Graph": {
                "Nodes": [*workflow_nodes, {"Type": "JOB", "Name": "market_job", "UniqueId": "j1"}],
                "Edges": [],
            },
        }
        glue_source.job_name_list = {"market_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {
                "Command": {"ScriptLocation": "s3://glue-scripts/market_job.py"},
                "DefaultArguments": {"--MARKET": "DE"},
                "NonOverridableArguments": {"--MARKET": "IT"},
            }
        }
        glue_source.glue.get_workflow_runs.return_value = {"Runs": workflow_runs}
        glue_source.glue.get_job_runs.configure_mock(**job_runs_call)
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, table_refs):
            results = list(glue_source.yield_pipeline_lineage_details(workflow_details))

        id_to_name = {model_str(ref.id): name for name, ref in table_refs.items()}
        assert [id_to_name[model_str(r.right.edge.toEntity.id)] for r in results] == ["CONTRACT_IT"]


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
        ctx = ParameterContext.from_mappings(job_args={"--markets_csv": "ES,IT,PT", "--spaced": "NORTH SOUTH"})
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

        # Exact variable provenance links cat_df -> summary_de and s3_df -> audit_de without cross-frame edges
        edge_pairs = {(model_str(e.fromEntity.id), model_str(e.toEntity.id)) for e in edges}
        assert edge_pairs == {
            (model_str(orders_ref.id), model_str(summary_ref.id)),
            (model_str(s3_container.id), model_str(audit_ref.id)),
        }
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
args = getResolvedOptions(sys.argv, ["MARKET", "WORKFLOW_NAME", "WORKFLOW_RUN_ID"])
props = glue.get_workflow_run_properties(Name=args["WORKFLOW_NAME"], RunId=args["WORKFLOW_RUN_ID"])["RunProperties"]

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


class TestReviewerRegressions:
    def test_unmatched_workflow_run_properties_lookup_stays_unresolved(self, glue_source: Any):
        script = """
import boto3

glue = boto3.client("glue")
props = glue.get_workflow_run_properties(Name="other_workflow", RunId="other_run")["RunProperties"]
market = props.get("MARKET", "FALLBACK")
df.write.format("snowflake").option("sfDatabase", "SALES_DB").option("sfSchema", "CURATED").option(
    "dbtable", f"my_table_{market}"
).save()
"""
        table_refs = {name: _make_table_ref(name) for name in ("my_table_DE", "my_table_FR", "my_table_FALLBACK")}
        workflow_details = {
            "Name": "market_workflow",
            "DefaultRunProperties": {"MARKET": "DE"},
            "Graph": {"Nodes": [{"Type": "JOB", "Name": "load_job", "UniqueId": "j1"}], "Edges": []},
        }
        glue_source.job_name_list = {"load_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/load_job.py"}}
        }
        glue_source.glue.get_workflow_runs.return_value = {
            "Runs": [{"WorkflowRunId": "current_run", "WorkflowRunProperties": {"MARKET": "DE"}}]
        }
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, table_refs):
            edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right]

        assert edges == []

    def test_sibling_loops_read_then_write_emit_direct_table_to_table_edge(self, glue_source: Any):
        script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
for item in ["only"]:
    df = spark.read.format("snowflake").options(**sf_options).option("dbtable", "my_source").load()

for item in ["only"]:
    df.write.format("snowflake").options(**sf_options).option("dbtable", "my_target").save()
"""
        my_source = _make_table_ref("my_source")
        my_target = _make_table_ref("my_target")
        workflow_details = {"Name": "sibling_loop_wf", "DefaultRunProperties": {}}
        glue_source.job_name_list = {"sibling_loop_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/sibling_loop.py"}}
        }
        glue_source.glue.get_workflow_runs.return_value = {"Runs": []}
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, {"my_source": my_source, "my_target": my_target}):
            edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right]

        assert len(edges) == 1
        assert model_str(edges[0].fromEntity.id) == model_str(my_source.id)
        assert model_str(edges[0].toEntity.id) == model_str(my_target.id)

    def test_loop_overrides_preserve_integer_scalar_type_for_format_specs(self):
        script = """
for idx in [1, 2]:
    df.write.format("snowflake").option("dbtable", f"my_table_{idx:02d}").save()
"""
        _, targets = parse_snowflake_refs(script)
        assert [ref.table for ref in targets] == ["my_table_01", "my_table_02"]

    def test_tuple_alias_augmented_assignment_preserves_original_tuple_loop(self):
        script = """
markets = ("DE", "FR")
expanded = markets
expanded += ("ES",)
for market in markets:
    df.write.format("snowflake").option("dbtable", f"CONTRACT_{market}").save()
"""
        _, targets = parse_snowflake_refs(script)
        assert [ref.table for ref in targets] == ["CONTRACT_DE", "CONTRACT_FR"]

    def test_workflow_with_twenty_scripted_jobs_fetches_workflow_runs_once(self, glue_source: Any):
        job_names = {f"job_{i:02d}" for i in range(20)}
        table_refs = {"CONTRACT_DE": _make_table_ref("CONTRACT_DE")}
        workflow_details = {
            "Name": "twenty_job_wf",
            "DefaultRunProperties": {},
            "Graph": {
                "Nodes": [{"Type": "JOB", "Name": name, "UniqueId": name} for name in sorted(job_names)],
                "Edges": [],
            },
        }
        glue_source.job_name_list = job_names
        glue_source.glue.get_job.return_value = {"Job": {"Command": {"ScriptLocation": "s3://glue-scripts/shared.py"}}}
        glue_source.glue.get_workflow_runs.return_value = {
            "Runs": [{"WorkflowRunId": "wr_1", "WorkflowRunProperties": {"MARKET": "DE"}}]
        }
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(ISSUE_37597_SCRIPT)

        with _wire_table_catalog(glue_source, table_refs):
            edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right]

        assert len(edges) == 1
        assert glue_source.glue.get_workflow_runs.call_count == 1

    @pytest.mark.parametrize(
        ("lookup_expr", "context", "expected"),
        [
            pytest.param(
                'glue.get_workflow_run_properties(Name="other_workflow", RunId="other_run")["RunProperties"]["MARKET"]',
                ParameterContext.from_mappings(
                    run_props={"MARKET": "DE"}, workflow_name="my_workflow", workflow_run_id="my_run"
                ),
                [],
                id="mismatched_workflow_and_run",
            ),
            pytest.param(
                'glue.get_workflow_run_properties(Name="my_workflow", RunId="other_run")["RunProperties"]["MARKET"]',
                ParameterContext.from_mappings(
                    run_props={"MARKET": "DE"}, workflow_name="my_workflow", workflow_run_id="my_run"
                ),
                [],
                id="mismatched_run_id_only",
            ),
            pytest.param(
                'glue.get_workflow_run_properties(Name="other_workflow", RunId="my_run")["RunProperties"]["MARKET"]',
                ParameterContext.from_mappings(
                    run_props={"MARKET": "DE"}, workflow_name="my_workflow", workflow_run_id="my_run"
                ),
                [],
                id="mismatched_workflow_name_only",
            ),
            pytest.param(
                'glue.get_workflow_run_properties(Name="my_workflow", RunId="my_run")["RunProperties"]["MARKET"]',
                ParameterContext.from_mappings(run_props={"MARKET": "DE"}),
                [],
                id="context_without_run_identity_fails_closed",
            ),
            pytest.param(
                'glue.get_workflow_run_properties(Name=unknown_fn(), RunId="my_run")["RunProperties"].get("MARKET", "US")',
                ParameterContext.from_mappings(
                    run_props={"MARKET": "DE"}, workflow_name="my_workflow", workflow_run_id="my_run"
                ),
                [],
                id="unknown_workflow_name_arg",
            ),
            pytest.param(
                'glue.get_workflow_run_properties("my_workflow", "my_run")["RunProperties"]["MARKET"]',
                ParameterContext.from_mappings(
                    run_props={"MARKET": "DE"}, workflow_name="my_workflow", workflow_run_id="my_run"
                ),
                [],
                id="positional_args_rejected",
            ),
            pytest.param(
                'glue.get_workflow_run_properties(Name="my_workflow")["RunProperties"]["MARKET"]',
                ParameterContext.from_mappings(
                    run_props={"MARKET": "DE"}, workflow_name="my_workflow", workflow_run_id="my_run"
                ),
                [],
                id="missing_run_id_rejected",
            ),
            pytest.param(
                'glue.get_workflow_run_properties(**{"Name": "my_workflow", "RunId": "my_run"})["RunProperties"]["MARKET"]',
                ParameterContext.from_mappings(
                    run_props={"MARKET": "FR"}, workflow_name="my_workflow", workflow_run_id="my_run"
                ),
                [SnowflakeRef(table="my_table_FR")],
                id="matching_kwargs_unpack_resolves",
            ),
        ],
    )
    def test_workflow_run_properties_identity_matching_variants(
        self, lookup_expr: str, context: ParameterContext, expected: list[SnowflakeRef]
    ):
        script = f"""
market = {lookup_expr}
df.write.format("snowflake").option("dbtable", f"my_table_{{market}}").save()
"""
        _, targets = parse_snowflake_refs(script, context=context)
        assert targets == expected

    def test_specific_run_lookup_resolves_only_matching_run_never_sibling_run(self, glue_source: Any):
        script = """
import boto3

glue = boto3.client("glue")
props = glue.get_workflow_run_properties(Name="market_workflow", RunId="other_run")["RunProperties"]
df.write.format("snowflake").option("sfDatabase", "SALES_DB").option("sfSchema", "CURATED").option(
    "dbtable", f"my_table_{props['MARKET']}"
).save()
"""
        table_refs = {"my_table_DE": _make_table_ref("my_table_DE"), "my_table_FR": _make_table_ref("my_table_FR")}
        workflow_details = {
            "Name": "market_workflow",
            "DefaultRunProperties": {},
            "Graph": {"Nodes": [{"Type": "JOB", "Name": "pin_run_job", "UniqueId": "j1"}], "Edges": []},
        }
        glue_source.job_name_list = {"pin_run_job"}
        glue_source.glue.get_job.return_value = {"Job": {"Command": {"ScriptLocation": "s3://glue-scripts/pin_run.py"}}}
        glue_source.glue.get_workflow_runs.return_value = {
            "Runs": [
                {"WorkflowRunId": "current_run", "WorkflowRunProperties": {"MARKET": "DE"}},
                {"WorkflowRunId": "other_run", "WorkflowRunProperties": {"MARKET": "FR"}},
            ]
        }
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, table_refs):
            edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right]

        id_to_name = {model_str(ref.id): name for name, ref in table_refs.items()}
        assert [id_to_name[model_str(e.toEntity.id)] for e in edges] == ["my_table_FR"]

    def test_default_workflow_fallback_token_never_leaks_fake_run_id_into_table_names(self):
        script = """
import sys
import boto3
from awsglue.utils import getResolvedOptions

glue = boto3.client("glue")
args = getResolvedOptions(sys.argv, ["WORKFLOW_NAME", "WORKFLOW_RUN_ID"])
props = glue.get_workflow_run_properties(Name=args["WORKFLOW_NAME"], RunId=args["WORKFLOW_RUN_ID"])["RunProperties"]
df.write.format("snowflake").option("dbtable", f"CONTRACT_{props['MARKET']}").save()
df.write.format("snowflake").option("dbtable", f"STAGING_{args['WORKFLOW_RUN_ID']}").save()
"""
        snapshot = WorkflowSnapshot.from_workflow_details(
            {"Name": "never_ran_wf", "DefaultRunProperties": {"MARKET": "DE"}},
            runs=(),
        )
        contexts = build_parameter_contexts("job_1", JobNodes(), snapshot)
        assert len(contexts) == 1
        _, targets = parse_snowflake_refs(script, context=contexts[0])
        assert targets == [SnowflakeRef(table="CONTRACT_DE")]

    def test_sibling_loops_fan_in_keyed_dict_sql_view_helper_fn_and_unresolved_safety(self):
        # 1. Fan-in list accumulation -> union -> fan-out write loop
        fan_script = """
frames = []
for mkt in ["DE", "FR"]:
    frames.append(spark.read.format("snowflake").option("dbtable", f"RAW_{mkt}").load())
combined = frames[0].unionByName(frames[1])
for tier in ["SUMMARY", "DETAIL"]:
    combined.write.format("snowflake").option("dbtable", f"REPORT_{tier}").save()
"""
        fan_groups = parse_script_lineage_groups(fan_script)
        assert len(fan_groups) == 2
        assert fan_groups[0].sources == Resolved((SnowflakeRef(table="RAW_DE"), SnowflakeRef(table="RAW_FR")))
        assert fan_groups[0].targets == Resolved((SnowflakeRef(table="REPORT_SUMMARY"),))
        assert fan_groups[1].sources == Resolved((SnowflakeRef(table="RAW_DE"), SnowflakeRef(table="RAW_FR")))
        assert fan_groups[1].targets == Resolved((SnowflakeRef(table="REPORT_DETAIL"),))

        # 2. Keyed dict across sibling loops correlates 1-to-1 per key without cross-market pollution
        keyed_script = """
frames = {}
for mkt in ["DE", "FR"]:
    frames[mkt] = spark.read.format("snowflake").option("dbtable", f"RAW_{mkt}").load()
for mkt in ["DE", "FR"]:
    frames[mkt].write.format("snowflake").option("dbtable", f"CONTRACT_{mkt}").save()
"""
        keyed_groups = parse_script_lineage_groups(keyed_script)
        assert [(g.sources, g.targets) for g in keyed_groups] == [
            (Resolved((SnowflakeRef(table="RAW_DE"),)), Resolved((SnowflakeRef(table="CONTRACT_DE"),))),
            (Resolved((SnowflakeRef(table="RAW_FR"),)), Resolved((SnowflakeRef(table="CONTRACT_FR"),))),
        ]

        # 3. Top-level dimension + sibling fact loop + sibling write loop combines both sources
        dim_fact_script = """
dim = spark.read.format("snowflake").option("dbtable", "DIM_COUNTRY").load()
for item in ["only"]:
    fact = spark.read.format("snowflake").option("dbtable", "FACT_SALES").load()
for item in ["only"]:
    fact.join(dim, "country").write.format("snowflake").option("dbtable", "CURATED_SALES").save()
"""
        dim_fact_groups = parse_script_lineage_groups(dim_fact_script)
        assert len(dim_fact_groups) == 1
        assert dim_fact_groups[0].sources == Resolved(
            (SnowflakeRef(table="FACT_SALES"), SnowflakeRef(table="DIM_COUNTRY"))
        )
        assert dim_fact_groups[0].targets == Resolved((SnowflakeRef(table="CURATED_SALES"),))

        # 4. Spark SQL temp view across sibling loops + helper functions defined out of order
        sql_fn_script = """
def write_outputs():
    for out in ["GOLD"]:
        spark.sql("SELECT * FROM stg_orders").write.format("snowflake").option("dbtable", f"ORDERS_{out}").save()

def register_inputs():
    for src in ["RAW_ORDERS"]:
        spark.read.format("snowflake").option("dbtable", src).load().createOrReplaceTempView("stg_orders")

register_inputs()
write_outputs()
"""
        sql_fn_groups = parse_script_lineage_groups(sql_fn_script)
        assert len(sql_fn_groups) == 1
        assert sql_fn_groups[0].sources == Resolved((SnowflakeRef(table="RAW_ORDERS"),))
        assert sql_fn_groups[0].targets == Resolved((SnowflakeRef(table="ORDERS_GOLD"),))

        # 5. Unresolved read in Loop 1 + resolved write in Loop 2 marks sources="unresolved" (skipped by planner)
        unresolved_sibling_script = """
for item in ["only"]:
    df = spark.read.format("snowflake").option("dbtable", f"RAW_{unknown_fn()}").load()
for item in ["only"]:
    df.write.format("snowflake").option("dbtable", "MY_TARGET").save()
"""
        unresolved_groups = parse_script_lineage_groups(unresolved_sibling_script)
        assert len(unresolved_groups) == 1
        assert unresolved_groups[0].sources == "unresolved"
        assert unresolved_groups[0].targets == Resolved((SnowflakeRef(table="MY_TARGET"),))

        # 6. Nested sibling loops inside an outer market loop stay isolated per market
        nested_sibling_script = """
for mkt in ["DE", "FR"]:
    acc = []
    for part in ["A", "B"]:
        df = spark.read.format("snowflake").option("dbtable", f"RAW_{mkt}_{part}").load()
        acc.append(df)
    merged = union_all(acc)
    for tier in ["GOLD"]:
        merged.write.format("snowflake").option("dbtable", f"CUR_{mkt}_{tier}").save()
"""
        nested_groups = parse_script_lineage_groups(nested_sibling_script)
        assert [(g.sources, g.targets) for g in nested_groups] == [
            (
                Resolved((SnowflakeRef(table="RAW_DE_A"), SnowflakeRef(table="RAW_DE_B"))),
                Resolved((SnowflakeRef(table="CUR_DE_GOLD"),)),
            ),
            (
                Resolved((SnowflakeRef(table="RAW_FR_A"), SnowflakeRef(table="RAW_FR_B"))),
                Resolved((SnowflakeRef(table="CUR_FR_GOLD"),)),
            ),
        ]

    def test_scalar_loop_overrides_cover_format_percent_range_dict_values_and_indexing(self):
        script = """
tables = ("ZERO", "ONE", "TWO")
partitions = {"p1": 1, "p2": 2}
indices = (1, 2)

for idx in indices:
    spark.read.format("snowflake").option("dbtable", "FMT_{:02d}".format(idx)).load()

for idx in partitions.values():
    spark.read.format("snowflake").option("dbtable", "PCT_%02d" % idx).load()

for idx in range(1, 3):
    df.write.format("snowflake").option("dbtable", f"IDX_{tables[idx]}_{idx:03d}").save()
"""
        sources, targets = parse_snowflake_refs(script)
        assert [ref.table for ref in sources] == ["FMT_01", "FMT_02", "PCT_01", "PCT_02"]
        assert [ref.table for ref in targets] == ["IDX_ONE_001", "IDX_TWO_002"]

    def test_tuple_concatenation_vs_mutable_list_alias_in_loops(self):
        tuple_concat_script = """
markets = ("DE", "FR")
expanded = markets + ("ES",)
for m in expanded:
    df.write.format("snowflake").option("dbtable", f"TUP_{m}").save()
"""
        _, tuple_targets = parse_snowflake_refs(tuple_concat_script)
        assert [ref.table for ref in tuple_targets] == ["TUP_DE", "TUP_FR", "TUP_ES"]

        # Mutable list alias augmented assignment mutates `markets` in place in Python -> stays unresolved
        list_alias_script = """
markets = ["DE", "FR"]
expanded = markets
expanded += ["ES"]
for m in markets:
    df.write.format("snowflake").option("dbtable", f"LST_{m}").save()
"""
        assert parse_snowflake_refs(list_alias_script) == ([], [])

    def test_neutral_script_evaluator_api_and_module_boundary(self):
        parser_source = Path(script_parser_module.__file__).read_text(encoding="utf-8")
        tree = ast.parse(parser_source)
        private_cross_imports = [
            (node.module, alias.name)
            for node in ast.walk(tree)
            if isinstance(node, ast.ImportFrom) and node.module and "gluepipeline" in node.module
            for alias in node.names
            if alias.name.startswith("_")
        ]
        assert private_cross_imports == []

        parsed = parse_python_script('bucket = "lake"\npath = f"s3://{bucket}/orders/"\n')
        assert parsed is not None
        slices = build_execution_slices(parsed.tree, bindings=parsed.bindings)
        assert len(slices) == 1
        reader = ScriptReader(parsed.tree, bindings=parsed.bindings)
        path_assign = parsed.tree.body[1]
        assert isinstance(path_assign, ast.Assign)
        assert reader.string(path_assign.value) == "s3://lake/orders/"

        with pytest.raises(ValueError, match="non-empty"):
            Resolved(())

    def test_pure_context_builder_and_typed_edge_planner_contracts(self):
        # 1. Pure build_parameter_contexts without GluepipelineSource
        snapshot = WorkflowSnapshot.from_workflow_details(
            {
                "Name": "pure_wf",
                "DefaultRunProperties": {"CHANNEL": "B2B", "MARKET": "DE"},
                "LastRun": {"WorkflowRunId": "wr_last", "WorkflowRunProperties": {"MARKET": "IT"}},
                "Graph": {
                    "Nodes": [
                        {
                            "Type": "TRIGGER",
                            "Name": "trig_main",
                            "TriggerDetails": {
                                "Trigger": {
                                    "Name": "trig_main",
                                    "Actions": [{"JobName": "etl_job", "Arguments": {"--env": "staging"}}],
                                }
                            },
                        }
                    ]
                },
            },
            runs=[
                {
                    "WorkflowRunId": "wr_1",
                    "WorkflowRunProperties": {"MARKET": "FR"},
                    "Graph": {
                        "Nodes": [
                            {
                                "Type": "JOB",
                                "Name": "etl_job",
                                "JobDetails": {
                                    "JobRuns": [
                                        {
                                            "Id": "jr_1",
                                            "TriggerName": "trig_main",
                                            "Arguments": {"--env": "prod"},
                                        }
                                    ]
                                },
                            }
                        ]
                    },
                }
            ],
        )
        job_nodes = JobNodes(
            DefaultArguments={"--env": "dev", "--region": "eu"},
            NonOverridableArguments={"--region": "locked-eu"},
        )
        contexts = build_parameter_contexts("etl_job", job_nodes, snapshot)
        assert len(contexts) == 2
        first_args = dict(contexts[0].job_args)
        assert first_args["--env"] == "prod"
        assert first_args["--region"] == "locked-eu"
        assert dict(contexts[0].run_props) == {"CHANNEL": "B2B", "MARKET": "FR"}
        assert contexts[0].workflow_name == "pure_wf"
        assert contexts[0].workflow_run_id == "wr_1"
        assert contexts[0].job_run_id == "jr_1"

        assert contexts[1].workflow_run_id == "wr_last"
        assert dict(contexts[1].run_props) == {"CHANNEL": "B2B", "MARKET": "IT"}

        # 2. Pure plan_lineage_edges over typed LineageGroup[EntityReference]
        pipeline_ref = EntityReference(id=Uuid(UUID(PIPELINE_UUID)), type="pipeline", name="pure_wf")
        raw_tbl = _make_table_ref("RAW")
        cur_tbl = _make_table_ref("CURATED")
        only_tgt = _make_table_ref("STANDALONE_OUT")
        only_src = _make_table_ref("STANDALONE_IN")
        skipped_tbl = _make_table_ref("SKIPPED")

        groups = [
            # Both resolved -> Table -> Table
            LineageGroup("exec_1", "dep_1", Resolved((raw_tbl,)), Resolved((cur_tbl,))),
            # Sources absent -> Pipeline -> Table (suppressed for cur_tbl, emitted for only_tgt)
            LineageGroup("exec_1", "dep_2", "absent", Resolved((cur_tbl, only_tgt))),
            # Targets absent -> Table -> Pipeline (suppressed for raw_tbl, emitted for only_src)
            LineageGroup("exec_1", "dep_3", Resolved((raw_tbl, only_src)), "absent"),
            # Either side unresolved -> skipped
            LineageGroup("exec_1", "dep_4", "unresolved", Resolved((skipped_tbl,))),
            LineageGroup("exec_1", "dep_5", Resolved((skipped_tbl,)), "unresolved"),
        ]
        planned = plan_lineage_edges(groups, pipeline_ref)
        pairs = {(model_str(r.edge.fromEntity.id), model_str(r.edge.toEntity.id)) for r in planned}
        assert pairs == {
            (model_str(raw_tbl.id), model_str(cur_tbl.id)),
            (PIPELINE_UUID, model_str(only_tgt.id)),
            (model_str(only_src.id), PIPELINE_UUID),
        }

        # Verify S3Ref is also emitted in typed script groups
        s3_groups = parse_script_lineage_groups('df.write.parquet("s3://lake/out/")\n')
        assert s3_groups == [
            LineageGroup(
                execution_id="default",
                dependency_id="slice_0",
                sources="absent",
                targets=Resolved((S3Ref(path="s3://lake/out/"),)),
            )
        ]


class TestDataflowProvenanceAndReviewFixes:
    def test_overwritten_frame_in_loop_links_only_reaching_assignment(self, glue_source: Any):
        script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
for name in ["RAW_DE", "RAW_FR"]:
    df = spark.read.format("snowflake").options(**sf_options).option("dbtable", name).load()

for item in ["only"]:
    df.write.format("snowflake").options(**sf_options).option("dbtable", "OUT").save()
"""
        groups = parse_script_lineage_groups(script)
        assert len(groups) == 1
        assert groups[0].sources == Resolved((SnowflakeRef(table="RAW_FR", database="SALES_DB", schema="CURATED"),))
        assert groups[0].targets == Resolved((SnowflakeRef(table="OUT", database="SALES_DB", schema="CURATED"),))

        table_refs = {name: _make_table_ref(name) for name in ("RAW_DE", "RAW_FR", "OUT")}
        workflow_details = {"Name": "overwrite_wf", "DefaultRunProperties": {}}
        glue_source.job_name_list = {"overwrite_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/overwrite.py"}}
        }
        glue_source.glue.get_workflow_runs.return_value = {"Runs": []}
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, table_refs):
            edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right]

        name_by_id = {model_str(ref.id): name for name, ref in table_refs.items()}
        name_by_id[PIPELINE_UUID] = "PIPELINE"
        pairs = {(name_by_id[model_str(e.fromEntity.id)], name_by_id[model_str(e.toEntity.id)]) for e in edges}
        assert pairs == {("RAW_FR", "OUT")}

    def test_sequential_and_post_loop_overwrites_vs_conditional_none_accumulation(self):
        seq_script = """
df = spark.read.format("snowflake").option("dbtable", "RAW_A").load()
df = spark.read.format("snowflake").option("dbtable", "RAW_B").load()
df.write.format("snowflake").option("dbtable", "OUT").save()
"""
        seq_groups = parse_script_lineage_groups(seq_script)
        assert [(g.sources, g.targets) for g in seq_groups] == [
            (Resolved((SnowflakeRef(table="RAW_B"),)), Resolved((SnowflakeRef(table="OUT"),)))
        ]

        post_loop_script = """
for name in ["RAW_A", "RAW_B"]:
    df = spark.read.format("snowflake").option("dbtable", name).load()
df.write.format("snowflake").option("dbtable", "OUT").save()
"""
        post_groups = parse_script_lineage_groups(post_loop_script)
        assert [(g.sources, g.targets) for g in post_groups] == [
            (Resolved((SnowflakeRef(table="RAW_B"),)), Resolved((SnowflakeRef(table="OUT"),)))
        ]

        accum_script = """
combined = None
for name in ["RAW_A", "RAW_B"]:
    df = spark.read.format("snowflake").option("dbtable", name).load()
    combined = df if combined is None else combined.unionByName(df)
combined.write.format("snowflake").option("dbtable", "OUT").save()
"""
        accum_groups = parse_script_lineage_groups(accum_script)
        assert [(g.sources, g.targets) for g in accum_groups] == [
            (
                Resolved((SnowflakeRef(table="RAW_A"), SnowflakeRef(table="RAW_B"))),
                Resolved((SnowflakeRef(table="OUT"),)),
            )
        ]

    def test_merge_sides_and_accumulated_loops_preserve_unresolved_marker(self, glue_source: Any):
        known_ref = SnowflakeRef(table="RAW_DE")
        assert merge_sides([Resolved((known_ref,)), "unresolved"]) == "unresolved"
        assert merge_sides(["unresolved", Resolved((known_ref,))]) == "unresolved"
        assert merge_sides(["absent", Resolved((known_ref,)), "absent"]) == Resolved((known_ref,))

        script = """
sf_options = {"sfDatabase": "SALES_DB", "sfSchema": "CURATED"}
frames = []
for mkt in ["DE"]:
    frames.append(spark.read.format("snowflake").options(**sf_options).option("dbtable", f"RAW_{mkt}").load())
for mkt in ["FR"]:
    frames.append(
        spark.read.format("snowflake").options(**sf_options).option("dbtable", f"RAW_{unknown_fn(mkt)}").load()
    )
for out in ["OUT"]:
    combined = frames[0].unionByName(frames[1])
    combined.write.format("snowflake").options(**sf_options).option("dbtable", out).save()
"""
        groups = parse_script_lineage_groups(script)
        assert len(groups) == 1
        assert groups[0].sources == "unresolved"
        assert groups[0].targets == Resolved((SnowflakeRef(table="OUT", database="SALES_DB", schema="CURATED"),))

        table_refs = {name: _make_table_ref(name) for name in ("RAW_DE", "RAW_FR", "OUT")}
        workflow_details = {"Name": "mixed_unknown_wf", "DefaultRunProperties": {}}
        glue_source.job_name_list = {"mixed_unknown_job"}
        glue_source.glue.get_job.return_value = {
            "Job": {"Command": {"ScriptLocation": "s3://glue-scripts/mixed_unknown.py"}}
        }
        glue_source.glue.get_workflow_runs.return_value = {"Runs": []}
        glue_source.glue.get_job_runs.return_value = {"JobRuns": []}
        glue_source._s3_client.get_object.return_value = _mock_s3_body(script)

        with _wire_table_catalog(glue_source, table_refs):
            edges = [r.right.edge for r in glue_source.yield_pipeline_lineage_details(workflow_details) if r.right]
        assert edges == []

    def test_sql_columns_literals_ctes_and_overwritten_views_do_not_create_false_links(self):
        # 1. Column & string literal named `amount` must not match temp view `amount`
        col_vs_view_script = """
for v in ["amount"]:
    spark.read.format("snowflake").option("dbtable", "RAW_AMOUNT").load().createOrReplaceTempView(v)
for v in ["other_view"]:
    spark.read.format("snowflake").option("dbtable", "RAW_OTHER").load().createOrReplaceTempView(v)
for out in ["OUT"]:
    spark.sql("SELECT amount, 'amount' AS label FROM other_view WHERE amount > 0").write.format(
        "snowflake"
    ).option("dbtable", out).save()
"""
        col_groups = parse_script_lineage_groups(col_vs_view_script)
        assert [(g.sources, g.targets) for g in col_groups] == [
            (Resolved((SnowflakeRef(table="RAW_OTHER"),)), Resolved((SnowflakeRef(table="OUT"),)))
        ]

        # 2. Querying an unregistered table/view leaves sources unresolved instead of matching column `amount`
        unregistered_view_script = """
for v in ["amount"]:
    spark.read.format("snowflake").option("dbtable", "RAW_AMOUNT").load().createOrReplaceTempView(v)
for out in ["OUT"]:
    spark.sql("SELECT amount FROM other_view").write.format("snowflake").option("dbtable", out).save()
"""
        unreg_groups = parse_script_lineage_groups(unregistered_view_script)
        assert [(g.sources, g.targets) for g in unreg_groups] == [
            ("unresolved", Resolved((SnowflakeRef(table="OUT"),)))
        ]

        # 3. CTE shadowing a temp view of the same name + temp view replacement across loop iterations
        cte_and_replace_script = """
for src in ["RAW_STALE", "RAW_REAL"]:
    spark.read.format("snowflake").option("dbtable", src).load().createOrReplaceTempView("real_view")
spark.read.format("snowflake").option("dbtable", "RAW_SHADOWED").load().createOrReplaceTempView("amount")
spark.sql("WITH amount AS (SELECT id FROM real_view) SELECT * FROM amount AS a").write.format(
    "snowflake"
).option("dbtable", "OUT_CTE").save()
"""
        cte_groups = parse_script_lineage_groups(cte_and_replace_script)
        assert [(g.sources, g.targets) for g in cte_groups] == [
            (Resolved((SnowflakeRef(table="RAW_REAL"),)), Resolved((SnowflakeRef(table="OUT_CTE"),)))
        ]

    def test_distinct_python_dict_keys_and_replacement_vs_accumulation(self):
        # 1. Int key `1` vs str key `"1"` across subscript writes, subscript reads, and `.get()`
        typed_key_script = """
frames = {}
fallback = spark.read.format("snowflake").option("dbtable", "RAW_FALLBACK").load()
for k in [1]:
    frames[k] = spark.read.format("snowflake").option("dbtable", "RAW_INT").load()
for k in ["1"]:
    frames[k] = spark.read.format("snowflake").option("dbtable", "RAW_STR").load()
for k in ["1"]:
    frames[k].write.format("snowflake").option("dbtable", "OUT_SUB").save()
    frames.get(k).write.format("snowflake").option("dbtable", "OUT_GET").save()
for k in [1]:
    frames.get(k, fallback).write.format("snowflake").option("dbtable", "OUT_INT").save()
frames.get("2", fallback).write.format("snowflake").option("dbtable", "OUT_MISS").save()
"""
        typed_groups = parse_script_lineage_groups(typed_key_script)
        assert [(g.sources, g.targets) for g in typed_groups] == [
            (Resolved((SnowflakeRef(table="RAW_STR"),)), Resolved((SnowflakeRef(table="OUT_SUB"),))),
            (Resolved((SnowflakeRef(table="RAW_STR"),)), Resolved((SnowflakeRef(table="OUT_GET"),))),
            (Resolved((SnowflakeRef(table="RAW_INT"),)), Resolved((SnowflakeRef(table="OUT_INT"),))),
            (Resolved((SnowflakeRef(table="RAW_FALLBACK"),)), Resolved((SnowflakeRef(table="OUT_MISS"),))),
        ]

        # Scalar lookup dict also preserves int `1` vs str `"1"`
        scalar_dict_script = """
TABLES = {1: "TBL_INT", "1": "TBL_STR"}
ONLY_INT = {1: "TBL_INT"}
df.write.format("snowflake").option("dbtable", TABLES["1"]).save()
df.write.format("snowflake").option("dbtable", TABLES[1]).save()
df.write.format("snowflake").option("dbtable", ONLY_INT.get("1", "TBL_FALLBACK")).save()
"""
        _, scalar_targets = parse_snowflake_refs(scalar_dict_script)
        assert [t.table for t in scalar_targets] == ["TBL_STR", "TBL_INT", "TBL_FALLBACK"]

        # 2. Dict per-key replacement vs setdefault vs list-per-key accumulation
        replace_vs_accum_script = """
frames = {}
for src in ["RAW_OLD", "RAW_NEW"]:
    frames["k"] = spark.read.format("snowflake").option("dbtable", src).load()
frames["k"].write.format("snowflake").option("dbtable", "OUT_REPLACED").save()

defaults = {}
for src in ["RAW_FIRST", "RAW_SECOND"]:
    defaults.setdefault("k", spark.read.format("snowflake").option("dbtable", src).load())
defaults["k"].write.format("snowflake").option("dbtable", "OUT_SETDEFAULT").save()

buckets = {}
for src in ["RAW_P1", "RAW_P2"]:
    buckets.setdefault("all", []).append(spark.read.format("snowflake").option("dbtable", src).load())
union_all(buckets["all"]).write.format("snowflake").option("dbtable", "OUT_ACCUM").save()
"""
        rva_groups = parse_script_lineage_groups(replace_vs_accum_script)
        assert [(g.sources, g.targets) for g in rva_groups] == [
            (Resolved((SnowflakeRef(table="RAW_NEW"),)), Resolved((SnowflakeRef(table="OUT_REPLACED"),))),
            (Resolved((SnowflakeRef(table="RAW_FIRST"),)), Resolved((SnowflakeRef(table="OUT_SETDEFAULT"),))),
            (
                Resolved((SnowflakeRef(table="RAW_P1"), SnowflakeRef(table="RAW_P2"))),
                Resolved((SnowflakeRef(table="OUT_ACCUM"),)),
            ),
        ]

    def test_ambiguous_branches_dynamic_loops_early_breaks_and_opaque_calls_return_unresolved(self):
        # 1. Disagreeing if/else branch on frame assignment -> unresolved
        branch_disagree = """
if unknown_cond():
    df = spark.read.format("snowflake").option("dbtable", "RAW_A").load()
else:
    df = spark.read.format("snowflake").option("dbtable", "RAW_B").load()
df.write.format("snowflake").option("dbtable", "OUT").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(branch_disagree)] == [
            ("unresolved", Resolved((SnowflakeRef(table="OUT"),)))
        ]

        # 2. Agreeing transform branch preserves provenance
        branch_agree = """
df = spark.read.format("snowflake").option("dbtable", "RAW_A").load()
if unknown_cond():
    df = df.filter("amount > 0")
df.write.format("snowflake").option("dbtable", "OUT").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(branch_agree)] == [
            (Resolved((SnowflakeRef(table="RAW_A"),)), Resolved((SnowflakeRef(table="OUT"),)))
        ]

        # 3. Dynamic loop reassigning frame before write -> unresolved
        dyn_loop_rebind = """
df = spark.read.format("snowflake").option("dbtable", "RAW_INIT").load()
for tbl in dynamic_tables():
    df = spark.read.format("snowflake").option("dbtable", tbl).load()
df.write.format("snowflake").option("dbtable", "OUT").save()
"""
        dyn_groups = [g for g in parse_script_lineage_groups(dyn_loop_rebind) if g.targets != "unresolved"]
        assert [(g.sources, g.targets) for g in dyn_groups] == [("unresolved", Resolved((SnowflakeRef(table="OUT"),)))]

        # 4. Constant loop with conditional break reassigning frame -> unresolved
        break_loop = """
for name in ["RAW_A", "RAW_B"]:
    df = spark.read.format("snowflake").option("dbtable", name).load()
    if should_stop():
        break
df.write.format("snowflake").option("dbtable", "OUT").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(break_loop)] == [
            ("unresolved", Resolved((SnowflakeRef(table="OUT"),)))
        ]

        # 5. Unknown dict key write invalidates prior dict entry -> unresolved
        unknown_key_write = """
frames = {"k": spark.read.format("snowflake").option("dbtable", "RAW_A").load()}
frames[unknown_key()] = spark.read.format("snowflake").option("dbtable", "RAW_B").load()
frames["k"].write.format("snowflake").option("dbtable", "OUT").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(unknown_key_write)] == [
            ("unresolved", Resolved((SnowflakeRef(table="OUT"),)))
        ]

        # 6. Opaque loader or binary join with opaque frame -> unresolved
        opaque_join = """
df1 = spark.read.format("snowflake").option("dbtable", "RAW_A").load()
df1.join(load_mystery_df(), "id").write.format("snowflake").option("dbtable", "OUT").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(opaque_join)] == [
            ("unresolved", Resolved((SnowflakeRef(table="OUT"),)))
        ]

    def test_helper_parameters_dict_items_loop_temp_view_lifecycle_and_container_aliases(self):
        # 1. Helper function with parameter + `frames.items()` tuple unpacking loop
        helper_items_script = """
def read_market(mkt):
    return spark.read.format("snowflake").option("dbtable", f"RAW_{mkt}").load()

frames = {}
for m in ["DE", "FR"]:
    frames[m] = read_market(m)

for m, frame in frames.items():
    frame.write.format("snowflake").option("dbtable", f"CONTRACT_{m}").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(helper_items_script)] == [
            (Resolved((SnowflakeRef(table="RAW_DE"),)), Resolved((SnowflakeRef(table="CONTRACT_DE"),))),
            (Resolved((SnowflakeRef(table="RAW_FR"),)), Resolved((SnowflakeRef(table="CONTRACT_FR"),))),
        ]

        # 2. Container alias survives unrelated `if` branch; external side-effect call invalidates dict `.get`
        alias_and_opaque_proc_script = """
frames = []
alias = frames
if unknown_cond():
    marker = 1
alias.append(spark.read.format("snowflake").option("dbtable", "RAW_ALIAS").load())
union_all(frames).write.format("snowflake").option("dbtable", "OUT_ALIAS").save()

by_key = {}
fallback = spark.read.format("snowflake").option("dbtable", "RAW_FALLBACK").load()
populate_externally(by_key)
by_key.get("k", fallback).write.format("snowflake").option("dbtable", "OUT_OPAQUE_DICT").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(alias_and_opaque_proc_script)] == [
            (Resolved((SnowflakeRef(table="RAW_ALIAS"),)), Resolved((SnowflakeRef(table="OUT_ALIAS"),))),
            ("unresolved", Resolved((SnowflakeRef(table="OUT_OPAQUE_DICT"),))),
        ]

        # 3. `spark.table` on registered temp view + global temp view + `dropTempView` invalidation
        view_lifecycle_script = """
spark.read.format("snowflake").option("dbtable", "RAW_LOCAL").load().createOrReplaceTempView("v_local")
spark.read.format("snowflake").option("dbtable", "RAW_GLOBAL").load().createOrReplaceGlobalTempView("v_glob")
spark.table("v_local").write.format("snowflake").option("dbtable", "OUT_LOCAL").save()
spark.sql("SELECT `id` FROM global_temp.v_glob -- v_local").write.format("snowflake").option("dbtable", "OUT_GLOB").save()
spark.catalog.dropTempView("v_local")
spark.sql("SELECT * FROM v_local").write.format("snowflake").option("dbtable", "OUT_DROPPED").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(view_lifecycle_script)] == [
            (Resolved((SnowflakeRef(table="RAW_LOCAL"),)), Resolved((SnowflakeRef(table="OUT_LOCAL"),))),
            (Resolved((SnowflakeRef(table="RAW_GLOBAL"),)), Resolved((SnowflakeRef(table="OUT_GLOB"),))),
            ("unresolved", Resolved((SnowflakeRef(table="OUT_DROPPED"),))),
        ]

    def test_dict_and_list_mutations_constructors_deletions_and_branch_joins(self):
        # 1. Dict constructor, update, |=, |, pop, del, clear, tuple keys, values/keys views
        dict_ops_script = """
from functools import reduce
from awsglue.transforms import Join

d_init = {("DE", 1): spark.read.format("snowflake").option("dbtable", "RAW_DE_1").load()}
d_str = {("DE", "1"): spark.read.format("snowflake").option("dbtable", "RAW_DE_STR").load()}
merged = d_init | d_str
merged[("DE", 1)].write.format("snowflake").option("dbtable", "OUT_TUP_INT").save()
merged[("DE", "1")].write.format("snowflake").option("dbtable", "OUT_TUP_STR").save()

copied = dict(d_init, extra=spark.read.format("snowflake").option("dbtable", "RAW_EXTRA").load())
copied.update(other=spark.read.format("snowflake").option("dbtable", "RAW_OTHER").load())
copied |= {"third": spark.read.format("snowflake").option("dbtable", "RAW_THIRD").load()}
del copied["extra"]
popped = copied.pop("other")
popped.write.format("snowflake").option("dbtable", "OUT_POPPED").save()
for k in copied.keys():
    copied[k].write.format("snowflake").option("dbtable", "OUT_REMAINING").save()
copied.clear()
copied["fresh"] = spark.read.format("snowflake").option("dbtable", "RAW_FRESH").load()
reduce(lambda a, b: a.unionByName(b), list_fn := [*copied.values()]).write.format("snowflake").option(
    "dbtable", "OUT_VALUES"
).save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(dict_ops_script)] == [
            (Resolved((SnowflakeRef(table="RAW_DE_1"),)), Resolved((SnowflakeRef(table="OUT_TUP_INT"),))),
            (Resolved((SnowflakeRef(table="RAW_DE_STR"),)), Resolved((SnowflakeRef(table="OUT_TUP_STR"),))),
            (Resolved((SnowflakeRef(table="RAW_OTHER"),)), Resolved((SnowflakeRef(table="OUT_POPPED"),))),
            (Resolved((SnowflakeRef(table="RAW_DE_1"),)), Resolved((SnowflakeRef(table="OUT_REMAINING"),))),
            (Resolved((SnowflakeRef(table="RAW_THIRD"),)), Resolved((SnowflakeRef(table="OUT_REMAINING"),))),
            (Resolved((SnowflakeRef(table="RAW_FRESH"),)), Resolved((SnowflakeRef(table="OUT_VALUES"),))),
        ]

        # 2. List extend, +=, insert, pop, del, clear, Join.apply, and branch joins on dicts/lists
        list_and_join_script = """
from awsglue.transforms import Join

frames = [spark.read.format("snowflake").option("dbtable", "RAW_STALE").load()]
frames.clear()
frames.extend([spark.read.format("snowflake").option("dbtable", "RAW_A").load()])
frames += [spark.read.format("snowflake").option("dbtable", "RAW_DROP").load()]
frames.insert(1, spark.read.format("snowflake").option("dbtable", "RAW_B").load())
del frames[2]
second = frames.pop(1)
first = frames.pop()
Join.apply(frame1=first, frame2=second, keys1=["id"], keys2=["id"]).write.format("snowflake").option(
    "dbtable", "OUT_JOIN"
).save()

by_mkt = {"SHARED": first, "DIFF": first}
seq = [first]
if unknown_flag():
    by_mkt["DIFF"] = second
    by_mkt["ONLY_THEN"] = second
    seq.append(second)
by_mkt["SHARED"].write.format("snowflake").option("dbtable", "OUT_SHARED").save()
by_mkt["DIFF"].write.format("snowflake").option("dbtable", "OUT_DIFF").save()
by_mkt.get("ONLY_THEN", first).write.format("snowflake").option("dbtable", "OUT_ONLY_THEN").save()
seq[0].write.format("snowflake").option("dbtable", "OUT_SEQ_MISMATCH").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(list_and_join_script)] == [
            (
                Resolved((SnowflakeRef(table="RAW_A"), SnowflakeRef(table="RAW_B"))),
                Resolved((SnowflakeRef(table="OUT_JOIN"),)),
            ),
            (Resolved((SnowflakeRef(table="RAW_A"),)), Resolved((SnowflakeRef(table="OUT_SHARED"),))),
            ("unresolved", Resolved((SnowflakeRef(table="OUT_DIFF"),))),
            ("unresolved", Resolved((SnowflakeRef(table="OUT_ONLY_THEN"),))),
            ("unresolved", Resolved((SnowflakeRef(table="OUT_SEQ_MISMATCH"),))),
        ]

    def test_control_flow_conditions_try_except_finally_and_loop_step_bounds(self):
        # 1. Static conditions (`__name__`, `in`/`not in`, `and`/`or`/`not`) + try/except/finally
        control_script = """
cache = {}
if __name__ == "__main__":
    for mkt in ["DE", "SKIP", "FR"]:
        if mkt == "SKIP" or (not True):
            continue
        if mkt not in cache and mkt in ("DE", "FR"):
            cache[mkt] = spark.read.format("snowflake").option("dbtable", f"RAW_{mkt}").load()

try:
    df_ok = cache["DE"]
except Exception:
    raise
df_ok.write.format("snowflake").option("dbtable", "OUT_RERAISE").save()

try:
    df_ambig = cache["DE"]
except RuntimeError as exc:
    df_ambig = cache["FR"]
finally:
    df_final = cache["FR"]
df_ambig.write.format("snowflake").option("dbtable", "OUT_AMBIG").save()
df_final.write.format("snowflake").option("dbtable", "OUT_FINAL").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(control_script)] == [
            (Resolved((SnowflakeRef(table="RAW_DE"),)), Resolved((SnowflakeRef(table="OUT_RERAISE"),))),
            ("unresolved", Resolved((SnowflakeRef(table="OUT_AMBIG"),))),
            (Resolved((SnowflakeRef(table="RAW_FR"),)), Resolved((SnowflakeRef(table="OUT_FINAL"),))),
        ]

        # 2. Nested constant loops exceeding MAX_TOTAL_LOOP_STEPS (256) bail out to unresolved
        bounded_loop_script = """
df = spark.read.format("snowflake").option("dbtable", "RAW_INIT").load()
for i in range(20):
    for j in range(20):
        df = spark.read.format("snowflake").option("dbtable", f"RAW_{i}_{j}").load()
df.write.format("snowflake").option("dbtable", "OUT_BOUNDED").save()
"""
        bounded_groups = parse_script_lineage_groups(bounded_loop_script)
        out_bounded = [g for g in bounded_groups if g.targets == Resolved((SnowflakeRef(table="OUT_BOUNDED"),))]
        assert len(out_bounded) == 1
        assert out_bounded[0].sources == "unresolved"

    def test_helper_defaults_recursion_guard_in_memory_frames_and_partial_s3_paths(self):
        # 1. Helper defaults, keyword-only args, multi-return, recursive helper bailout, in-memory frames
        helper_and_mem_script = """
def load_table(prefix, suffix="MAIN", *, choose_alt=False):
    primary = spark.read.format("snowflake").option("dbtable", f"{prefix}_{suffix}").load()
    if choose_alt:
        return spark.read.format("snowflake").option("dbtable", f"{prefix}_ALT").load()
    return primary[["id", "amount"]]

def recursive_mutator(bucket):
    return recursive_mutator(bucket)

load_table("RAW").write.format("snowflake").option("dbtable", "OUT_DEFAULT").save()
load_table("RAW", choose_alt=True).write.format("snowflake").option("dbtable", "OUT_ALT").save()
load_table("RAW", choose_alt=unknown_bool()).write.format("snowflake").option("dbtable", "OUT_BRANCH_RET").save()

bucket = {"k": spark.read.format("snowflake").option("dbtable", "RAW_SAFE").load()}
recursive_mutator(bucket)
bucket.get("k").write.format("snowflake").option("dbtable", "OUT_RECURSIVE").save()

spark.createDataFrame([], schema="id int").write.format("snowflake").option("dbtable", "OUT_INMEM").save()
spark.range(5).unionByName(spark.emptyDataFrame).write.format("snowflake").option("dbtable", "OUT_RANGE").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(helper_and_mem_script)] == [
            (Resolved((SnowflakeRef(table="RAW_MAIN"),)), Resolved((SnowflakeRef(table="OUT_DEFAULT"),))),
            (Resolved((SnowflakeRef(table="RAW_ALT"),)), Resolved((SnowflakeRef(table="OUT_ALT"),))),
            ("unresolved", Resolved((SnowflakeRef(table="OUT_BRANCH_RET"),))),
            ("unresolved", Resolved((SnowflakeRef(table="OUT_RECURSIVE"),))),
            ("absent", Resolved((SnowflakeRef(table="OUT_INMEM"),))),
            ("absent", Resolved((SnowflakeRef(table="OUT_RANGE"),))),
        ]

        # 2. Non-replace createTempView collision, DDL spark.sql invalidation, and partial-unknown S3 list
        edge_cases_script = """
spark.read.format("snowflake").option("dbtable", "RAW_V1").load().createTempView("dup_v")
spark.read.format("snowflake").option("dbtable", "RAW_V2").load().createTempView("dup_v")
spark.sql("SELECT * FROM dup_v").write.format("snowflake").option("dbtable", "OUT_DUP_VIEW").save()

spark.read.format("snowflake").option("dbtable", "RAW_CLEAN").load().createOrReplaceTempView("clean_v")
spark.sql("DROP VIEW IF EXISTS clean_v")
spark.table("clean_v").write.format("snowflake").option("dbtable", "OUT_AFTER_DDL").save()

df_partial = spark.read.parquet("s3://bucket/known", f"s3://bucket/{unknown_part()}")
df_partial.write.parquet("s3://bucket/out_partial")
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(edge_cases_script)] == [
            ("unresolved", Resolved((SnowflakeRef(table="OUT_DUP_VIEW"),))),
            ("unresolved", Resolved((SnowflakeRef(table="OUT_AFTER_DDL"),))),
            ("unresolved", Resolved((S3Ref(path="s3://bucket/out_partial"),))),
        ]

        # 3. Dict unpacking (`{**d}`, `dict(**d)`), `spark.table("global_temp.x")`, `del x`, scalar `+=`, equal-len list join
        unpack_and_glob_script = """
spark.read.format("snowflake").option("dbtable", "RAW_GLOB").load().createOrReplaceGlobalTempView("vg")
df_g = spark.table("global_temp.vg")
base_map = {"g": df_g}
unpacked = {**base_map}
kw_copy = dict(**unpacked)
suffix = "OUT"
for part in ["_G"]:
    suffix += part
stale = df_g
del stale
pair = [df_g]
if unknown_cond():
    pair = [spark.read.format("snowflake").option("dbtable", "RAW_OTHER").load()]
kw_copy["g"].write.format("snowflake").option("dbtable", suffix).save()
pair[0].write.format("snowflake").option("dbtable", "OUT_PAIR").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(unpack_and_glob_script)] == [
            (Resolved((SnowflakeRef(table="RAW_GLOB"),)), Resolved((SnowflakeRef(table="OUT_G"),))),
            ("unresolved", Resolved((SnowflakeRef(table="OUT_PAIR"),))),
        ]

    def test_helper_return_aliasing_definition_defaults_loop_returns_and_numeric_comparisons(self):
        # 1. Returned container keeps shared identity with caller variable (`alias = identity(frames)`)
        returned_alias_script = """
def identity(xs):
    return xs

frames = [spark.read.format("snowflake").option("dbtable", "RAW_A").load()]
alias = identity(frames)
alias[0] = spark.read.format("snowflake").option("dbtable", "RAW_B").load()
frames[0].write.format("snowflake").option("dbtable", "OUT_ALIAS_RET").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(returned_alias_script)] == [
            (Resolved((SnowflakeRef(table="RAW_B"),)), Resolved((SnowflakeRef(table="OUT_ALIAS_RET"),)))
        ]

        # 2. Helper default arguments are captured at definition time, not re-evaluated on call
        def_time_default_script = """
name = "RAW_A"
def load_with_default(tbl=name, *, kw_tbl=name):
    df1 = spark.read.format("snowflake").option("dbtable", tbl).load()
    df2 = spark.read.format("snowflake").option("dbtable", kw_tbl).load()
    return df1.unionByName(df2)

name = "RAW_B"
load_with_default().write.format("snowflake").option("dbtable", "OUT_DEF_DEFAULT").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(def_time_default_script)] == [
            (Resolved((SnowflakeRef(table="RAW_A"),)), Resolved((SnowflakeRef(table="OUT_DEF_DEFAULT"),)))
        ]

        # 3. Unconditional `return` inside constant `for` loop in helper preserves valid lineage
        const_loop_return_script = """
def load_first():
    for tbl in ["RAW_FIRST", "RAW_SECOND"]:
        return spark.read.format("snowflake").option("dbtable", tbl).load()

load_first().write.format("snowflake").option("dbtable", "OUT_LOOP_RET").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(const_loop_return_script)] == [
            (Resolved((SnowflakeRef(table="RAW_FIRST"),)), Resolved((SnowflakeRef(table="OUT_LOOP_RET"),)))
        ]

        # 4. Conditional `return` inside dynamic `for`/`while` loop in helper joins into return_outcomes -> unresolved
        dyn_loop_return_script = """
def load_matching(names):
    for n in names:
        if is_valid(n):
            return spark.read.format("snowflake").option("dbtable", n).load()
    return spark.read.format("snowflake").option("dbtable", "RAW_DEFAULT").load()

load_matching(dynamic_names()).write.format("snowflake").option("dbtable", "OUT_DYN_RET").save()
"""
        dyn_ret_groups = [
            g
            for g in parse_script_lineage_groups(dyn_loop_return_script)
            if g.targets == Resolved((SnowflakeRef(table="OUT_DYN_RET"),))
        ]
        assert [(g.sources, g.targets) for g in dyn_ret_groups] == [
            ("unresolved", Resolved((SnowflakeRef(table="OUT_DYN_RET"),)))
        ]

        # 5. Dynamic loop rebinding frame AFTER write in body detects loop-carried change -> unresolved
        loop_carried_rebind_script = """
df = spark.read.format("snowflake").option("dbtable", "RAW_SEED").load()
while has_more():
    df.write.format("snowflake").option("dbtable", "OUT_CARRIED").save()
    df = spark.read.format("snowflake").option("dbtable", "RAW_STAGE").load()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(loop_carried_rebind_script)] == [
            ("unresolved", Resolved((SnowflakeRef(table="OUT_CARRIED"),)))
        ]

        # 6. Numeric/boolean Python equality (`1 == True`, `1 == 1.0`, `1 in (True, 2)`) while `1 != "1"`
        numeric_cmp_script = """
flag = 1
if flag == True and flag == 1.0 and flag in (True, 2) and flag != "1" and flag not in ("1", "2"):
    df = spark.read.format("snowflake").option("dbtable", "RAW_NUM_TRUE").load()
else:
    df = spark.read.format("snowflake").option("dbtable", "RAW_WRONG").load()
df.write.format("snowflake").option("dbtable", "OUT_NUM_CMP").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(numeric_cmp_script)] == [
            (Resolved((SnowflakeRef(table="RAW_NUM_TRUE"),)), Resolved((SnowflakeRef(table="OUT_NUM_CMP"),)))
        ]

    def test_conditional_helper_def_loop_probe_helper_return_and_while_continue_exit(self):
        # 1. Helper without defaults defined inside only one branch of an unknown `if` must not raise KeyError
        cond_helper_script = """
if unknown_cond():
    def unused_helper():
        return None
df = spark.read.format("snowflake").option("dbtable", "RAW_OK").load()
df.write.format("snowflake").option("dbtable", "OUT_COND_HELPER").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(cond_helper_script)] == [
            (Resolved((SnowflakeRef(table="RAW_OK"),)), Resolved((SnowflakeRef(table="OUT_COND_HELPER"),)))
        ]

        # 2. Helper called inside a dynamic `while` loop keeps its return value during loop-entry probes
        probe_helper_script = """
def identity(frame):
    return frame

df = spark.read.format("snowflake").option("dbtable", "RAW_KEEP").load()
while has_more():
    df = identity(df)
    df.write.format("snowflake").option("dbtable", "OUT_PROBE_HELPER").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(probe_helper_script)] == [
            (Resolved((SnowflakeRef(table="RAW_KEEP"),)), Resolved((SnowflakeRef(table="OUT_PROBE_HELPER"),)))
        ]

        # 3. Initially-true `while keep_going:` exiting via `continue` after `keep_going = False` joins with `break`
        while_continue_exit_script = """
keep_going = True
while keep_going:
    if is_done():
        df = spark.read.format("snowflake").option("dbtable", "RAW_A").load()
        keep_going = False
        continue
    df = spark.read.format("snowflake").option("dbtable", "RAW_B").load()
    break
df.write.format("snowflake").option("dbtable", "OUT_WHILE_EXIT").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(while_continue_exit_script)] == [
            ("unresolved", Resolved((SnowflakeRef(table="OUT_WHILE_EXIT"),)))
        ]

        # 4. `while True:` with conditional `return` in helper cannot fall through to implicit `None`
        while_true_return_script = """
def poll_ready():
    while True:
        if is_ready():
            return spark.read.format("snowflake").option("dbtable", "RAW_READY").load()

poll_ready().write.format("snowflake").option("dbtable", "OUT_READY").save()
"""
        assert [(g.sources, g.targets) for g in parse_script_lineage_groups(while_true_return_script)] == [
            (Resolved((SnowflakeRef(table="RAW_READY"),)), Resolved((SnowflakeRef(table="OUT_READY"),)))
        ]
