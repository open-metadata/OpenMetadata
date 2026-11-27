#  Copyright 2026 Collate
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
Pipeline run status, pipeline tasks and lineage built from OpenLineage run events.

The events in openlineage_spark_runs.json were produced by real PySpark jobs with
openlineage-spark 1.55.0, with names and run ids replaced by placeholders. Each run
holds one application event pair (no parent facet) and the SQL-job events Spark
emits under it; the failed run's only FAIL is on a SQL job, and its application
still ends with COMPLETE.
"""

import copy
import json
from itertools import zip_longest
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch
from uuid import NAMESPACE_URL, UUID, uuid5

import pytest

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, PipelineStatus, StatusType, Task
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.ingestion.source.pipeline.openlineage import metadata as openlineage_metadata
from metadata.ingestion.source.pipeline.openlineage.metadata import OpenlineageSource, known_pipeline_weight
from metadata.ingestion.source.pipeline.openlineage.run_status import RUN_KEY_WINDOW_MS
from metadata.ingestion.source.pipeline.openlineage.utils import (
    message_to_open_lineage_event,
)
from metadata.utils.fqn import build as build_fqn

DATASETS = Path(__file__).parent.parent.parent / "resources/datasets"
with open(DATASETS / "openlineage_spark_runs.json") as runs_file:  # noqa: PTH123
    SPARK_RUNS = json.load(runs_file)
# Real Airflow 3.3.2 events (apache-airflow-providers-openlineage 2.20.1): a DAG run whose
# second task fails, once with the default task facet and once with include_full_task_info,
# and a DAG run whose first task fails twice and passes on its third try (retries=2).
with open(DATASETS / "openlineage_airflow_runs.json") as runs_file:  # noqa: PTH123
    AIRFLOW_RUNS = json.load(runs_file)

SOURCE_CONFIG = {
    "type": "openlineage",
    "serviceName": "openlineage_source",
    "serviceConnection": {
        "config": {
            "type": "OpenLineage",
            "brokerConfig": {
                "brokersUrl": "broker:9092",
                "topicName": "openlineage",
                "consumerGroupName": "openlineage",
            },
        }
    },
    "sourceConfig": {
        "config": {
            "type": "PipelineMetadata",
            "includeOwners": False,
            "lineageInformation": {"dbServiceNames": ["shop_db"]},
        }
    },
}

TABLE_IDS = {
    "shop_db.shop.public.orders": UUID("aaaa1111-1111-1111-1111-111111111111"),
    "shop_db.shop.public.report": UUID("bbbb2222-2222-2222-2222-222222222222"),
}


def pipeline_id(pipeline_fqn: str) -> UUID:
    return uuid5(NAMESPACE_URL, pipeline_fqn)


def written_fqn(request) -> str:
    """The FQN the server gives a written pipeline: its name is quoted when it holds a dot."""
    return build_fqn(None, Pipeline, service_name=request.service.root, pipeline_name=request.name.root)


class FakeServer:
    """The OpenMetadata state the connector reads back: tables, pipeline tasks and status rows."""

    def __init__(self):
        self.pipeline_tasks: dict[str, list] = {}
        self.pipeline_requests: dict = {}
        self.statuses: dict[tuple[str, int], PipelineStatus] = {}

    def get_by_name(self, entity, fqn, **kwargs):
        if entity is Table and fqn in TABLE_IDS:
            table = Mock(columns=[])
            table.id.root = TABLE_IDS[fqn]
            table.fullyQualifiedName.root = fqn
            return table
        if entity is Pipeline and fqn in self.pipeline_tasks:
            request = self.pipeline_requests.get(fqn)
            pipeline = Mock(tasks=self.pipeline_tasks[fqn], startDate=request.startDate if request else None)
            pipeline.id = Uuid(pipeline_id(fqn))
            pipeline.fullyQualifiedName.root = fqn
            return pipeline
        return None

    def es_search_from_fqn(self, entity_type, fqn_search_string, **kwargs):
        """Pipelines matching a ``*.<name>`` search in any service."""
        name = fqn_search_string.removeprefix("*.")
        return [self.get_by_name(entity_type, fqn) for fqn in self.pipeline_tasks if fqn.endswith(f".{name}")]

    def store_status(self, fqn: str, status: PipelineStatus):
        """Keep a row the way the server returns it: with the input and output lists it defaults."""
        lines = [line.model_copy(update={"inputs": [], "outputs": []}) for line in status.taskStatus or []]
        self.statuses[(fqn, status.timestamp.root)] = status.model_copy(
            update={"inputs": [], "outputs": [], "taskStatus": lines}
        )

    def list_pipeline_statuses(self, fqn, start_ts, end_ts, limit=None):
        rows = [row for (row_fqn, ts), row in self.statuses.items() if row_fqn == fqn and start_ts <= ts <= end_ts]
        return rows[:limit]


@pytest.fixture
def server():
    return FakeServer()


@pytest.fixture
def source(server):
    metadata = MagicMock()
    metadata.get_by_name.side_effect = server.get_by_name
    metadata.es_search_from_fqn.side_effect = server.es_search_from_fqn
    metadata.list_pipeline_statuses.side_effect = server.list_pipeline_statuses
    metadata.client.get.return_value = {"serviceType": "Postgres"}
    metadata.get_lineage_by_id.return_value = None
    with (
        patch("metadata.ingestion.source.pipeline.openlineage.connection.KafkaConsumer"),
        patch("metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"),
    ):
        ol_source = OpenlineageSource.create(SOURCE_CONFIG, metadata)
        ol_source.prepare()
        with ol_source._connection:
            yield ol_source


def event(run: str, index: int, **overrides):
    raw = copy.deepcopy({**SPARK_RUNS, **AIRFLOW_RUNS}[run][index])
    raw.update(overrides)
    return message_to_open_lineage_event(raw)


@pytest.mark.parametrize(
    "event_type, writes_lineage",
    [("COMPLETE", True), ("FAIL", False), ("ABORT", False)],
)
def test_only_events_of_runs_that_did_not_fail_write_lineage(source, server, event_type, writes_lineage):
    """The SQL job writing shop.public.report: its datasets become lineage only on START, RUNNING and COMPLETE."""
    write_event = event("failed_run", 6, eventType=event_type)
    for result in source.yield_pipeline(write_event):
        server.pipeline_tasks[written_fqn(result.right)] = result.right.tasks or []
    source.context.get().pipeline = source.get_pipeline_name(write_event)

    edges = [
        (result.right.edge.fromEntity.id.root, result.right.edge.toEntity.id.root)
        for result in source.yield_pipeline_lineage_details(write_event)
        if isinstance(result.right, AddLineageRequest)
    ]

    expected = [(TABLE_IDS["shop_db.shop.public.orders"], TABLE_IDS["shop_db.shop.public.report"])]
    assert edges == (expected if writes_lineage else [])


OK_RUN_ID = "01a1e86d-dc26-7000-8000-000000000001"
OK_RUN_KEY = 1794900876326
FAILED_RUN_ID = "01a1e86e-0e08-7000-8000-000000000004"
FAILED_RUN_KEY = 1794900889096
OK_PIPELINE = "spark_openlineage.spark_jobs-orders_app"
FAILED_PIPELINE = "spark_openlineage.spark_jobs-report_app"
UUID4_RUN_ID = "1b4e28ba-2fa1-4d2b-883f-0016d3cca427"


def ingest(source, server, events):
    """Runs events through the pipeline and status stages in topology order, storing what the sink writes."""
    results = []
    for ol_event in events:
        for result in source.yield_pipeline(ol_event):
            pipeline_fqn = written_fqn(result.right)
            server.pipeline_tasks[pipeline_fqn] = result.right.tasks or []
            server.pipeline_requests[pipeline_fqn] = result.right
        for result in source.yield_pipeline_status(ol_event) or []:
            results.append(result)
            if result.right:
                server.store_status(result.right.pipeline_fqn, result.right.pipeline_status)
    return results


def whole_run(run: str):
    return [event(run, index) for index in range(len({**SPARK_RUNS, **AIRFLOW_RUNS}[run]))]


def lines(status: PipelineStatus) -> list[tuple]:
    return [
        (
            line.name,
            line.executionStatus,
            line.startTime.root if line.startTime else None,
            line.endTime.root if line.endTime else None,
        )
        for line in status.taskStatus
    ]


@pytest.mark.parametrize(
    "event_type, expected",
    [
        ("START", StatusType.Pending),
        ("RUNNING", StatusType.Pending),
        ("COMPLETE", StatusType.Successful),
        ("FAIL", StatusType.Failed),
        ("ABORT", StatusType.Skipped),
        ("OTHER", None),
    ],
)
def test_application_event_type_sets_the_run_status(source, server, event_type, expected):
    ingest(source, server, [event("successful_run", 0, eventType=event_type)])

    rows = list(server.statuses.values())
    assert [row.executionStatus for row in rows] == ([expected] if expected else [])
    if expected:
        assert rows[0].executionId == OK_RUN_ID
        assert rows[0].timestamp.root == OK_RUN_KEY
        assert rows[0].taskStatus == []


def test_aborted_step_is_skipped_and_does_not_fail_its_run(source, server):
    """dbt sends ABORT for a model it skipped: the model did not run, it did not fail."""
    events = whole_run("successful_run")
    events[5] = event("successful_run", 5, eventType="ABORT")

    ingest(source, server, events)

    row = server.statuses[(OK_PIPELINE, OK_RUN_KEY)]
    assert row.executionStatus == StatusType.Successful
    assert row.error is None
    assert {name: status for name, status, *_ in lines(row)}["deserialize_to_object"] == StatusType.Skipped


def test_successful_run_is_one_row_with_a_line_per_job(source, server):
    ingest(source, server, whole_run("successful_run"))

    assert list(server.statuses) == [(OK_PIPELINE, OK_RUN_KEY)]
    row = server.statuses[(OK_PIPELINE, OK_RUN_KEY)]
    assert row.executionStatus == StatusType.Successful
    assert row.executionId == OK_RUN_ID
    assert row.endTime.root == 1794900878780
    assert row.error is None
    assert lines(row) == [
        (
            "execute_save_into_data_source_command.public_orders_copy",
            StatusType.Successful,
            1794900877653,
            1794900878778,
        ),
        ("deserialize_to_object", StatusType.Successful, 1794900877747, 1794900878754),
    ]


def test_failed_sql_job_fails_the_run_although_the_application_completes(source, server):
    ingest(source, server, whole_run("failed_run"))

    assert list(server.statuses) == [(FAILED_PIPELINE, FAILED_RUN_KEY)]
    row = server.statuses[(FAILED_PIPELINE, FAILED_RUN_KEY)]
    assert row.executionStatus == StatusType.Failed
    assert row.executionId == FAILED_RUN_ID
    assert row.endTime.root == 1794900891850
    assert lines(row) == [
        (
            "execute_save_into_data_source_command.public_report",
            StatusType.Successful,
            1794900890123,
            1794900891812,
        ),
        # Spark sends COMPLETE after this job's FAIL; the line keeps the failure and its time.
        ("deserialize_to_object", StatusType.Failed, 1794900890233, 1794900891761),
    ]
    assert row.error.errorMessage == "Job aborted due to stage failure: ValueError: intentional failure"
    assert row.error.stackTrace.startswith("org.apache.spark.SparkException")
    assert row.error.failedTask == "deserialize_to_object"


def test_events_read_again_after_the_run_finished_change_nothing(source, server):
    ingest(source, server, whole_run("successful_run"))
    finished = server.statuses[(OK_PIPELINE, OK_RUN_KEY)]

    results = ingest(source, server, whole_run("successful_run")[:3])

    assert [result.right for result in results] == []
    assert server.statuses[(OK_PIPELINE, OK_RUN_KEY)] == finished


def test_start_read_in_a_later_ingestion_than_complete_never_downgrades(source, server):
    ingest(source, server, [event("successful_run", 7)])
    assert server.statuses[(OK_PIPELINE, OK_RUN_KEY)].executionStatus == StatusType.Successful

    results = ingest(source, server, whole_run("successful_run")[:7])

    assert {result.right.pipeline_status.executionStatus for result in results if result.right} == {
        StatusType.Successful
    }
    assert server.statuses[(OK_PIPELINE, OK_RUN_KEY)].executionStatus == StatusType.Successful


def test_sql_job_read_without_its_application_run_opens_a_pending_row(source, server):
    ingest(source, server, [event("failed_run", 5)])

    [row] = server.statuses.values()
    assert (row.executionId, row.executionStatus) == (FAILED_RUN_ID, StatusType.Pending)
    assert lines(row) == [("deserialize_to_object", StatusType.Successful, None, 1794900891811)]


def test_tasks_read_before_the_dag_run_start_are_kept(source, server):
    """airflow dags test sends no DAG START: the real default_task_info run begins with a task."""
    ingest(source, server, whole_run("default_task_info"))

    [row] = server.statuses.values()
    assert (row.executionId, row.executionStatus) == ("01a1e772-7380-7000-8000-000000000001", StatusType.Failed)
    assert lines(row) == [
        ("extract", StatusType.Successful, 1794917732608, 1794917736597),
        ("transform", StatusType.Failed, 1794917736622, 1794917736658),
    ]


@pytest.mark.parametrize("run_id", [UUID4_RUN_ID, "spark-app-0001"])
def test_run_whose_id_has_no_timestamp_writes_no_status_and_warns_once(source, server, caplog, run_id):
    """Its failed SQL job cannot join the run's row, so the run must not show as Successful."""
    start = event("successful_run", 0)
    start.run_facet["runId"] = run_id
    complete = event("successful_run", 7)
    complete.run_facet["runId"] = run_id
    child_failure = event("failed_run", 4)
    child_failure.run_facet["facets"]["parent"]["run"]["runId"] = run_id

    with caplog.at_level("WARNING"):
        results = ingest(source, server, [start, complete, child_failure])

    assert results == []
    assert server.statuses == {}
    assert [record.getMessage() for record in caplog.records if "is not a UUIDv7" in record.getMessage()] == [
        f"Skipping the run status of OpenLineage job {complete.job['name']}: its runId {run_id} is not a UUIDv7"
        " (senders before OpenLineage 1.15)."
    ]


