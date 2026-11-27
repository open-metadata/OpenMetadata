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
"""
AWS Glue Data Quality ingestion tests. Only the boto3 client and the OpenMetadata
server are faked.
"""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from botocore.exceptions import ClientError

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestDefinition,
    TestPlatform,
)
from metadata.generated.schema.type.basic import Timestamp
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.tests_data import (
    OMetaLogicalTestSuiteSample,
    OMetaTestCaseResultsSample,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.database_service import DatabaseServiceTopology
from metadata.ingestion.source.database.glue.data_quality import (
    GlueDataQualityClient,
    ParsedRule,
    build_test_case_name,
    build_test_definition_name,
    parse_dqdl_rule,
    safe_name,
    to_score_result,
    to_test_case_result,
)
from metadata.ingestion.source.database.glue.metadata import GlueSource
from metadata.ingestion.source.database.glue.models import DataQualityRuleResult

SERVICE = "local_glue"
CATALOG_ID = "118146679784"
TABLE_FQN = f"{SERVICE}.{CATALOG_ID}.sales.orders"
COMPLETED_ON = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)
COMPLETED_ON_MS = int(COMPLETED_ON.timestamp() * 1000)

GLUE_CONFIG = {
    "source": {
        "type": "glue",
        "serviceName": SERVICE,
        "serviceConnection": {
            "config": {
                "type": "Glue",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-2",
                },
                # Wide enough to hold the fixed-date fixtures; the lookback test sets its own window.
                "dataQualityConfig": {"includeDataQuality": True, "lookbackDays": 3650},
            },
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "glue"},
        }
    },
}

CATALOG_RESULT = {
    "ResultId": "dqresult-catalog",
    "Score": 0.5,
    "RulesetName": "orders_ruleset",
    "DataSource": {"GlueTable": {"DatabaseName": "sales", "TableName": "orders", "CatalogId": CATALOG_ID}},
    "StartedOn": datetime(2026, 10, 1, 11, 58, tzinfo=timezone.utc),
    "CompletedOn": COMPLETED_ON,
    "RuleResults": [
        # Catalog ruleset runs carry the DQDL rule in Description; only ETL runs set EvaluatedRule.
        {
            "Name": "Rule_1",
            "Description": 'IsComplete "order_id"',
            "Result": "PASS",
            "EvaluatedMetrics": {"Column.order_id.Completeness": 1.0},
        },
        {
            "Name": "Rule_2",
            "Description": "RowCount > 1000",
            "Result": "FAIL",
            "EvaluationMessage": "Value: 42 does not meet the constraint requirement!",
            "EvaluatedMetrics": {"Dataset.*.RowCount": 42.0},
        },
    ],
}

ETL_RESULT = {
    "ResultId": "dqresult-etl",
    "EvaluationContext": "EvaluateDataQuality_node1",
    "JobName": "orders_etl",
    "CompletedOn": COMPLETED_ON,
    "RuleResults": [{"Name": "Rule_1", "EvaluatedRule": 'IsUnique "order_id"', "Result": "ERROR"}],
}


def make_table(fqn: str = TABLE_FQN) -> Table:
    return Table(
        id=uuid4(),
        name=fqn.rsplit(".", maxsplit=1)[-1],
        fullyQualifiedName=fqn,
        columns=[Column(name="order_id", dataType=DataType.INT)],
    )


def make_test_case(fqn: str) -> TestCase:
    return TestCase(
        id=uuid4(),
        name=fqn.rsplit(".", maxsplit=1)[-1],
        fullyQualifiedName=fqn,
        entityLink=f"<#E::table::{TABLE_FQN}>",
        testDefinition=EntityReference(id=uuid4(), type="testDefinition"),
        testSuite=EntityReference(id=uuid4(), type="testSuite"),
    )


class FakeOpenMetadata:
    """Answers the lookups the ingestion makes, holding what the server would hold."""

    def __init__(self, tables: list[Table] | None = None) -> None:
        self.tables = {model_str(table.fullyQualifiedName): table for table in tables or [make_table()]}
        self.test_cases: dict[str, TestCase] = {}
        self.existing_results: dict[str, list[TestCaseResult]] = {}
        self.es_search_from_fqn = MagicMock(return_value=None)
        self.table_lookups: list[str] = []
        self.result_windows: list[tuple[int, int]] = []

    def get_by_name(self, entity, fqn, fields=None):
        if entity is Table:
            self.table_lookups.append(fqn)
            return self.tables.get(fqn)
        if entity is TestCase:
            test_case = self.test_cases.get(fqn)
            if test_case and not {"testDefinition", "testSuite"} <= set(fields or []):
                # The server leaves non-default fields out, and the client model requires them.
                TestCase.model_validate(test_case.model_dump(exclude={"testDefinition", "testSuite"}))
            return test_case
        if entity is TestDefinition:
            return None
        raise AssertionError(f"unexpected lookup of {entity}")

    def get_test_case_results(self, test_case_fqn, start_ts, end_ts):
        self.result_windows.append((start_ts, end_ts))
        return [
            result
            for result in self.existing_results.get(test_case_fqn) or []
            if start_ts <= result.timestamp.root <= end_ts
        ]


