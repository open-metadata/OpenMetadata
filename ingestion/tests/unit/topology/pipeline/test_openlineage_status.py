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
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch
from uuid import UUID

import pytest

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, PipelineStatus, StatusType, Task
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.source.pipeline.openlineage.metadata import OpenlineageSource
from metadata.ingestion.source.pipeline.openlineage.utils import (
    message_to_open_lineage_event,
)

DATASETS = Path(__file__).parent.parent.parent / "resources/datasets"
with open(DATASETS / "openlineage_spark_runs.json") as runs_file:  # noqa: PTH123
    SPARK_RUNS = json.load(runs_file)
# Real Airflow 3.3.2 events (apache-airflow-providers-openlineage 2.20.1): a DAG run whose
# second task fails, once with the default task facet and once with include_full_task_info.
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
PIPELINE_ID = UUID("cccc3333-3333-3333-3333-333333333333")


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
            pipeline.id.root = PIPELINE_ID
            return pipeline
        return None

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
        server.pipeline_tasks[f"{result.right.service.root}.{result.right.name.root}"] = result.right.tasks or []
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
            pipeline_fqn = f"{result.right.service.root}.{result.right.name.root}"
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
        ("ABORT", StatusType.Failed),
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
        assert [line.name for line in rows[0].taskStatus] == ["orders_app"]


def test_successful_run_is_one_row_with_a_line_per_job(source, server):
    ingest(source, server, whole_run("successful_run"))

    assert list(server.statuses) == [(OK_PIPELINE, OK_RUN_KEY)]
    row = server.statuses[(OK_PIPELINE, OK_RUN_KEY)]
    assert row.executionStatus == StatusType.Successful
    assert row.executionId == OK_RUN_ID
    assert row.endTime.root == 1794900878780
    assert row.error is None
    assert lines(row) == [
        ("orders_app", StatusType.Successful, 1794900873907, 1794900878780),
        (
            "orders_app.execute_save_into_data_source_command.public_orders_copy",
            StatusType.Successful,
            1794900877653,
            1794900878778,
        ),
        ("orders_app.deserialize_to_object", StatusType.Successful, 1794900877747, 1794900878754),
    ]


def test_failed_sql_job_fails_the_run_although_the_application_completes(source, server):
    ingest(source, server, whole_run("failed_run"))

    assert list(server.statuses) == [(FAILED_PIPELINE, FAILED_RUN_KEY)]
    row = server.statuses[(FAILED_PIPELINE, FAILED_RUN_KEY)]
    assert row.executionStatus == StatusType.Failed
    assert row.executionId == FAILED_RUN_ID
    assert row.endTime.root == 1794900891850
    assert lines(row) == [
        ("report_app", StatusType.Failed, 1794900887537, 1794900891850),
        (
            "report_app.execute_save_into_data_source_command.public_report",
            StatusType.Successful,
            1794900890123,
            1794900891812,
        ),
        # Spark sends COMPLETE after this job's FAIL; the line keeps the failure.
        ("report_app.deserialize_to_object", StatusType.Failed, 1794900890233, 1794900891811),
    ]
    assert row.error.errorMessage == "Job aborted due to stage failure: ValueError: intentional failure"
    assert row.error.stackTrace.startswith("org.apache.spark.SparkException")
    assert row.error.failedTask == "report_app.deserialize_to_object"


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


def test_sql_job_completing_without_its_application_run_writes_nothing(source, server):
    ingest(source, server, [event("failed_run", 5)])

    assert server.statuses == {}


def test_run_ids_without_a_timestamp_report_only_the_application_outcome(source, server):
    start = event("successful_run", 0)
    start.run_facet["runId"] = UUID4_RUN_ID
    complete = event("successful_run", 7)
    complete.run_facet["runId"] = UUID4_RUN_ID
    child_failure = event("failed_run", 4)
    child_failure.run_facet["facets"]["parent"]["run"]["runId"] = UUID4_RUN_ID

    ingest(source, server, [start, complete, child_failure])

    assert list(server.statuses) == [(OK_PIPELINE, 1794900878780)]
    row = server.statuses[(OK_PIPELINE, 1794900878780)]
    assert row.executionStatus == StatusType.Successful
    assert row.executionId == UUID4_RUN_ID
    assert lines(row) == [("orders_app", StatusType.Successful, None, 1794900878780)]


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
        "orders_app",
    )


def test_event_of_another_run_with_the_same_key_writes_nothing(source, server):
    ingest(source, server, [event("successful_run", 0)])
    other_run = event("successful_run", 7)
    other_run.run_facet["runId"] = "01a1e86d-dc26-7000-8000-0000000000ff"

    results = ingest(source, server, [other_run])

    assert [result.right for result in results] == []
    assert server.statuses[(OK_PIPELINE, OK_RUN_KEY)].executionStatus == StatusType.Pending


def test_pipeline_gets_a_task_per_job_of_its_runs(source, server):
    ingest(source, server, whole_run("failed_run"))

    assert [(task.name, task.displayName) for task in server.pipeline_tasks[FAILED_PIPELINE]] == [
        ("report_app", "report_app"),
        (
            "report_app.execute_save_into_data_source_command.public_report",
            "execute_save_into_data_source_command.public_report",
        ),
        ("report_app.deserialize_to_object", "deserialize_to_object"),
    ]


def test_tasks_already_on_the_pipeline_are_kept(source, server):
    server.pipeline_tasks[FAILED_PIPELINE] = [Task(name="report_app.monday_only_job")]

    ingest(source, server, whole_run("failed_run"))

    assert [task.name for task in server.pipeline_tasks[FAILED_PIPELINE]] == [
        "report_app.monday_only_job",
        "report_app",
        "report_app.execute_save_into_data_source_command.public_report",
        "report_app.deserialize_to_object",
    ]