def test_failed_status_read_is_reported_and_writes_nothing(source, server):
    ingest(source, server, [event("successful_run", 0)])
    source.metadata.list_pipeline_statuses.side_effect = RuntimeError("server unavailable")

    results = ingest(source, server, [event("successful_run", 7)])

    assert [result.right for result in results] == [None]
    assert "server unavailable" in results[0].left.error
    assert server.statuses[(OK_PIPELINE, OK_RUN_KEY)].executionStatus == StatusType.Pending


def test_application_failure_takes_its_error_from_the_error_message_facet(source, server):
    failure = event("successful_run", 7, eventType="FAIL")
    failure.run_facet["facets"]["errorMessage"] = {
        "message": "disk full",
        "programmingLanguage": "python",
        "stackTrace": "Traceback (most recent call last): OSError: disk full",
    }

    ingest(source, server, [failure])

    error = server.statuses[(OK_PIPELINE, OK_RUN_KEY)].error
    assert (error.errorMessage, error.stackTrace, error.failedTask) == (
        "disk full",
        "Traceback (most recent call last): OSError: disk full",
        None,
    )


def test_run_whose_id_carries_the_millisecond_of_another_run_takes_the_next_free_key(source, server):
    ingest(source, server, [event("successful_run", 0)])
    other_run = event("successful_run", 7)
    other_run.run_facet["runId"] = "01a1e86d-dc26-7000-8000-0000000000ff"

    ingest(source, server, [other_run, event("successful_run", 7)])

    assert {key: (row.executionId, row.executionStatus) for key, row in server.statuses.items()} == {
        (OK_PIPELINE, OK_RUN_KEY): (OK_RUN_ID, StatusType.Successful),
        (OK_PIPELINE, OK_RUN_KEY + 1): ("01a1e86d-dc26-7000-8000-0000000000ff", StatusType.Successful),
    }