def fake_glue(*results: dict) -> MagicMock:
    glue = MagicMock()
    glue.list_data_quality_results.return_value = {"Results": [{"ResultId": r["ResultId"]} for r in results]}
    glue.batch_get_data_quality_result.return_value = {"Results": list(results)}
    glue.list_data_quality_rulesets.return_value = {
        "Rulesets": [{"Name": "orders_ruleset", "Description": "Checks on the orders table"}]
    }
    return glue


def build_source(
    metadata: FakeOpenMetadata,
    glue: MagicMock,
    source_config: dict | None = None,
    connection: dict | None = None,
    **dq_config,
) -> GlueSource:
    config = deepcopy(GLUE_CONFIG)
    config["source"]["serviceConnection"]["config"].update(connection or {})
    config["source"]["serviceConnection"]["config"]["dataQualityConfig"].update(dq_config)
    config["source"]["sourceConfig"]["config"].update(source_config or {})
    with patch.object(GlueSource, "test_connection"):
        source = GlueSource.create(
            OpenMetadataWorkflowConfig.model_validate(config).source.model_dump(),
            metadata,
        )
    source.glue = glue
    source.context.get().__dict__["database_service"] = SERVICE
    return source


def run(source: GlueSource) -> tuple[list, list]:
    """The records the sink receives, less the flush Barrier (asserted on its own)."""
    rights, lefts = [], []
    for either in source.yield_glue_data_quality():
        if isinstance(either.right, Barrier):
            continue
        (rights if either.right is not None else lefts).append(either.right or either.left)
    return rights, lefts


def of_type(records: list, type_: type) -> list:
    return [record for record in records if isinstance(record, type_)]


class TestParseDqdlRule:
    @pytest.mark.parametrize(
        ("rule", "expected"),
        [
            ('IsComplete "order_id"', ParsedRule("IsComplete", "order_id")),
            ('ColumnValues "status" in ["NEW", "PAID"]', ParsedRule("ColumnValues", "status")),
            ('Completeness "order id" > 0.95', ParsedRule("Completeness", "order id")),
            ('IsComplete "order_id" where "amount > 0"', ParsedRule("IsComplete", "order_id")),
            ('ColumnValues "a\\"b" > 1', ParsedRule("ColumnValues", 'a"b')),
            ("RowCount between 10 and 100", ParsedRule("RowCount")),
            ('CustomSql "select count(*) from primary" > 0', ParsedRule("CustomSql")),
            ('IsPrimaryKey "a" "b"', ParsedRule("IsPrimaryKey")),
            ('ColumnCorrelation "a" "b" > 0.8', ParsedRule("ColumnCorrelation")),
            ('(IsComplete "a") and (IsUnique "a")', ParsedRule("Composite")),
        ],
    )
    def test_reads_rule_type_and_single_column(self, rule, expected):
        assert parse_dqdl_rule(rule) == expected


class TestNaming:
    def test_test_case_name_is_stable_and_keyed_on_rule_text(self):
        first = build_test_case_name("orders_ruleset", "IsComplete", 'IsComplete "order_id"')
        assert first == build_test_case_name("orders_ruleset", "IsComplete", 'IsComplete "order_id"')
        assert first != build_test_case_name("orders_ruleset", "IsComplete", 'IsComplete "customer_id"')
        assert first.startswith("orders_ruleset_IsComplete_")

    def test_rulesets_that_normalize_alike_keep_distinct_names(self):
        assert safe_name("orders_check") == "orders_check"
        dotted, spaced = safe_name("orders.check"), safe_name("orders check")
        assert dotted.startswith("orders_check_")
        assert len({"orders_check", dotted, spaced}) == 3

    def test_long_names_are_capped_and_stay_distinct(self):
        first, second = safe_name("r" * 254 + "1"), safe_name("r" * 254 + "2")
        assert first != second
        assert len(first) <= 110

    def test_column_rule_on_a_table_gets_its_own_definition(self):
        assert build_test_definition_name("IsComplete", EntityType.COLUMN) == "glueIsComplete"
        assert build_test_definition_name("IsPrimaryKey", EntityType.TABLE) == "glueIsPrimaryKeyTable"
        assert build_test_definition_name("RowCount", EntityType.TABLE) == "glueRowCount"


