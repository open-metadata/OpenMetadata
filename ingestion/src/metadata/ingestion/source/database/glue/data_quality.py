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
AWS Glue Data Quality ingestion.

Every DQDL rule a Glue evaluation reports becomes an OpenMetadata test case on the
evaluated table (or column), and every evaluation run becomes a test case result.
"""

from __future__ import annotations

import hashlib
import re
import traceback
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any

from botocore.exceptions import ClientError

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import (
    CreateTestSuiteRequest,
    TestSuiteEntityName,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestCaseParameterDefinition,
    TestDataType,
    TestDefinition,
    TestPlatform,
)
from metadata.generated.schema.type.basic import (
    EntityLink,
    FullyQualifiedEntityName,
    Markdown,
    TestCaseEntityName,
    Timestamp,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.tests_data import (
    OMetaLogicalTestSuiteSample,
    OMetaTestCaseResultsSample,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.glue.connection import (
    DATA_QUALITY_PERMISSIONS,
    GlueFilters,
)
from metadata.ingestion.source.database.glue.models import (
    DataQualityResult,
    DataQualityRuleResult,
    GlueDataQualityTable,
)
from metadata.utils import fqn
from metadata.utils.entity_link import get_entity_link
from metadata.utils.filters import filter_by_fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache
from metadata.utils.time_utils import datetime_to_timestamp

if TYPE_CHECKING:
    from collections.abc import Collection, Iterable, Iterator

    from metadata.generated.schema.entity.services.connections.database.glue.glueDataQualityConfig import (
        GlueDataQualityConfiguration,
    )
    from metadata.generated.schema.entity.services.connections.database.glueConnection import (
        GlueConnection,
    )
    from metadata.ingestion.api.status import Status
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

logger = ingestion_logger()

# BatchGetDataQualityResult accepts at most 100 result IDs per call.
BATCH_GET_LIMIT = 100
LIST_PAGE_SIZE = 1000
CACHE_SIZE = 1000
ACCESS_DENIED_CODES = frozenset({"AccessDenied", "AccessDeniedException"})
NAME_PART_MAX_LENGTH = 100
# Without them the server omits fields the client's TestCase model requires.
TEST_CASE_FIELDS = ["testDefinition", "testSuite"]

TABLE_NOT_FOUND = (
    "its OpenMetadata table was not found. Ingest the table first or, for an ETL job,"
    " add it to dataQualityConfig.etlJobMappings"
)

RULE_PARAMETER = "rule"
SCORE_RULE_TYPE = "RulesetScore"
COMPOSITE_RULE_TYPE = "Composite"

# DQDL rules whose first argument is a single column. Any other rule - and any of these
# naming several columns - evaluates the table as a whole.
COLUMN_RULE_TYPES = frozenset(
    {
        "ColumnDataType",
        "ColumnExists",
        "ColumnLength",
        "ColumnValues",
        "Completeness",
        "DataFreshness",
        "DistinctValuesCount",
        "Entropy",
        "IsComplete",
        "IsPrimaryKey",
        "IsUnique",
        "Mean",
        "StandardDeviation",
        "Sum",
        "UniqueValueRatio",
        "Uniqueness",
    }
)

GLUE_STATUS = {
    "PASS": TestCaseStatus.Success,
    "FAIL": TestCaseStatus.Failed,
    "ERROR": TestCaseStatus.Aborted,
}

# A rule type, then optionally its first quoted argument, then whether a second
# quoted argument follows directly (a multi-column rule such as ColumnCorrelation).
_RULE_PATTERN = re.compile(r'^\s*(?P<type>\w+)(?:\s+"(?P<column>(?:[^"\\]|\\.)*)"(?P<more>\s+")?)?')
_UNSAFE_NAME_CHARS = re.compile(r"[^A-Za-z0-9_-]+")


@dataclass(frozen=True)
class ParsedRule:
    rule_type: str
    column: str | None = None


def parse_dqdl_rule(rule: str) -> ParsedRule:
    """Read the rule type and, for single-column rules, the column it evaluates."""
    match = _RULE_PATTERN.match(rule)
    if not match:
        # Composite rules start with "(": `(IsComplete "a") and (IsUnique "a")`.
        return ParsedRule(rule_type=COMPOSITE_RULE_TYPE)
    rule_type = match.group("type")
    column = match.group("column")
    if rule_type not in COLUMN_RULE_TYPES or column is None or match.group("more"):
        return ParsedRule(rule_type=rule_type)
    return ParsedRule(rule_type=rule_type, column=column.replace('\\"', '"'))


def natural_entity_type(rule_type: str) -> EntityType:
    return EntityType.COLUMN if rule_type in COLUMN_RULE_TYPES else EntityType.TABLE


def build_test_definition_name(rule_type: str, entity_type: EntityType) -> str:
    """One definition per DQDL rule type. A column rule applied to a whole table gets
    its own definition, since a definition is bound to a single entity type."""
    name = f"glue{rule_type}"
    if entity_type != natural_entity_type(rule_type):
        name += entity_type.value.title()
    return name


def safe_name(value: str) -> str:
    """`value` as a name part. When replacing unsafe characters changes it, or it runs past
    NAME_PART_MAX_LENGTH, a hash of the raw value keeps two distinct values from sharing a
    name, and so a history; capped parts keep suite names within their 256 characters."""
    safe = _UNSAFE_NAME_CHARS.sub("_", value).strip("_") or "glue"
    if safe == value and len(safe) <= NAME_PART_MAX_LENGTH:
        return safe
    digest = hashlib.sha1(value.encode("utf-8"), usedforsecurity=False).hexdigest()[:8]
    return f"{safe[:NAME_PART_MAX_LENGTH]}_{digest}"


def build_test_case_name(scope: str, rule_type: str, rule: str) -> str:
    """Keyed on the rule text, not Glue's positional `Rule_N`, so editing a ruleset
    neither renames nor swaps the history of the rules left untouched."""
    digest = hashlib.sha1(rule.encode("utf-8"), usedforsecurity=False).hexdigest()[:8]
    return f"{safe_name(scope)}_{rule_type}_{digest}"


def score_test_case_name(scope: str) -> str:
    return f"{safe_name(scope)}_score"


def to_test_case_result(rule_result: DataQualityRuleResult, finished_at: datetime) -> TestCaseResult:
    status = GLUE_STATUS.get(rule_result.Result.upper(), TestCaseStatus.Aborted)
    return TestCaseResult(
        timestamp=Timestamp(datetime_to_timestamp(finished_at, milliseconds=True)),
        testCaseStatus=status,
        result=rule_result.EvaluationMessage or f"Rule {rule_result.Result.upper()}",
        testResultValue=[
            TestResultValue(name=name, value=str(value))
            for name, value in (rule_result.EvaluatedMetrics or {}).items()
            if value is not None
        ],
    )


def to_score_result(score: float, finished_at: datetime) -> TestCaseResult:
    passed = score >= 1.0
    return TestCaseResult(
        timestamp=Timestamp(datetime_to_timestamp(finished_at, milliseconds=True)),
        testCaseStatus=TestCaseStatus.Success if passed else TestCaseStatus.Failed,
        result=f"Data quality score: {score:.2%}",
        testResultValue=[TestResultValue(name="score", value=str(score))],
    )


def _definition_request(name: str, entity_type: EntityType) -> CreateTestDefinitionRequest:
    """Every parameter a test case sends must be declared: the server validates them
    for every platform but Great Expectations."""
    return CreateTestDefinitionRequest(
        name=TestCaseEntityName(name),
        displayName=f"AWS Glue {name.removeprefix('glue')}",
        description=Markdown("Rule evaluated by AWS Glue Data Quality."),
        entityType=entity_type,
        testPlatforms=[TestPlatform.AWSGlue],
        parameterDefinition=[
            TestCaseParameterDefinition(
                name=RULE_PARAMETER,
                displayName="DQDL Rule",
                dataType=TestDataType.STRING,
                required=False,
                description=Markdown("The DQDL rule as evaluated by AWS Glue."),
            )
        ],
    )


def _evaluated_target(result: DataQualityResult) -> str:
    source = result.DataSource.table if result.DataSource else None
    if source:
        return f"Glue table [{source.DatabaseName}.{source.TableName}]"
    return f"ETL job [{result.JobName}] node [{result.EvaluationContext}]"


@dataclass
class _Unresolved:
    reason: str
    count: int = 0


def _unresolved_errors(unresolved: dict[str, _Unresolved]) -> Iterable[Either]:
    """One error per evaluated target, not per run: a daily job left unmapped would
    otherwise report the same failure hundreds of times."""
    for target, skipped in unresolved.items():
        yield Either(
            right=None,
            left=StackTraceError(
                name=f"Glue Data Quality {target}",
                error=f"Skipped {skipped.count} results of {target}: {skipped.reason}.",
            ),
        )


def _listing_error(exc: Exception) -> StackTraceError:
    # Only a denial is fixed by granting permissions; naming them for a throttle would mislead.
    denied = isinstance(exc, ClientError) and exc.response.get("Error", {}).get("Code") in ACCESS_DENIED_CODES
    hint = f" Data Quality ingestion needs {DATA_QUALITY_PERMISSIONS}." if denied else ""
    return StackTraceError(
        name="Glue Data Quality results",
        error=f"Could not read Glue Data Quality results, so the remaining results were skipped: {exc}.{hint}",
        stackTrace=traceback.format_exc(),
    )


class GlueDataQualityClient:
    """Reads Glue Data Quality results. None of these operations has a boto3
    paginator, so each listing follows NextToken by hand."""

    def __init__(self, glue: Any) -> None:
        self._glue = glue

    def _pages(self, operation: str, key: str, **kwargs: Any) -> Iterator[list[dict]]:
        call = getattr(self._glue, operation)
        next_token = None
        while True:
            page = call(**kwargs, **({"NextToken": next_token} if next_token else {}))
            yield page.get(key, [])
            next_token = page.get("NextToken")
            if not next_token:
                return

    def _paginate(self, operation: str, key: str, **kwargs: Any) -> Iterator[dict]:
        for page in self._pages(operation, key, **kwargs):
            yield from page

    def list_result_id_pages(self, started_after: datetime) -> Iterator[list[str]]:
        for page in self._pages(
            "list_data_quality_results",
            "Results",
            Filter={"StartedAfter": started_after},
            MaxResults=LIST_PAGE_SIZE,
        ):
            yield [description["ResultId"] for description in page]

    def list_results(self, started_after: datetime) -> Iterator[dict[str, Any]]:
        """Each listing page is fetched in full before the next one is requested, so a
        failure on a later page keeps every result of the earlier ones. Results come back
        unparsed, so one malformed result fails only itself."""
        for result_ids in self.list_result_id_pages(started_after):
            yield from self.get_results(result_ids)

    def get_results(self, result_ids: Iterable[str]) -> Iterator[dict[str, Any]]:
        batch: list[str] = []
        for result_id in result_ids:
            batch.append(result_id)
            if len(batch) == BATCH_GET_LIMIT:
                yield from self._batch_get(batch)
                batch = []
        if batch:
            yield from self._batch_get(batch)

    def _batch_get(self, result_ids: list[str]) -> Iterator[dict[str, Any]]:
        response = self._glue.batch_get_data_quality_result(ResultIds=result_ids)
        missing = response.get("ResultsNotFound") or []
        if missing:
            logger.debug("Glue Data Quality results no longer available: %s", missing)
        yield from response.get("Results", [])

    def ruleset_descriptions(self, names: Collection[str]) -> dict[str, str]:
        """Descriptions of the named rulesets only, so the result is bounded by this run's
        suites rather than by every ruleset in the region."""
        return {
            ruleset["Name"]: ruleset["Description"]
            for ruleset in self._paginate("list_data_quality_rulesets", "Rulesets", MaxResults=LIST_PAGE_SIZE)
            if ruleset.get("Description") and ruleset["Name"] in names
        }


@dataclass
class _RunState:
    config: GlueDataQualityConfiguration
    start_ts: int
    end_ts: int
    # The table, or why it could not be resolved.
    tables: LRUCache[Table | str] = field(default_factory=lambda: LRUCache(CACHE_SIZE))
    definitions: LRUCache[bool] = field(default_factory=lambda: LRUCache(CACHE_SIZE))
    # Run timestamps each test case already holds within the lookback window.
    seen_runs: LRUCache[set[int]] = field(default_factory=lambda: LRUCache(CACHE_SIZE))
    suites: dict[str, set[str]] = field(default_factory=dict)
    unresolved: dict[str, _Unresolved] = field(default_factory=dict)
    filtered: set[str] = field(default_factory=set)


class GlueDataQualityMixin:
    """Adds Glue Data Quality ingestion to the Glue source. Runs as a topology
    post-process, once every table it may reference has been ingested."""

    metadata: OpenMetadata
    glue: Any
    status: Status
    service_connection: GlueConnection
    context: Any
    glue_filters: GlueFilters
    schema_catalog_ids: dict[str, set[str]]

    if TYPE_CHECKING:
        # Declared for type checking only: defined here, it would shadow GlueSource's implementation.
        def standardize_table_name(self, _: str, table: str) -> str: ...

    def yield_glue_data_quality(self) -> Iterable[Either]:
        config: GlueDataQualityConfiguration | None = self.service_connection.dataQualityConfig
        if not config or not config.includeDataQuality:
            return

        client = GlueDataQualityClient(self.glue)
        now = datetime.now(timezone.utc)
        started_after = now - timedelta(days=config.lookbackDays or 7)
        run = _RunState(
            config=config,
            start_ts=datetime_to_timestamp(started_after, milliseconds=True),
            end_ts=datetime_to_timestamp(now, milliseconds=True),
        )

        # The bulk sink may still hold the tables this run created; they must exist before results resolve them.
        yield Either(right=Barrier(reason="glue_data_quality"))  # pyright: ignore[reportCallIssue]
        try:
            for raw_result in client.list_results(started_after):
                try:
                    yield from self._process_dq_result(DataQualityResult.model_validate(raw_result), run)
                except Exception as exc:
                    yield Either(
                        right=None,
                        left=StackTraceError(
                            name=f"Glue Data Quality result {raw_result.get('ResultId')}",
                            error=f"Unexpected error processing Glue Data Quality result: {exc}",
                            stackTrace=traceback.format_exc(),
                        ),
                    )
        except Exception as exc:
            yield Either(right=None, left=_listing_error(exc))

        yield from _unresolved_errors(run.unresolved)
        yield from self._yield_ruleset_suites(run.suites, client)

    def _process_dq_result(self, result: DataQualityResult, run: _RunState) -> Iterable[Either]:
        scope = result.scope
        finished_at = result.finished_at
        if not scope or not finished_at:
            logger.debug("Skipping Glue Data Quality result %s: no ruleset or run time", result.ResultId)
            return
        if filter_by_fqn(run.config.rulesetFilterPattern, result.filter_name or scope):
            self._report_filtered(run, scope, "Glue Data Quality ruleset filtered out")
            return
        if self._skip_out_of_scope(result, run):
            return

        table = self._resolve_dq_table(result, run)
        if isinstance(table, str):
            run.unresolved.setdefault(_evaluated_target(result), _Unresolved(reason=table)).count += 1
            return

        table_fqn = model_str(table.fullyQualifiedName)
        column_names = {model_str(column.name) for column in table.columns or []}

        for rule_result in result.RuleResults or []:
            rule = rule_result.rule
            parsed = parse_dqdl_rule(rule)
            column = parsed.column if parsed.column in column_names else None
            entity_type = EntityType.COLUMN if column else EntityType.TABLE
            name = build_test_case_name(scope, parsed.rule_type, rule)
            definition = build_test_definition_name(parsed.rule_type, entity_type)
            test_case_fqn = fqn._build(*fqn.split(table_fqn), *([column] if column else []), name)
            yield from self._ensure_test_case(
                run,
                test_case_fqn,
                scope=scope,
                definition=definition,
                entity_type=entity_type,
                request=CreateTestCaseRequest(
                    name=TestCaseEntityName(name),
                    displayName=rule,
                    description=Markdown(rule_result.rule_description) if rule_result.rule_description else None,
                    testDefinition=FullyQualifiedEntityName(definition),
                    entityLink=EntityLink(get_entity_link(Table, fqn=table_fqn, column_name=column)),
                    parameterValues=[TestCaseParameterValue(name=RULE_PARAMETER, value=rule)],
                ),
            )
            yield from self._yield_new_result(run, test_case_fqn, to_test_case_result(rule_result, finished_at))

        if result.Score is not None:
            name = score_test_case_name(scope)
            test_case_fqn = fqn._build(*fqn.split(table_fqn), name)
            definition = build_test_definition_name(SCORE_RULE_TYPE, EntityType.TABLE)
            yield from self._ensure_test_case(
                run,
                test_case_fqn,
                scope=scope,
                definition=definition,
                entity_type=EntityType.TABLE,
                request=CreateTestCaseRequest(
                    name=TestCaseEntityName(name),
                    displayName=f"{scope} score",
                    description=Markdown(f"Share of the rules in AWS Glue Data Quality ruleset [{scope}] that passed."),
                    testDefinition=FullyQualifiedEntityName(definition),
                    entityLink=EntityLink(get_entity_link(Table, fqn=table_fqn)),
                ),
            )
            yield from self._yield_new_result(run, test_case_fqn, to_score_result(result.Score, finished_at))

    def _ensure_test_case(
        self,
        run: _RunState,
        test_case_fqn: str,
        *,
        scope: str,
        definition: str,
        entity_type: EntityType,
        request: CreateTestCaseRequest,
    ) -> Iterable[Either]:
        """Emit the definition and test case create requests the first time a rule is
        seen in this run; the sink writes them before any result is posted."""
        run.suites.setdefault(scope, set()).add(test_case_fqn)
        if test_case_fqn in run.seen_runs:
            return

        if definition not in run.definitions:
            # Marked only once handled: after a failed lookup the next rule of the type must retry it.
            if not self.metadata.get_by_name(entity=TestDefinition, fqn=definition):
                yield Either(left=None, right=_definition_request(definition, entity_type))
            run.definitions.put(definition, True)

        if self.metadata.get_by_name(entity=TestCase, fqn=test_case_fqn, fields=TEST_CASE_FIELDS):
            existing = self.metadata.get_test_case_results(test_case_fqn, run.start_ts, run.end_ts) or []
            run.seen_runs.put(test_case_fqn, {result.timestamp.root for result in existing})
        else:
            run.seen_runs.put(test_case_fqn, set())
            yield Either(left=None, right=request)

    @staticmethod
    def _yield_new_result(run: _RunState, test_case_fqn: str, result: TestCaseResult) -> Iterable[Either]:
        """Lookback windows of consecutive runs overlap: post only the runs the test
        case does not hold yet. The server keeps the newest run as the current
        result whatever the posting order."""
        seen = run.seen_runs.get(test_case_fqn)
        if result.timestamp.root in seen:
            return
        seen.add(result.timestamp.root)
        yield Either(
            left=None, right=OMetaTestCaseResultsSample(test_case_results=result, test_case_name=test_case_fqn)
        )

    def _resolve_dq_table(self, result: DataQualityResult, run: _RunState) -> Table | str:
        table_fqn = self._dq_table_fqn(result, run.config)
        if table_fqn is None:
            return TABLE_NOT_FOUND
        if table_fqn not in run.tables:
            run.tables.put(table_fqn, self._fetch_dq_table(table_fqn, run.config))
        return run.tables.get(table_fqn)

    def _dq_table_fqn(self, result: DataQualityResult, config: GlueDataQualityConfiguration) -> str | None:
        source = result.DataSource.table if result.DataSource else None
        if source is None:
            return self._mapped_etl_table(result, config)
        if config.targetServiceName:
            # The database level differs per engine (awsdatacatalog for Athena, the
            # cluster database for Redshift Spectrum), so unless configured it is left to a search.
            database = config.targetDatabaseName or "*"
            return fqn._build(config.targetServiceName, database, source.DatabaseName, source.TableName)
        # Name the table exactly as GlueSource ingested it, or the lookup misses it.
        return fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.context.get().database_service,
            database_name=self.service_connection.databaseName or self._catalog_of(source),
            schema_name=source.DatabaseName,
            table_name=self.standardize_table_name(source.DatabaseName, source.TableName),
            skip_es_search=True,
        )

    def _catalog_of(self, source: GlueDataQualityTable) -> str | None:
        """The catalog the evaluated table was ingested from. CatalogId is optional in a
        result; the Glue database's catalog stands in only when one ingested catalog holds it."""
        if source.CatalogId:
            return source.CatalogId
        catalogs = self.schema_catalog_ids.get(source.DatabaseName, set())
        return next(iter(catalogs)) if len(catalogs) == 1 else None

    def _skip_out_of_scope(self, result: DataQualityResult, run: _RunState) -> bool:
        """Report and skip a result on a Glue table this pipeline does not ingest: it cannot
        resolve, and failing it would mark a pipeline scoped on purpose as failed. Mapped ETL
        results name their table explicitly, so they are kept."""
        source = result.DataSource.table if result.DataSource else None
        if source is None:
            return False
        target = _evaluated_target(result)
        catalog = self._catalog_of(source)
        if catalog is None and not self.service_connection.databaseName:
            catalogs = sorted(self.schema_catalog_ids.get(source.DatabaseName, set()))
            if catalogs:
                reason = f"the result names no catalog and Glue database [{source.DatabaseName}] is in catalogs {', '.join(catalogs)}"
                run.unresolved.setdefault(target, _Unresolved(reason=reason)).count += 1
            else:
                self._report_filtered(
                    run, target, "Glue Data Quality result on a Glue database the pipeline did not ingest"
                )
            return True
        database = {"Name": source.DatabaseName, "CatalogId": catalog}
        if self.glue_filters.excludes_database(database) or self.glue_filters.excludes_table(
            database, source.TableName
        ):
            self._report_filtered(run, target, "Glue Data Quality result on a table the pipeline filters out")
            return True
        return False

    def _report_filtered(self, run: _RunState, target: str, reason: str) -> None:
        if target not in run.filtered:
            run.filtered.add(target)
            self.status.filter(target, reason)

    @staticmethod
    def _mapped_etl_table(result: DataQualityResult, config: GlueDataQualityConfiguration) -> str | None:
        for mapping in config.etlJobMappings or []:
            if mapping.jobName != result.JobName:
                continue
            if mapping.evaluationContext and mapping.evaluationContext != result.EvaluationContext:
                continue
            return mapping.tableFQN
        return None

    def _fetch_dq_table(self, table_fqn: str, config: GlueDataQualityConfiguration) -> Table | str:
        if config.targetServiceName and "*" in fqn.split(table_fqn):
            # A failed search must surface as itself: reported as "not found", it would be
            # cached and drop every result for the table this run.
            hits = self.metadata.es_search_from_fqn(entity_type=Table, fqn_search_string=table_fqn, raise_on_error=True)
            found = [table for table in hits or [] if table is not None]
            if len(found) > 1:
                # Attaching to the first hit would put the test cases on an arbitrary table.
                matches = ", ".join(sorted(model_str(table.fullyQualifiedName) for table in found))
                return (
                    f"{len(found)} tables of service [{config.targetServiceName}] match it ({matches})."
                    " Set dataQualityConfig.targetDatabaseName to pick the database"
                )
            if not found:
                return TABLE_NOT_FOUND
            table_fqn = model_str(found[0].fullyQualifiedName)
        return self.metadata.get_by_name(entity=Table, fqn=table_fqn, fields=["columns"]) or TABLE_NOT_FOUND

    def _yield_ruleset_suites(self, suites: dict[str, set[str]], client: GlueDataQualityClient) -> Iterable[Either]:
        """Group each ruleset's test cases, across every table it runs on, in a logical suite."""
        if not suites:
            return

        try:
            descriptions = client.ruleset_descriptions(suites.keys())
        except Exception as exc:
            logger.warning("Could not list Glue Data Quality rulesets, using default suite descriptions: %s", exc)
            descriptions = {}

        # Suites are global; the service keeps two accounts' same-named rulesets apart.
        service = self.context.get().database_service
        for scope, test_case_fqns in suites.items():
            try:
                yield from self._ruleset_suite(service, scope, test_case_fqns, descriptions.get(scope))
            except Exception as exc:
                yield Either(
                    right=None,
                    left=StackTraceError(
                        name=f"Glue Data Quality suite [{scope}]",
                        error=f"Could not group the test cases of ruleset [{scope}] in a suite: {exc}",
                        stackTrace=traceback.format_exc(),
                    ),
                )

    def _ruleset_suite(
        self, service: str, scope: str, test_case_fqns: set[str], description: str | None
    ) -> Iterable[Either]:
        test_cases = [
            test_case
            for test_case_fqn in sorted(test_case_fqns)
            if (test_case := self.metadata.get_by_name(entity=TestCase, fqn=test_case_fqn, fields=TEST_CASE_FIELDS))
        ]
        if not test_cases:
            return
        yield Either(
            left=None,
            right=OMetaLogicalTestSuiteSample(
                test_suite=CreateTestSuiteRequest(
                    name=TestSuiteEntityName(f"AWS Glue DQ - {safe_name(service)} - {safe_name(scope)}"),
                    displayName=f"AWS Glue DQ - {service} - {scope}",
                    description=Markdown(description or f"Test cases of AWS Glue Data Quality ruleset [{scope}]."),
                ),
                test_cases=test_cases,
            ),
        )