def test_pipeline_gets_a_task_per_job_of_its_runs(source, server):
    ingest(source, server, whole_run("failed_run"))

    assert [(task.name, task.displayName) for task in server.pipeline_tasks[FAILED_PIPELINE]] == [
        (
            "execute_save_into_data_source_command.public_report",
            "execute_save_into_data_source_command.public_report",
        ),
        ("deserialize_to_object", "deserialize_to_object"),
    ]


def test_tasks_already_on_the_pipeline_are_kept(source, server):
    server.pipeline_tasks[FAILED_PIPELINE] = [Task(name="monday_only_job")]

    ingest(source, server, whole_run("failed_run"))

    assert [task.name for task in server.pipeline_tasks[FAILED_PIPELINE]] == [
        "monday_only_job",
        "execute_save_into_data_source_command.public_report",
        "deserialize_to_object",
    ]


def test_every_status_line_names_a_task_of_the_pipeline(source, server):
    """The server rejects a status whose task is not on the pipeline (PipelineRepository.validateTasks)."""
    ingest(
        source,
        server,
        whole_run("successful_run") + whole_run("failed_run") + whole_run("full_task_info") + whole_run("retried_task"),
    )

    assert len(server.statuses) == 4
    for (pipeline_fqn, _), row in server.statuses.items():
        task_names = {task.name for task in server.pipeline_tasks[pipeline_fqn]}
        assert row.taskStatus
        assert {line.name for line in row.taskStatus} <= task_names


def test_fields_the_connector_does_not_set_are_kept(source, server):
    ingest(source, server, whole_run("successful_run")[:2])
    key = (OK_PIPELINE, OK_RUN_KEY)
    stored = server.statuses[key]
    server.statuses[key] = stored.model_copy(
        update={
            "parameters": {"run_by": "scheduler"},
            "taskStatus": [stored.taskStatus[0].model_copy(update={"logLink": "https://spark.example/app"})],
        }
    )

    ingest(source, server, whole_run("successful_run")[2:])

    row = server.statuses[key]
    assert row.executionStatus == StatusType.Successful
    assert row.parameters == {"run_by": "scheduler"}
    assert str(row.taskStatus[0].logLink) == "https://spark.example/app"