class TestResultMapping:
    @pytest.mark.parametrize(
        ("glue_result", "status"),
        [("PASS", TestCaseStatus.Success), ("FAIL", TestCaseStatus.Failed), ("ERROR", TestCaseStatus.Aborted)],
    )
    def test_maps_status(self, glue_result, status):
        result = to_test_case_result(DataQualityRuleResult(Name="Rule_1", Result=glue_result), COMPLETED_ON)
        assert result.testCaseStatus == status
        assert result.timestamp.root == COMPLETED_ON_MS

    def test_carries_message_and_metrics(self):
        result = to_test_case_result(
            DataQualityRuleResult.model_validate(CATALOG_RESULT["RuleResults"][1]),
            COMPLETED_ON,
        )
        assert result.result == "Value: 42 does not meet the constraint requirement!"
        assert [(v.name, v.value) for v in result.testResultValue] == [("Dataset.*.RowCount", "42.0")]

    def test_score_passes_only_when_every_rule_passed(self):
        assert to_score_result(1.0, COMPLETED_ON).testCaseStatus == TestCaseStatus.Success
        assert to_score_result(0.5, COMPLETED_ON).testCaseStatus == TestCaseStatus.Failed


class TestGlueDataQualityClient:
    def test_follows_next_token(self):
        glue = MagicMock()
        glue.list_data_quality_results.side_effect = [
            {"Results": [{"ResultId": "a"}], "NextToken": "t1"},
            {"Results": [{"ResultId": "b"}]},
        ]
        pages = list(GlueDataQualityClient(glue).list_result_id_pages(COMPLETED_ON))
        assert pages == [["a"], ["b"]]
        assert glue.list_data_quality_results.call_args_list[1].kwargs["NextToken"] == "t1"

    def test_batches_result_ids_by_one_hundred(self):
        glue = MagicMock()
        glue.batch_get_data_quality_result.return_value = {"Results": []}
        list(GlueDataQualityClient(glue).get_results(str(i) for i in range(250)))
        sizes = [len(c.kwargs["ResultIds"]) for c in glue.batch_get_data_quality_result.call_args_list]
        assert sizes == [100, 100, 50]

    def test_ruleset_descriptions_keep_only_the_named_rulesets(self):
        glue = MagicMock()
        glue.list_data_quality_rulesets.return_value = {
            "Rulesets": [
                {"Name": "orders_ruleset", "Description": "Checks on orders"},
                {"Name": "other ruleset", "Description": "Not run in this window"},
            ]
        }
        assert GlueDataQualityClient(glue).ruleset_descriptions({"orders_ruleset"}) == {
            "orders_ruleset": "Checks on orders"
        }