def test_every_status_line_names_a_task_of_the_pipeline(source, server):
    """The server rejects a status whose task is not on the pipeline (PipelineRepository.validateTasks)."""
    ingest(source, server, whole_run("successful_run") + whole_run("failed_run"))

    for (pipeline_fqn, _), row in server.statuses.items():
        task_names = {task.name for task in server.pipeline_tasks[pipeline_fqn]}
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
    assert [line.name for line in server.statuses[(OK_PIPELINE, OK_RUN_KEY)].taskStatus] == ["orders_app"]


def test_run_id_that_is_not_a_uuid_is_keyed_like_any_run_id_without_a_timestamp(source, server):
    complete = event("successful_run", 7)
    complete.run_facet["runId"] = "spark-app-0001"

    results = ingest(source, server, [complete])

    assert [result.left for result in results] == [None]
    assert server.statuses[(OK_PIPELINE, 1794900878780)].executionStatus == StatusType.Successful


def test_failed_sql_job_records_the_failure_when_its_application_start_was_never_read(source, server):
    ingest(source, server, [event("failed_run", index) for index in (4, 7)])

    row = server.statuses[(FAILED_PIPELINE, FAILED_RUN_KEY)]
    assert row.executionStatus == StatusType.Failed
    assert lines(row) == [
        ("report_app", StatusType.Failed, None, 1794900891850),
        ("report_app.deserialize_to_object", StatusType.Failed, None, 1794900891761),
    ]


def test_failure_of_a_job_whose_parent_is_not_the_pipeline_run_writes_nothing(source, server):
    """Spark launched by Airflow: the SQL job's parent is the Spark application, its root the DAG run."""
    failure = event("failed_run", 4)
    failure.run_facet["facets"]["parent"]["root"] = {
        "job": {"namespace": "airflow", "name": "nightly"},
        "run": {"runId": "01a1e86e-0000-7000-8000-0000000000aa"},
    }

    ingest(source, server, [failure])

    assert server.statuses == {}


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
        ("nightly_sales", StatusType.Failed),
        ("nightly_sales.extract", StatusType.Successful),
        ("nightly_sales.transform", StatusType.Failed),
    ]
    assert (row.error.errorMessage, row.error.failedTask) == (
        "ValueError: intentional failure",
        "nightly_sales.transform",
    )


@pytest.mark.parametrize("run", ["default_task_info", "full_task_info"])
def test_airflow_dag_start_date_is_the_pipeline_start_date(source, server, run):
    ingest(source, server, whole_run(run))

    assert str(server.pipeline_requests[AIRFLOW_PIPELINE].startDate.root) == "2026-11-01 00:00:00+00:00"


def test_airflow_task_dates_reach_the_tasks_when_airflow_sends_them(source, server):
    ingest(source, server, whole_run("full_task_info"))

    assert [(task.name, task.startDate, task.endDate) for task in server.pipeline_tasks[AIRFLOW_PIPELINE]] == [
        ("nightly_sales", None, None),
        ("nightly_sales.extract", "2026-11-05T00:00:00+00:00", "2027-01-01T00:00:00+00:00"),
        ("nightly_sales.transform", "2026-11-01T00:00:00+00:00", None),
    ]


def test_task_dates_are_kept_when_later_events_do_not_carry_them(source, server):
    ingest(source, server, whole_run("full_task_info") + whole_run("default_task_info"))

    dates = {task.name: (task.startDate, task.endDate) for task in server.pipeline_tasks[AIRFLOW_PIPELINE]}
    assert dates["nightly_sales.extract"] == ("2026-11-05T00:00:00+00:00", "2027-01-01T00:00:00+00:00")


def test_spark_pipeline_has_no_start_date(source, server):
    ingest(source, server, whole_run("successful_run"))

    assert server.pipeline_requests[OK_PIPELINE].startDate is None


def test_task_end_date_is_cleared_when_airflow_no_longer_reports_one(source, server):
    """Airflow's serializer drops null values, so a full task facet without end_date means the task has none."""
    later = event("full_task_info", 2)
    del later.run_facet["facets"]["airflow"]["task"]["end_date"]

    ingest(source, server, [*whole_run("full_task_info"), later])

    dates = {task.name: (task.startDate, task.endDate) for task in server.pipeline_tasks[AIRFLOW_PIPELINE]}
    assert dates["nightly_sales.extract"] == ("2026-11-05T00:00:00+00:00", None)


def test_pipeline_start_date_is_kept_when_an_event_carries_none(source, server):
    ingest(source, server, whole_run("full_task_info"))
    no_facet = event("full_task_info", 5)
    del no_facet.run_facet["facets"]["airflowDagRun"]

    ingest(source, server, [no_facet])

    assert str(server.pipeline_requests[AIRFLOW_PIPELINE].startDate.root) == "2026-11-01 00:00:00+00:00"


def test_dag_start_date_lands_only_on_the_pipeline_of_that_dag(source, server):
    """A DAG run with a parent (e.g. triggered by another DAG's task) is named after its parent."""
    triggered = event("full_task_info", 0)
    triggered.run_facet["facets"]["parent"] = {
        "job": {"namespace": "airflow", "name": "upstream_dag.trigger"},
        "run": {"runId": "01a1e86e-0e08-7000-8000-0000000000e1"},
    }

    ingest(source, server, [triggered])

    assert server.pipeline_requests["airflow_openlineage.airflow-upstream_dag.trigger"].startDate is None