@pytest.mark.parametrize(
    "parent",
    [{"job": {"namespace": "spark_jobs", "name": "orders_app"}}, {"job": "not a dict", "run": {}}],
)
def test_job_event_with_an_incomplete_parent_facet_writes_nothing(source, server, parent):
    ingest(source, server, [event("successful_run", 0)])
    child = event("successful_run", 5)
    child.run_facet["facets"]["parent"] = parent

    results = ingest(source, server, [child])

    assert [result.right for result in results] == []
    assert server.statuses[(OK_PIPELINE, OK_RUN_KEY)].taskStatus == []


def test_failed_sql_job_records_the_failure_when_its_application_start_was_never_read(source, server):
    ingest(source, server, [event("failed_run", index) for index in (4, 7)])

    row = server.statuses[(FAILED_PIPELINE, FAILED_RUN_KEY)]
    assert row.executionStatus == StatusType.Failed
    assert lines(row) == [
        ("deserialize_to_object", StatusType.Failed, None, 1794900891761),
    ]


def test_spark_application_launched_by_an_airflow_task_is_a_run_of_its_own_pipeline(source, server):
    """The application's parent is the Airflow task and its SQL jobs' root the DAG run (ADR:2026-11-18-openlineage-runs-are-their-own-pipelines-and-steps-join-their-parent)."""
    airflow_task = {
        "job": {"namespace": "airflow", "name": "nightly.run_spark"},
        "run": {"runId": "01a1e86e-0000-7000-8000-0000000000ab"},
        "root": {
            "job": {"namespace": "airflow", "name": "nightly"},
            "run": {"runId": "01a1e86e-0000-7000-8000-0000000000aa"},
        },
    }
    events = whole_run("failed_run")
    for launched in events:
        facets = launched.run_facet["facets"]
        if "parent" in facets:
            facets["parent"]["root"] = airflow_task["root"]
        else:
            facets["parent"] = airflow_task

    ingest(source, server, events)

    assert list(server.pipeline_requests) == [FAILED_PIPELINE]
    assert list(server.statuses) == [(FAILED_PIPELINE, FAILED_RUN_KEY)]
    row = server.statuses[(FAILED_PIPELINE, FAILED_RUN_KEY)]
    assert (row.executionStatus, row.executionId) == (StatusType.Failed, FAILED_RUN_ID)
    assert [line.name for line in row.taskStatus] == [
        "execute_save_into_data_source_command.public_report",
        "deserialize_to_object",
    ]


def test_status_stage_reports_a_pipeline_fqn_that_cannot_be_built(source):
    results = list(source.yield_pipeline_status(event("successful_run", 0)) or [])

    assert [result.right for result in results] == [None]
    assert "orders_app" in results[0].left.error


def test_failed_read_of_the_pipeline_tasks_is_reported_and_writes_no_pipeline(source, server):
    def get_by_name(entity, fqn, **kwargs):
        if fqn == OK_PIPELINE:
            raise RuntimeError("server unavailable")
        return server.get_by_name(entity, fqn, **kwargs)

    source.metadata.get_by_name.side_effect = get_by_name

    results = list(source.yield_pipeline(event("successful_run", 0)))

    assert [result.right for result in results] == [None]
    assert "server unavailable" in results[0].left.stackTrace


AIRFLOW_PIPELINE = "airflow_openlineage.airflow-nightly_sales"


def test_airflow_dag_run_fails_with_its_first_task_failure(source, server):
    ingest(source, server, whole_run("full_task_info"))

    [row] = server.statuses.values()
    assert row.executionStatus == StatusType.Failed
    assert [(line.name, line.executionStatus) for line in row.taskStatus] == [
        ("extract", StatusType.Successful),
        ("transform", StatusType.Failed),
    ]
    assert (row.error.errorMessage, row.error.failedTask) == (
        "ValueError: intentional failure",
        "transform",
    )


@pytest.mark.parametrize("run", ["default_task_info", "full_task_info"])
def test_dag_run_failure_read_before_its_task_failure_still_names_the_task(source, server, run):
    *steps, task_fails, dag_fails = whole_run(run)

    ingest(source, server, [*steps, dag_fails, task_fails])

    [row] = server.statuses.values()
    assert (row.error.errorMessage, row.error.failedTask) == ("ValueError: intentional failure", "transform")


def test_dag_run_failure_read_before_the_retry_that_made_its_task_good_blames_no_task(source, server):
    """flaky passes on its third try and the DAG run then times out, with the timeout read first.
    The row holds one error and flaky's took its place, so the timeout's message is not kept."""
    times_out = event("retried_task", 9, eventType="FAIL")
    times_out.run_facet["facets"]["errorMessage"] = {"message": "dagrun timed out", "programmingLanguage": "python"}

    ingest(source, server, [*(event("retried_task", index) for index in (0, 1, 2)), times_out])
    ingest(source, server, [event("retried_task", index) for index in (3, 4, 5, 6, 7, 8)])

    [row] = server.statuses.values()
    assert (row.executionStatus, row.error) == (StatusType.Failed, None)


@pytest.mark.parametrize("run", ["default_task_info", "full_task_info"])
def test_airflow_dag_start_date_is_the_pipeline_start_date(source, server, run):
    ingest(source, server, whole_run(run))

    assert str(server.pipeline_requests[AIRFLOW_PIPELINE].startDate.root) == "2026-11-01 00:00:00+00:00"


def test_airflow_task_dates_reach_the_tasks_when_airflow_sends_them(source, server):
    ingest(source, server, whole_run("full_task_info"))

    assert [(task.name, task.startDate, task.endDate) for task in server.pipeline_tasks[AIRFLOW_PIPELINE]] == [
        ("extract", "2026-11-05T00:00:00+00:00", "2027-01-01T00:00:00+00:00"),
        ("transform", "2026-11-01T00:00:00+00:00", None),
    ]


def test_task_dates_are_kept_when_later_events_do_not_carry_them(source, server):
    ingest(source, server, whole_run("full_task_info") + whole_run("default_task_info"))

    dates = {task.name: (task.startDate, task.endDate) for task in server.pipeline_tasks[AIRFLOW_PIPELINE]}
    assert dates["extract"] == ("2026-11-05T00:00:00+00:00", "2027-01-01T00:00:00+00:00")