class TestYieldGlueDataQuality:
    def test_disabled_yields_nothing_and_calls_no_aws_api(self):
        glue = fake_glue(CATALOG_RESULT)
        source = build_source(FakeOpenMetadata(), glue, includeDataQuality=False)
        assert run(source) == ([], [])
        glue.list_data_quality_results.assert_not_called()

    def test_catalog_result_becomes_test_cases_and_results(self):
        source = build_source(FakeOpenMetadata(), fake_glue(CATALOG_RESULT))
        rights, lefts = run(source)

        assert lefts == []
        definitions = {d.name.root: d for d in of_type(rights, CreateTestDefinitionRequest)}
        assert set(definitions) == {"glueIsComplete", "glueRowCount", "glueRulesetScore"}
        assert definitions["glueIsComplete"].entityType == EntityType.COLUMN
        assert all(d.testPlatforms == [TestPlatform.AWSGlue] for d in definitions.values())

        links = {model_str(c.name): c.entityLink.root for c in of_type(rights, CreateTestCaseRequest)}
        column_case = next(name for name in links if "IsComplete" in name)
        assert links[column_case] == f"<#E::table::{TABLE_FQN}::columns::order_id>"
        assert links["orders_ruleset_score"] == f"<#E::table::{TABLE_FQN}>"

        results = {r.test_case_name: r.test_case_results for r in of_type(rights, OMetaTestCaseResultsSample)}
        assert results[f"{TABLE_FQN}.order_id.{column_case}"].testCaseStatus == TestCaseStatus.Success
        assert results[f"{TABLE_FQN}.orders_ruleset_score"].testCaseStatus == TestCaseStatus.Failed
        assert len(results) == 3

    def test_existing_test_cases_and_runs_are_not_sent_again(self):
        metadata = FakeOpenMetadata()
        score_fqn = f"{TABLE_FQN}.orders_ruleset_score"
        metadata.test_cases[score_fqn] = make_test_case(score_fqn)
        metadata.existing_results[score_fqn] = [
            TestCaseResult(timestamp=Timestamp(COMPLETED_ON_MS), testCaseStatus=TestCaseStatus.Failed)
        ]
        rights, _ = run(build_source(metadata, fake_glue(CATALOG_RESULT)))

        assert "orders_ruleset_score" not in {model_str(c.name) for c in of_type(rights, CreateTestCaseRequest)}
        assert score_fqn not in {r.test_case_name for r in of_type(rights, OMetaTestCaseResultsSample)}

    def test_ruleset_suite_groups_its_test_cases(self):
        metadata = FakeOpenMetadata()
        score_fqn = f"{TABLE_FQN}.orders_ruleset_score"
        metadata.test_cases[score_fqn] = make_test_case(score_fqn)
        rights, _ = run(build_source(metadata, fake_glue(CATALOG_RESULT)))

        (suite,) = of_type(rights, OMetaLogicalTestSuiteSample)
        assert suite.test_suite.displayName == f"AWS Glue DQ - {SERVICE} - orders_ruleset"
        assert suite.test_suite.description.root == "Checks on the orders table"
        assert [model_str(t.fullyQualifiedName) for t in suite.test_cases] == [score_fqn]

    def test_same_ruleset_name_in_two_services_gets_two_suites(self):
        names = set()
        for service in ("dev_glue", "prod_glue"):
            source = build_source(FakeOpenMetadata(), fake_glue(CATALOG_RESULT))
            source.context.get().__dict__["database_service"] = service
            source.metadata.tables = {
                f"{service}.{CATALOG_ID}.sales.orders": make_table(f"{service}.{CATALOG_ID}.sales.orders")
            }
            score_fqn = f"{service}.{CATALOG_ID}.sales.orders.orders_ruleset_score"
            source.metadata.test_cases[score_fqn] = make_test_case(score_fqn)
            rights, _ = run(source)
            names |= {suite.test_suite.name.root for suite in of_type(rights, OMetaLogicalTestSuiteSample)}

        assert names == {"AWS Glue DQ - dev_glue - orders_ruleset", "AWS Glue DQ - prod_glue - orders_ruleset"}

    def test_definition_lookup_that_fails_is_retried_by_the_next_rule_of_its_type(self):
        metadata = FakeOpenMetadata()
        lookup = metadata.get_by_name
        failures = iter([RuntimeError("server unavailable")])

        def flaky_get_by_name(entity, fqn, fields=None):
            if entity is TestDefinition and (failure := next(failures, None)):
                raise failure
            return lookup(entity, fqn, fields)

        metadata.get_by_name = flaky_get_by_name
        next_run = {
            **CATALOG_RESULT,
            "ResultId": "dqresult-next",
            "CompletedOn": datetime(2026, 10, 2, tzinfo=timezone.utc),
        }
        rights, lefts = run(build_source(metadata, fake_glue(CATALOG_RESULT, next_run)))

        assert len(lefts) == 1
        definitions = {d.name.root for d in of_type(rights, CreateTestDefinitionRequest)}
        assert definitions == {"glueIsComplete", "glueRowCount", "glueRulesetScore"}

    def test_etl_mapping_with_an_evaluation_context_matches_only_that_node(self):
        source = build_source(
            FakeOpenMetadata(),
            fake_glue(ETL_RESULT),
            etlJobMappings=[
                {"jobName": "orders_etl", "evaluationContext": "EvaluateDataQuality_node2", "tableFQN": TABLE_FQN}
            ],
        )
        rights, lefts = run(source)

        assert of_type(rights, CreateTestCaseRequest) == []
        (error,) = lefts
        assert "EvaluateDataQuality_node1" in error.error

    def test_result_on_a_data_quality_glue_table_source_resolves_like_a_glue_table(self):
        result = {
            **CATALOG_RESULT,
            "DataSource": {
                "DataQualityGlueTable": {"DatabaseName": "sales", "TableName": "orders", "CatalogId": CATALOG_ID}
            },
        }
        rights, lefts = run(build_source(FakeOpenMetadata(), fake_glue(result)))

        assert lefts == []
        assert len(of_type(rights, OMetaTestCaseResultsSample)) == 3

    def test_result_without_catalog_id_resolves_through_the_schemas_ingestion_listed(self):
        glue = fake_glue(
            {**CATALOG_RESULT, "DataSource": {"GlueTable": {"DatabaseName": "sales", "TableName": "orders"}}}
        )
        glue.get_paginator.return_value.paginate.return_value = [
            {"DatabaseList": [{"Name": "sales", "CatalogId": CATALOG_ID}]}
        ]
        source = build_source(FakeOpenMetadata(), glue)
        source.context.get().__dict__["database"] = CATALOG_ID
        assert list(source.get_database_schema_names()) == ["sales"]

        rights, lefts = run(source)

        assert lefts == []
        assert len(of_type(rights, OMetaTestCaseResultsSample)) == 3

    def test_two_etl_jobs_with_a_same_named_node_keep_separate_histories(self):
        backfill = {**ETL_RESULT, "ResultId": "dqresult-backfill", "JobName": "orders_backfill"}
        backfill["RuleResults"] = [{**ETL_RESULT["RuleResults"][0], "Result": "PASS"}]
        mappings = [{"jobName": job, "tableFQN": TABLE_FQN} for job in ("orders_etl", "orders_backfill")]
        rights, lefts = run(build_source(FakeOpenMetadata(), fake_glue(ETL_RESULT, backfill), etlJobMappings=mappings))

        assert lefts == []
        statuses = {
            r.test_case_name.rsplit(".", 1)[-1]: r.test_case_results.testCaseStatus
            for r in of_type(rights, OMetaTestCaseResultsSample)
            if "IsUnique" in r.test_case_name
        }
        assert len(statuses) == 2
        assert sorted(statuses.values(), key=str) == sorted([TestCaseStatus.Aborted, TestCaseStatus.Success], key=str)

    def test_database_name_replaces_the_catalog_in_the_table_fqn(self):
        result = {**CATALOG_RESULT, "DataSource": {"GlueTable": {"DatabaseName": "sales", "TableName": "orders"}}}
        stored_fqn = f"{SERVICE}.analytics.sales.orders"
        source = build_source(
            FakeOpenMetadata(tables=[make_table(stored_fqn)]),
            fake_glue(result),
            connection={"databaseName": "analytics"},
        )
        rights, lefts = run(source)

        assert lefts == []
        links = [c.entityLink.root for c in of_type(rights, CreateTestCaseRequest)]
        assert links
        assert all(stored_fqn in link for link in links)

    @pytest.mark.parametrize(
        ("pattern", "imported"),
        [({"includes": ["EvaluateDataQuality_node1"]}, True), ({"excludes": ["EvaluateDataQuality_node1"]}, False)],
    )
    def test_ruleset_filter_matches_an_etl_result_by_its_node_name(self, pattern, imported):
        source = build_source(
            FakeOpenMetadata(),
            fake_glue(ETL_RESULT),
            etlJobMappings=[{"jobName": "orders_etl", "tableFQN": TABLE_FQN}],
            rulesetFilterPattern=pattern,
        )
        rights, lefts = run(source)

        assert lefts == []
        assert bool(of_type(rights, OMetaTestCaseResultsSample)) is imported

    def test_lookback_window_bounds_the_glue_listing_and_the_stored_runs_read(self):
        now = datetime.now(timezone.utc)
        recent = now - timedelta(days=2)
        metadata = FakeOpenMetadata()
        score_fqn = f"{TABLE_FQN}.orders_ruleset_score"
        metadata.test_cases[score_fqn] = make_test_case(score_fqn)
        glue = fake_glue({**CATALOG_RESULT, "StartedOn": recent, "CompletedOn": recent})
        run(build_source(metadata, glue, lookbackDays=3))

        started_after = glue.list_data_quality_results.call_args.kwargs["Filter"]["StartedAfter"]
        assert abs(now - timedelta(days=3) - started_after) < timedelta(minutes=1)
        ((start_ts, end_ts),) = metadata.result_windows
        assert abs(start_ts - started_after.timestamp() * 1000) < 1000
        assert abs(end_ts - now.timestamp() * 1000) < 60_000

    def test_etl_result_uses_configured_mapping(self):
        source = build_source(
            FakeOpenMetadata(),
            fake_glue(ETL_RESULT),
            etlJobMappings=[{"jobName": "orders_etl", "tableFQN": TABLE_FQN}],
        )
        rights, lefts = run(source)

        assert lefts == []
        (case,) = of_type(rights, CreateTestCaseRequest)
        assert case.entityLink.root == f"<#E::table::{TABLE_FQN}::columns::order_id>"
        (result,) = of_type(rights, OMetaTestCaseResultsSample)
        assert result.test_case_results.testCaseStatus == TestCaseStatus.Aborted

    def test_unresolved_table_is_reported_and_run_continues(self):
        rights, lefts = run(build_source(FakeOpenMetadata(), fake_glue(ETL_RESULT, CATALOG_RESULT)))

        assert len(lefts) == 1
        assert isinstance(lefts[0], StackTraceError)
        assert "orders_etl" not in str(rights)
        assert len(of_type(rights, OMetaTestCaseResultsSample)) == 3

    def test_unresolved_target_is_reported_once_per_run(self):
        second_run = {
            **ETL_RESULT,
            "ResultId": "dqresult-etl-2",
            "CompletedOn": datetime(2026, 10, 2, tzinfo=timezone.utc),
        }
        _, lefts = run(build_source(FakeOpenMetadata(), fake_glue(ETL_RESULT, second_run)))

        assert len(lefts) == 1
        assert "orders_etl" in lefts[0].error
        assert "2 results" in lefts[0].error

    def test_target_service_resolves_table_by_search(self):
        athena_fqn = "athena.awsdatacatalog.sales.orders"
        metadata = FakeOpenMetadata(tables=[make_table(athena_fqn)])
        metadata.es_search_from_fqn.return_value = [metadata.tables[athena_fqn]]
        rights, lefts = run(build_source(metadata, fake_glue(CATALOG_RESULT), targetServiceName="athena"))

        assert lefts == []
        metadata.es_search_from_fqn.assert_called_once_with(
            entity_type=Table, fqn_search_string="athena.*.sales.orders", raise_on_error=True
        )
        assert all(athena_fqn in c.entityLink.root for c in of_type(rights, CreateTestCaseRequest))

    def test_ruleset_filter_skips_results(self):
        source = build_source(
            FakeOpenMetadata(),
            fake_glue(CATALOG_RESULT),
            rulesetFilterPattern={"excludes": ["orders.*"]},
        )
        assert run(source) == ([], [])

    def test_target_service_with_several_matching_tables_is_reported_not_guessed(self):
        fqns = ["spectrum.dev.sales.orders", "spectrum.prod.sales.orders"]
        metadata = FakeOpenMetadata(tables=[make_table(f) for f in fqns])
        metadata.es_search_from_fqn.return_value = list(metadata.tables.values())
        rights, lefts = run(build_source(metadata, fake_glue(CATALOG_RESULT), targetServiceName="spectrum"))

        assert of_type(rights, CreateTestCaseRequest) == []
        assert of_type(rights, OMetaTestCaseResultsSample) == []
        (error,) = lefts
        assert "2 tables of service [spectrum] match it" in error.error
        assert all(f in error.error for f in fqns)
        assert "targetDatabaseName" in error.error

    def test_target_database_picks_the_table_without_a_search(self):
        fqns = ["spectrum.dev.sales.orders", "spectrum.prod.sales.orders"]
        metadata = FakeOpenMetadata(tables=[make_table(f) for f in fqns])
        source = build_source(
            metadata, fake_glue(CATALOG_RESULT), targetServiceName="spectrum", targetDatabaseName="prod"
        )
        rights, lefts = run(source)

        assert lefts == []
        metadata.es_search_from_fqn.assert_not_called()
        links = [c.entityLink.root for c in of_type(rights, CreateTestCaseRequest)]
        assert links
        assert all("spectrum.prod.sales.orders" in link for link in links)

    def test_target_database_without_the_table_is_reported(self):
        metadata = FakeOpenMetadata(tables=[make_table("spectrum.dev.sales.orders")])
        source = build_source(
            metadata, fake_glue(CATALOG_RESULT), targetServiceName="spectrum", targetDatabaseName="prod"
        )
        rights, lefts = run(source)

        assert of_type(rights, CreateTestCaseRequest) == []
        (error,) = lefts
        assert "table was not found" in error.error

    def test_every_new_run_of_a_rule_is_posted_once(self):
        next_run = {
            **CATALOG_RESULT,
            "ResultId": "dqresult-next",
            "CompletedOn": datetime(2026, 10, 2, tzinfo=timezone.utc),
        }
        replayed = {**CATALOG_RESULT, "ResultId": "dqresult-replayed"}
        rights, _ = run(build_source(FakeOpenMetadata(), fake_glue(CATALOG_RESULT, next_run, replayed)))

        score_fqn = f"{TABLE_FQN}.orders_ruleset_score"
        score_runs = [r for r in of_type(rights, OMetaTestCaseResultsSample) if r.test_case_name == score_fqn]
        assert len(score_runs) == 2
        assert [model_str(c.name) for c in of_type(rights, CreateTestCaseRequest)].count("orders_ruleset_score") == 1

    def test_existing_test_case_gets_only_the_runs_it_does_not_hold(self):
        metadata = FakeOpenMetadata()
        score_fqn = f"{TABLE_FQN}.orders_ruleset_score"
        metadata.test_cases[score_fqn] = make_test_case(score_fqn)
        metadata.existing_results[score_fqn] = [
            TestCaseResult(timestamp=Timestamp(COMPLETED_ON_MS), testCaseStatus=TestCaseStatus.Failed)
        ]
        next_completed = datetime(2026, 10, 2, tzinfo=timezone.utc)
        next_run = {**CATALOG_RESULT, "ResultId": "dqresult-next", "CompletedOn": next_completed}
        rights, _ = run(build_source(metadata, fake_glue(CATALOG_RESULT, next_run)))

        posted = [
            r.test_case_results for r in of_type(rights, OMetaTestCaseResultsSample) if r.test_case_name == score_fqn
        ]
        assert [r.timestamp.root for r in posted] == [int(next_completed.timestamp() * 1000)]

    def test_results_are_posted_before_the_listing_finishes(self):
        glue = fake_glue(CATALOG_RESULT)
        glue.list_data_quality_results.return_value = {
            "Results": [{"ResultId": "dqresult-catalog"}],
            "NextToken": "page-2",
        }
        source = build_source(FakeOpenMetadata(), glue)

        records = source.yield_glue_data_quality()
        first_result = next(e for e in records if isinstance(e.right, OMetaTestCaseResultsSample))

        assert first_result.right.test_case_name.startswith(TABLE_FQN)
        assert glue.list_data_quality_results.call_count == 1

    def test_denied_listing_is_reported_with_the_permission_it_needs(self):
        glue = fake_glue(CATALOG_RESULT)
        glue.list_data_quality_results.side_effect = ClientError(
            {"Error": {"Code": "AccessDeniedException", "Message": "denied"}}, "ListDataQualityResults"
        )
        rights, lefts = run(build_source(FakeOpenMetadata(), glue))

        assert rights == []
        (error,) = lefts
        assert "glue:ListDataQualityResults" in error.error
        assert "AccessDeniedException" in error.error

    def test_failure_mid_listing_keeps_the_results_already_read(self):
        glue = fake_glue(CATALOG_RESULT)
        glue.list_data_quality_results.side_effect = [
            {"Results": [{"ResultId": "dqresult-catalog"}], "NextToken": "page-2"},
            ClientError({"Error": {"Code": "ThrottlingException", "Message": "slow down"}}, "ListDataQualityResults"),
        ]
        rights, lefts = run(build_source(FakeOpenMetadata(), glue))

        assert len(lefts) == 1
        assert "ThrottlingException" in lefts[0].error
        assert "glue:ListDataQualityResults" not in lefts[0].error
        assert len(of_type(rights, OMetaTestCaseResultsSample)) == 3

    def test_filtered_ruleset_is_reported_once(self):
        next_run = {
            **CATALOG_RESULT,
            "ResultId": "dqresult-next",
            "CompletedOn": datetime(2026, 10, 2, tzinfo=timezone.utc),
        }
        source = build_source(
            FakeOpenMetadata(),
            fake_glue(CATALOG_RESULT, next_run),
            rulesetFilterPattern={"excludes": ["orders.*"]},
        )
        run(source)

        assert source.status.filtered == [{"orders_ruleset": "Glue Data Quality ruleset filtered out"}]

    @pytest.mark.parametrize(
        "pipeline_filter",
        [
            {"databaseFilterPattern": {"includes": [CATALOG_ID]}},
            {"schemaFilterPattern": {"includes": ["sales"]}},
            {"tableFilterPattern": {"excludes": ["leads"]}},
        ],
    )
    def test_result_on_a_table_the_pipeline_filters_out_is_skipped_not_failed(self, pipeline_filter):
        leads = {"DatabaseName": "marketing", "TableName": "leads", "CatalogId": "999999999999"}
        out_of_scope = {**CATALOG_RESULT, "ResultId": "dqresult-leads", "DataSource": {"GlueTable": leads}}
        next_run = {
            **out_of_scope,
            "ResultId": "dqresult-leads-2",
            "CompletedOn": datetime(2026, 10, 2, tzinfo=timezone.utc),
        }
        source = build_source(
            FakeOpenMetadata(), fake_glue(CATALOG_RESULT, out_of_scope, next_run), source_config=pipeline_filter
        )
        rights, lefts = run(source)

        assert lefts == []
        assert len(of_type(rights, OMetaTestCaseResultsSample)) == 3
        assert source.status.filtered == [
            {"Glue table [marketing.leads]": "Glue Data Quality result on a table the pipeline filters out"}
        ]

    def test_long_table_name_resolves_to_the_name_ingestion_stored(self):
        long_name = "orders_" + "x" * 150
        stored_fqn = f"{SERVICE}.{CATALOG_ID}.sales.{long_name[:128]}"
        glue_table = {"DatabaseName": "sales", "TableName": long_name, "CatalogId": CATALOG_ID}
        result = {**CATALOG_RESULT, "DataSource": {"GlueTable": glue_table}}
        rights, lefts = run(build_source(FakeOpenMetadata(tables=[make_table(stored_fqn)]), fake_glue(result)))

        assert lefts == []
        results = of_type(rights, OMetaTestCaseResultsSample)
        assert len(results) == 3
        assert all(r.test_case_name.startswith(f"{stored_fqn}.") for r in results)

    def test_result_without_catalog_id_uses_the_catalog_its_schema_was_ingested_from(self):
        result = {**CATALOG_RESULT, "DataSource": {"GlueTable": {"DatabaseName": "sales", "TableName": "orders"}}}
        source = build_source(FakeOpenMetadata(), fake_glue(result))
        source.schema_catalog_ids["sales"] = {CATALOG_ID}
        rights, lefts = run(source)

        assert lefts == []
        assert len(of_type(rights, OMetaTestCaseResultsSample)) == 3

    def test_result_without_catalog_id_on_a_database_in_several_catalogs_is_reported_not_guessed(self):
        result = {**CATALOG_RESULT, "DataSource": {"GlueTable": {"DatabaseName": "sales", "TableName": "orders"}}}
        source = build_source(FakeOpenMetadata(), fake_glue(result))
        source.schema_catalog_ids["sales"] = {CATALOG_ID, "222222222222"}
        rights, lefts = run(source)

        assert of_type(rights, CreateTestCaseRequest) == []
        (error,) = lefts
        assert f"is in catalogs {CATALOG_ID}, 222222222222" in error.error

    def test_result_without_catalog_id_on_a_database_the_pipeline_did_not_ingest_is_filtered(self):
        result = {**CATALOG_RESULT, "DataSource": {"GlueTable": {"DatabaseName": "sales", "TableName": "orders"}}}
        source = build_source(FakeOpenMetadata(), fake_glue(result))
        rights, lefts = run(source)

        assert (rights, lefts) == ([], [])
        assert source.status.filtered == [
            {"Glue table [sales.orders]": "Glue Data Quality result on a Glue database the pipeline did not ingest"}
        ]

    def test_flushes_the_sink_before_resolving_any_table(self):
        metadata = FakeOpenMetadata()
        records = build_source(metadata, fake_glue(CATALOG_RESULT)).yield_glue_data_quality()

        assert isinstance(next(records).right, Barrier)
        assert metadata.table_lookups == []
        assert not any(isinstance(record.right, Barrier) for record in records)
        assert metadata.table_lookups == [TABLE_FQN]

    def test_malformed_result_fails_alone_and_the_run_continues(self):
        null_metric = {
            **CATALOG_RESULT,
            "ResultId": "dqresult-null-metric",
            "RuleResults": [
                {
                    "Name": "Rule_1",
                    "Description": "RowCount > 0",
                    "Result": "PASS",
                    "EvaluatedMetrics": {"Dataset.*.RowCount": None},
                }
            ],
        }
        malformed = {"ResultId": "dqresult-malformed", "RuleResults": [{"Name": "Rule_1"}]}
        next_run = {
            **CATALOG_RESULT,
            "ResultId": "dqresult-next",
            "CompletedOn": datetime(2026, 10, 2, tzinfo=timezone.utc),
        }
        rights, lefts = run(build_source(FakeOpenMetadata(), fake_glue(null_metric, malformed, next_run)))

        (error,) = lefts
        assert error.name == "Glue Data Quality result dqresult-malformed"
        assert "glue:ListDataQualityResults" not in error.error
        results = {r.test_case_results.timestamp.root for r in of_type(rights, OMetaTestCaseResultsSample)}
        assert results == {COMPLETED_ON_MS, int(datetime(2026, 10, 2, tzinfo=timezone.utc).timestamp() * 1000)}
        null_result = next(
            r.test_case_results for r in of_type(rights, OMetaTestCaseResultsSample) if "RowCount" in r.test_case_name
        )
        assert null_result.testResultValue == []

    def test_failed_search_is_reported_as_itself_and_retried_for_the_next_result(self):
        athena_fqn = "athena.awsdatacatalog.sales.orders"
        metadata = FakeOpenMetadata(tables=[make_table(athena_fqn)])
        metadata.es_search_from_fqn.side_effect = [RuntimeError("search is unavailable"), [metadata.tables[athena_fqn]]]
        next_run = {
            **CATALOG_RESULT,
            "ResultId": "dqresult-next",
            "CompletedOn": datetime(2026, 10, 2, tzinfo=timezone.utc),
        }
        rights, lefts = run(build_source(metadata, fake_glue(CATALOG_RESULT, next_run), targetServiceName="athena"))

        (error,) = lefts
        assert "search is unavailable" in error.error
        assert "not found" not in error.error
        assert len(of_type(rights, OMetaTestCaseResultsSample)) == 3