def test_spark_pipeline_has_no_start_date(source, server):
    ingest(source, server, whole_run("successful_run"))

    assert server.pipeline_requests[OK_PIPELINE].startDate is None


def test_task_end_date_is_cleared_when_airflow_no_longer_reports_one(source, server):
    """Airflow's serializer drops null values, so a full task facet without end_date means the task has none."""
    later = event("full_task_info", 2)
    del later.run_facet["facets"]["airflow"]["task"]["end_date"]

    ingest(source, server, [*whole_run("full_task_info"), later])

    dates = {task.name: (task.startDate, task.endDate) for task in server.pipeline_tasks[AIRFLOW_PIPELINE]}
    assert dates["extract"] == ("2026-11-05T00:00:00+00:00", None)


def test_pipeline_start_date_is_kept_when_an_event_carries_none(source, server):
    ingest(source, server, whole_run("full_task_info"))
    no_facet = event("full_task_info", 5)
    del no_facet.run_facet["facets"]["airflowDagRun"]

    ingest(source, server, [no_facet])

    assert str(server.pipeline_requests[AIRFLOW_PIPELINE].startDate.root) == "2026-11-01 00:00:00+00:00"


def test_step_joins_its_parents_run_whatever_its_name(source, server):
    """dbt, for one, names a model after its table (db.schema.model) and its parent dbt-run-<project>."""
    model = event("failed_run", 4)
    model.job["name"] = "shop.public.report"

    ingest(source, server, [model])

    row = server.statuses[(FAILED_PIPELINE, FAILED_RUN_KEY)]
    assert [(line.name, line.executionStatus) for line in row.taskStatus] == [("shop.public.report", StatusType.Failed)]


def test_step_name_without_its_parent_job_prefix_names_its_task_whole(source, server):
    """A dbt model is named db.schema.model under its parent dbt-run-<project>: there is no prefix to drop."""
    model = event("failed_run", 4)
    model.job["name"] = "shop.public.report"

    ingest(source, server, [model])

    assert [(task.name, task.displayName) for task in server.pipeline_tasks[FAILED_PIPELINE]] == [
        ("shop.public.report", "shop.public.report")
    ]
    assert server.statuses[(FAILED_PIPELINE, FAILED_RUN_KEY)].error.failedTask == "shop.public.report"


def test_event_with_a_parent_and_no_job_type_is_a_step_of_the_parent(source, server):
    launched = event("successful_run", 7)
    del launched.job["facets"]["jobType"]["jobType"]
    launched.run_facet["facets"]["parent"] = {
        "job": {"namespace": "airflow", "name": "nightly.run_spark"},
        "run": {"runId": "01a1e86e-0000-7000-8000-0000000000ab"},
    }

    ingest(source, server, [launched])

    assert list(server.pipeline_requests) == ['spark_openlineage."airflow-nightly.run_spark"']
    [row] = server.statuses.values()
    assert (row.executionId, [line.name for line in row.taskStatus]) == (
        "01a1e86e-0000-7000-8000-0000000000ab",
        ["orders_app"],
    )


@pytest.mark.parametrize(
    "job_facets",
    [
        pytest.param("TASK", id="facets_not_an_object"),
        pytest.param({"jobType": "TASK"}, id="job_type_facet_not_an_object"),
        pytest.param({"jobType": {"jobType": ["TASK"]}}, id="job_type_not_a_string"),
    ],
)
def test_malformed_job_type_facet_reads_as_no_job_type(source, server, job_facets):
    """Naming the pipeline must not fail: it runs before any stage can report an error."""
    step = event("default_task_info", 1)
    step.job["facets"] = job_facets

    assert source.get_pipeline_name(step) == "airflow-nightly_sales"


def test_dbt_run_started_by_an_airflow_task_is_a_run_of_its_own_pipeline(source, server):
    """dbt gives a whole dbt run the job type JOB, and each model a job type of its own."""
    dbt_run = event("successful_run", 7)
    dbt_run.job.update(namespace="dbt", name="dbt-run-shop")
    dbt_run.job["facets"]["jobType"].update(integration="DBT", jobType="JOB")
    dbt_run.run_facet["facets"]["parent"] = {
        "job": {"namespace": "airflow", "name": "nightly.run_dbt"},
        "run": {"runId": "01a1e86e-0000-7000-8000-0000000000ab"},
    }

    ingest(source, server, [dbt_run])

    assert [fqn.rsplit(".", 1)[-1] for fqn in server.pipeline_requests] == ["dbt-dbt-run-shop"]
    [row] = server.statuses.values()
    assert row.executionId == dbt_run.run_facet["runId"]


def test_dag_run_triggered_by_another_dags_task_is_a_run_of_its_own_pipeline(source, server):
    triggered = event("full_task_info", 0)
    triggered.run_facet["facets"]["parent"] = {
        "job": {"namespace": "airflow", "name": "upstream_dag.trigger"},
        "run": {"runId": "01a1e86e-0e08-7000-8000-0000000000e1"},
    }

    ingest(source, server, [triggered])

    assert list(server.pipeline_requests) == [AIRFLOW_PIPELINE]
    assert str(server.pipeline_requests[AIRFLOW_PIPELINE].startDate.root) == "2026-11-01 00:00:00+00:00"
    [row] = server.statuses.values()
    assert row.executionId == triggered.run_facet["runId"]


RETRY_RUN_ID = "01a1ede9-bb77-7000-8000-000000000021"
RETRY_TRIES = [
    ("flaky", StatusType.Failed, 1794992882308, 1794992885754),
    ("flaky", StatusType.Failed, 1794992890429, 1794992892362),
    ("flaky", StatusType.Successful, 1794992897884, 1794992899628),
    ("load", StatusType.Successful, 1794992900083, 1794992901612),
]


def test_each_try_of_a_retried_airflow_task_is_its_own_line(source, server):
    ingest(source, server, whole_run("retried_task"))

    [row] = server.statuses.values()
    assert (row.executionId, row.executionStatus, row.error) == (RETRY_RUN_ID, StatusType.Successful, None)
    assert row.endTime.root == 1794992902015
    assert lines(row) == RETRY_TRIES
    assert [line.taskId for line in row.taskStatus] == [
        "01a1ede9-bb77-7000-8000-000000000022",
        "01a1ede9-bb77-7000-8000-000000000023",
        "01a1ede9-bb77-7000-8000-000000000024",
        "01a1ede9-bb77-7000-8000-000000000025",
    ]

    results = ingest(source, server, whole_run("retried_task"))

    assert [result.right for result in results] == []


def test_tries_read_out_of_order_each_find_their_own_line(source, server):
    ingest(source, server, [event("retried_task", index) for index in (0, 5, 6, 3, 1, 4, 2, 7, 8, 9)])

    [row] = server.statuses.values()
    assert row.executionStatus == StatusType.Successful
    assert sorted(lines(row), key=lambda line: line[2]) == RETRY_TRIES


def test_failed_try_read_without_the_dag_run_start_leaves_the_outcome_to_the_dag_run(source, server):
    ingest(source, server, [event("retried_task", 2)])

    [row] = server.statuses.values()
    assert row.executionStatus == StatusType.Pending
    assert lines(row) == [("flaky", StatusType.Failed, None, 1794992885754)]

    ingest(source, server, [event("retried_task", 9)])

    [row] = server.statuses.values()
    assert (row.executionStatus, row.error) == (StatusType.Successful, None)


STARTED_BY_TRANSFORM = {
    "job": {"namespace": "airflow", "name": "nightly_sales.transform"},
    "run": {"runId": "01a1e974-b232-7000-8000-0000000000aa"},
    "root": {
        "job": {"namespace": "airflow", "name": "nightly_sales"},
        "run": {"runId": "01a1e974-b232-7000-8000-000000000004"},
    },
}


def started_by_transform(index: int):
    """An event of the Spark application report_app, started by the Airflow task nightly_sales.transform."""
    started = event("failed_run", index)
    started.run_facet["facets"]["parent"] = copy.deepcopy(STARTED_BY_TRANSFORM)
    return started


def pipeline_links(source, server, started) -> list[tuple]:
    ingest(source, server, [started])
    source.context.get().pipeline = source.get_pipeline_name(started)
    return [
        (result.right.edge.fromEntity.id.root, result.right.edge.toEntity.id.root, result.right.edge.lineageDetails)
        for result in source.yield_pipeline_lineage_details(started)
        if isinstance(result.right, AddLineageRequest) and result.right.edge.fromEntity.type == "pipeline"
    ]


def test_run_started_by_an_airflow_task_is_linked_from_the_dag_pipeline(source, server):
    ingest(source, server, whole_run("full_task_info"))

    [(from_id, to_id, details)] = pipeline_links(source, server, started_by_transform(0))

    assert (from_id, to_id) == (pipeline_id(AIRFLOW_PIPELINE), pipeline_id(FAILED_PIPELINE))
    assert details.description == "Run started by OpenLineage job: nightly_sales.transform"
    assert (details.source, details.pipeline) == (LineageSource.OpenLineage, None)
    assert pipeline_links(source, server, started_by_transform(7)) == []


def test_run_started_by_a_task_of_a_natively_ingested_dag_is_linked_from_that_dag(source, server):
    """A native Airflow connector names its service after the namespace and its tasks by task_id."""
    server.pipeline_tasks["airflow.nightly_sales"] = [Task(name="transform")]

    [(from_id, to_id, _)] = pipeline_links(source, server, started_by_transform(0))

    assert (from_id, to_id) == (pipeline_id("airflow.nightly_sales"), pipeline_id(FAILED_PIPELINE))


def test_run_is_not_linked_from_a_pipeline_without_the_task_that_started_it(source, server):
    server.pipeline_tasks[AIRFLOW_PIPELINE] = [Task(name="extract")]

    assert pipeline_links(source, server, started_by_transform(0)) == []


def test_run_is_not_linked_when_several_pipelines_have_the_task_that_started_it(source, server):
    ingest(source, server, whole_run("full_task_info"))
    server.pipeline_tasks["openlineage_source.airflow-nightly_sales"] = [Task(name="nightly_sales.transform")]

    assert pipeline_links(source, server, started_by_transform(0)) == []


def test_dag_run_error_names_the_task_that_failed_it_not_a_try_a_retry_made_good(source, server):
    """The real retried run, with its last task failing the DAG run instead of completing."""
    load_fails = event("retried_task", 8, eventType="FAIL")
    load_fails.run_facet["facets"]["errorMessage"] = {
        "message": "load lost its connection",
        "programmingLanguage": "python",
    }
    dag_fails = event("retried_task", 9, eventType="FAIL")
    dag_fails.run_facet["facets"]["errorMessage"] = {"message": "task_failure", "programmingLanguage": "python"}

    ingest(source, server, [*whole_run("retried_task")[:8], load_fails, dag_fails])

    [row] = server.statuses.values()
    assert row.executionStatus == StatusType.Failed
    assert (row.error.errorMessage, row.error.failedTask) == ("load lost its connection", "load")


def test_run_started_by_a_task_whose_event_names_no_root_is_not_linked(source, server):
    """Senders older than the root parent facet name only the launching task, not its DAG."""
    ingest(source, server, whole_run("full_task_info"))
    started = started_by_transform(0)
    del started.run_facet["facets"]["parent"]["root"]

    assert pipeline_links(source, server, started) == []


def test_failed_search_for_the_launching_pipeline_writes_no_link(source, server):
    ingest(source, server, whole_run("full_task_info"))
    source.metadata.es_search_from_fqn.side_effect = RuntimeError("search unavailable")

    assert pipeline_links(source, server, started_by_transform(0)) == []