def test_two_glue_sources_keep_their_own_topology_context():
    first, second = object.__new__(GlueSource), object.__new__(GlueSource)

    assert first.context is not second.context
    first.context.get().__dict__["database_service"] = "glue_a"
    assert second.context.get().__dict__.get("database_service") != "glue_a"


def test_a_ruleset_name_at_glues_maximum_still_gets_its_suite():
    long_ruleset = "r" * 255
    metadata = FakeOpenMetadata()
    long_score_fqn = f"{TABLE_FQN}.{safe_name(long_ruleset)}_score"
    score_fqn = f"{TABLE_FQN}.orders_ruleset_score"
    metadata.test_cases.update({fqn: make_test_case(fqn) for fqn in (long_score_fqn, score_fqn)})
    long_run = {**CATALOG_RESULT, "ResultId": "dqresult-long", "RulesetName": long_ruleset}
    rights, lefts = run(build_source(metadata, fake_glue(CATALOG_RESULT, long_run)))

    assert lefts == []
    suites = of_type(rights, OMetaLogicalTestSuiteSample)
    assert len(suites) == 2
    assert all(len(suite.test_suite.name.root) <= 256 for suite in suites)


def test_data_quality_runs_after_every_inherited_post_process_step():
    inherited = DatabaseServiceTopology.model_fields["root"].default.post_process
    assert GlueSource.topology.root.post_process == [*inherited, "yield_glue_data_quality"]