@pytest.mark.parametrize(
    "taken, written_key",
    [(RUN_KEY_WINDOW_MS - 1, OK_RUN_KEY + RUN_KEY_WINDOW_MS - 1), (RUN_KEY_WINDOW_MS, None)],
)
def test_run_takes_the_last_free_key_of_its_window_and_none_past_it(source, server, taken, written_key):
    for key in range(OK_RUN_KEY, OK_RUN_KEY + taken):
        server.statuses[(OK_PIPELINE, key)] = PipelineStatus(
            timestamp=key, executionStatus=StatusType.Successful, executionId=f"other-run-{key}"
        )

    ingest(source, server, [event("successful_run", 0)])

    assert [key for (_, key), row in server.statuses.items() if row.executionId == OK_RUN_ID] == (
        [written_key] if written_key else []
    )


def test_failed_spark_sql_job_keeps_its_error_when_a_same_named_job_succeeds(source, server):
    """One application running the same write twice sends two steps with one name."""
    second_write = event("failed_run", 5)
    second_write.run_facet["runId"] = "01a1e86e-127f-7000-8000-0000000000bb"

    ingest(source, server, [event("failed_run", 4), second_write])

    [row] = server.statuses.values()
    assert row.executionStatus == StatusType.Failed
    assert (row.error.errorMessage, row.error.failedTask) == (
        "Job aborted due to stage failure: ValueError: intentional failure",
        "deserialize_to_object",
    )


@pytest.mark.parametrize(
    "ingestions",
    [
        pytest.param([[0, 1, 2, "load_fails", "dag_fails"], [5, 6]], id="retry_read_after_the_dag_run_failed"),
        pytest.param([[0, 1, 2, 7, "load_fails", 5, 6, "dag_fails"]], id="other_task_failed_before_the_retry"),
    ],
)
def test_retry_of_the_blamed_task_moves_the_blame_to_a_task_still_failing(source, server, ingestions):
    """The row keeps one error, so the still failing task is named without its message."""
    row = retried_run_where_load_fails(source, server, ingestions)

    assert row.executionStatus == StatusType.Failed
    assert (row.error.failedTask, row.error.errorMessage) == ("load", None)


@pytest.mark.parametrize(
    "indexes",
    [
        pytest.param([0, 5, 6, 1, 2, 7, "load_fails", "dag_fails"], id="first_try"),
        pytest.param([0, 5, 6, 3, 4, 1, 2, 7, "load_fails", "dag_fails"], id="both_failed_tries"),
        pytest.param([0, 1, 2, "dag_fails", 5, 6, 7, "load_fails"], id="other_task_fails_after_the_retry"),
    ],
)
def test_failed_try_read_after_its_retry_succeeded_does_not_become_the_error(source, server, indexes):
    row = retried_run_where_load_fails(source, server, [indexes])

    assert row.executionStatus == StatusType.Failed
    assert (row.error.failedTask, row.error.errorMessage) == ("load", "load lost its connection")


def failure(run: str, index: int, message: str, **overrides):
    """Event ``index`` of ``run`` turned into a failure carrying ``message``."""
    failed = event(run, index, eventType="FAIL", **overrides)
    facet = "spark.exception" if run in SPARK_RUNS else "errorMessage"
    failed.run_facet["facets"][facet] = {"message": message, "stackTrace": message}
    return failed


def airflow_tasks_fail_one_after_the_other():
    """extract fails, transform runs anyway (trigger_rule all_done) and fails, then the DAG run."""
    return [
        *(event("full_task_info", index) for index in (0, 1)),
        failure("full_task_info", 2, "extract broke"),
        *(event("full_task_info", index) for index in (3, 4, 5)),
    ]


def parallel_airflow_tasks_fail():
    """extract starts after transform but fails before it."""
    return [
        *(event("full_task_info", index) for index in (0, 3)),
        event("full_task_info", 1, eventTime="2026-11-17T12:21:47.000000+00:00"),
        failure("full_task_info", 2, "extract broke", eventTime="2026-11-17T12:21:47.500000+00:00"),
        *(event("full_task_info", index) for index in (4, 5)),
    ]


def airflow_task_fails_every_try_and_another_between():
    """flaky fails on all three tries, and load fails between its first and second try."""
    run = [
        *(event("retried_task", index) for index in range(6)),
        failure("retried_task", 6, "try 3 fails on purpose"),
        event("retried_task", 7, eventTime="2026-11-18T09:08:07.000000+00:00"),
        failure("retried_task", 8, "load broke", eventTime="2026-11-18T09:08:08.000000+00:00"),
        failure("retried_task", 9, "flaky failed"),
    ]
    return sorted(run, key=lambda ol_event: ol_event.event_time)


def spark_sql_jobs_fail_one_after_the_other():
    return [
        *(event("failed_run", index) for index in range(6)),
        failure("failed_run", 6, "save broke"),
        event("failed_run", 7),
    ]


def spark_sql_job_of_the_failed_ones_name_succeeds(save_fails_at: str):
    """A second write named like the failed SQL job succeeds; the save SQL job fails at ``save_fails_at``."""
    second_write = event("failed_run", 5)
    second_write.run_facet["runId"] = "01a1e86e-127f-7000-8000-0000000000bb"
    run = [
        *(event("failed_run", index) for index in range(5)),
        second_write,
        failure("failed_run", 6, "save broke", eventTime=save_fails_at),
        event("failed_run", 7),
    ]
    return sorted(run, key=lambda ol_event: ol_event.event_time)


def spark_sql_job_fails_between_another_jobs_fail_and_complete():
    """deserialize_to_object fails, the save SQL job fails, then Spark sends deserialize_to_object's COMPLETE."""
    run = [
        *(event("failed_run", index) for index in range(6)),
        failure("failed_run", 6, "save broke", eventTime="2026-11-17T07:34:51.790Z"),
        event("failed_run", 7),
    ]
    return sorted(run, key=lambda ol_event: ol_event.event_time)


SPARK_FAILURE = ("deserialize_to_object", "Job aborted due to stage failure: ValueError: intentional failure")


@pytest.mark.parametrize("reversed_order", [False, True], ids=["read_in_order", "read_in_reverse"])
@pytest.mark.parametrize(
    "run, first_failure",
    [
        pytest.param(airflow_tasks_fail_one_after_the_other, ("extract", "extract broke"), id="airflow_tasks_in_turn"),
        pytest.param(parallel_airflow_tasks_fail, ("extract", "extract broke"), id="parallel_airflow_tasks"),
        pytest.param(
            airflow_task_fails_every_try_and_another_between,
            ("flaky", "try 1 fails on purpose"),
            id="airflow_task_failing_every_try",
        ),
        pytest.param(spark_sql_jobs_fail_one_after_the_other, SPARK_FAILURE, id="spark_sql_jobs_in_turn"),
        pytest.param(
            spark_sql_job_fails_between_another_jobs_fail_and_complete,
            SPARK_FAILURE,
            id="spark_sql_job_completing_after_its_failure",
        ),
        pytest.param(
            lambda: spark_sql_job_of_the_failed_ones_name_succeeds("2026-11-17T07:34:51.812Z"),
            SPARK_FAILURE,
            id="spark_same_name_succeeds_then_another_fails",
        ),
        pytest.param(
            lambda: spark_sql_job_of_the_failed_ones_name_succeeds("2026-11-17T07:34:51.700Z"),
            ("execute_save_into_data_source_command.public_report", "save broke"),
            id="spark_same_name_succeeds_another_failed_earlier",
        ),
    ],
)
def test_step_that_failed_first_is_blamed_whatever_the_read_order(source, server, run, first_failure, reversed_order):
    """With several steps failing, the error is the earliest failure that still stands."""
    events = run()

    ingest(source, server, events[::-1] if reversed_order else events)

    [row] = server.statuses.values()
    assert (row.error.failedTask, row.error.errorMessage) == first_failure


def load_fails_while_flaky_is_retried(retry_passes: bool):
    """flaky fails, load fails while flaky's second try runs, and that try passes or fails again."""
    second_try = event("retried_task", 4) if not retry_passes else event("retried_task", 4, eventType="COMPLETE")
    run = [
        *(event("retried_task", index) for index in range(4)),
        second_try,
        event("retried_task", 7, eventTime="2026-11-18T09:08:10.800000+00:00"),
        failure("retried_task", 8, "load broke", eventTime="2026-11-18T09:08:11.000000+00:00"),
        failure("retried_task", 9, "nightly_retry failed"),
    ]
    return sorted(run, key=lambda ol_event: ol_event.event_time)


@pytest.mark.parametrize("reversed_order", [False, True], ids=["read_in_order", "read_in_reverse"])
@pytest.mark.parametrize(
    "retry_passes, blamed", [(True, "load"), (False, "flaky")], ids=["retry_passes", "retry_fails"]
)
def test_task_failing_while_another_is_retried_is_blamed_only_when_the_retry_passes(
    source, server, retry_passes, blamed, reversed_order
):
    """Until flaky's retry ends, the row cannot know which failure stands: it ends on the right one."""
    events = load_fails_while_flaky_is_retried(retry_passes)

    ingest(source, server, events[::-1] if reversed_order else events)

    [row] = server.statuses.values()
    assert row.error.failedTask == blamed


def test_task_failing_while_another_is_retried_keeps_its_message_when_the_retry_passes(source, server):
    """Read as it happens, load's failure takes the error at once, so flaky's passing retry leaves it whole."""
    ingest(source, server, load_fails_while_flaky_is_retried(retry_passes=True))

    [row] = server.statuses.values()
    assert (row.error.failedTask, row.error.errorMessage) == ("load", "load broke")


def retried_run_where_load_fails(source, server, ingestions: list[list[int | str]]) -> PipelineStatus:
    """The row of the retried run once ``ingestions`` are read, with load and then the DAG run failing."""
    load_fails = event("retried_task", 8, eventType="FAIL")
    load_fails.run_facet["facets"]["errorMessage"] = {
        "message": "load lost its connection",
        "programmingLanguage": "python",
    }
    named = {"load_fails": load_fails, "dag_fails": event("retried_task", 9, eventType="FAIL")}

    for indexes in ingestions:
        ingest(source, server, [named.get(index) or event("retried_task", index) for index in indexes])

    [row] = server.statuses.values()
    return row


def renamed_dag(raw: dict, dag_id: str) -> dict:
    """``raw`` with the DAG nightly_sales renamed, in its job, parent and Airflow facets."""
    return json.loads(json.dumps(raw).replace("nightly_sales", dag_id))


@pytest.mark.parametrize(
    "dag_id, dag_pipeline",
    [
        pytest.param("nightly_sales", AIRFLOW_PIPELINE, id="plain_name"),
        pytest.param("team.nightly_sales", 'airflow_openlineage."airflow-team.nightly_sales"', id="dotted_name"),
    ],
)
def test_dag_pipeline_written_by_this_ingestion_is_found_before_search_indexes_it(source, server, dag_id, dag_pipeline):
    ingest(
        source,
        server,
        [message_to_open_lineage_event(renamed_dag(raw, dag_id)) for raw in AIRFLOW_RUNS["full_task_info"]],
    )
    source.metadata.es_search_from_fqn.side_effect = lambda *args, **kwargs: []
    started = started_by_transform(0)
    started.run_facet["facets"]["parent"] = renamed_dag(STARTED_BY_TRANSFORM, dag_id)

    [(from_id, to_id, _)] = pipeline_links(source, server, started)

    assert (from_id, to_id) == (pipeline_id(dag_pipeline), pipeline_id(FAILED_PIPELINE))


@pytest.mark.parametrize("cap", [3, 1], ids=["holds_one_pipeline", "holds_none"])
def test_pipeline_dropped_from_the_task_cache_keeps_all_its_tasks(source, server, monkeypatch, cap):
    """Two DAGs of two tasks each, their events interleaved, through a cache capped by task count."""
    monkeypatch.setattr(openlineage_metadata, "KNOWN_TASKS_CACHE_MAXSIZE", cap)
    source.prepare()
    runs = zip_longest(whole_run("retried_task"), whole_run("default_task_info"))

    ingest(source, server, [ol_event for pair in runs for ol_event in pair if ol_event])

    assert {fqn: sorted(task.name for task in tasks) for fqn, tasks in server.pipeline_tasks.items()} == {
        "airflow_openlineage.airflow-nightly_retry": ["flaky", "load"],
        AIRFLOW_PIPELINE: ["extract", "transform"],
    }
    assert sum(known_pipeline_weight(known) for known in source._known_pipelines.values()) <= cap
