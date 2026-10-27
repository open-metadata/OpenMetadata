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
Pipeline status collection of the Airflow lineage runner against a real
Airflow metadata schema (in-memory SQLite).
"""

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

try:
    from airflow import DAG
    from airflow.models import DagRun, TaskInstance, import_all_models
    from airflow.models.base import Base
    from airflow.providers.standard.operators.empty import EmptyOperator
except ImportError:
    pytest.skip("Airflow dependencies not installed", allow_module_level=True)

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from airflow_provider_openmetadata.lineage import runner as runner_module
from airflow_provider_openmetadata.lineage.runner import AirflowLineageRunner
from metadata.utils.helpers import datetime_to_ts

DAG_ID = "status_dag"
FIRST_RUN = datetime(2026, 1, 1, tzinfo=timezone.utc)
RUN_COUNT = 5


@pytest.fixture
def dag():
    with DAG(DAG_ID, start_date=FIRST_RUN, schedule=None) as dag:
        EmptyOperator(task_id="extract")
        EmptyOperator(task_id="load")
    return dag


@pytest.fixture
def airflow_session(dag):
    import_all_models()
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = Session(engine)

    def add_run(dag_id: str, run_id: str, logical_date: datetime, tasks) -> None:
        session.add(
            DagRun(
                dag_id=dag_id,
                run_id=run_id,
                logical_date=logical_date,
                run_type="scheduled",
                state="success",
            )
        )
        for task in tasks:
            session.add(TaskInstance(task=task, dag_version_id=uuid4(), run_id=run_id, state="success"))

    for day in range(RUN_COUNT):
        add_run(DAG_ID, f"run_{day}", FIRST_RUN + timedelta(days=day), dag.tasks)

    with DAG("other_dag", start_date=FIRST_RUN, schedule=None) as other_dag:
        EmptyOperator(task_id="other")
    add_run("other_dag", "other_run", FIRST_RUN + timedelta(days=30), other_dag.tasks)
    session.commit()

    @contextmanager
    def create_session():
        yield session

    with patch("airflow.utils.session.create_session", create_session):
        yield session
    session.close()


def build_runner(dag, max_status: int) -> AirflowLineageRunner:
    return AirflowLineageRunner(metadata=MagicMock(), service_name="airflow", dag=dag, max_status=max_status)


@pytest.mark.parametrize("is_airflow_3", [False, True])
def test_status_is_limited_to_latest_runs_of_the_dag(dag, airflow_session, is_airflow_3):
    runner = build_runner(dag, max_status=3)

    with (
        patch.object(runner_module, "IS_AIRFLOW_3_OR_HIGHER", is_airflow_3),
        patch.object(AirflowLineageRunner, "get_pipeline_status_via_api", return_value=[]),
    ):
        statuses = runner.get_all_pipeline_status()

    assert [status.timestamp.root for status in statuses] == [
        datetime_to_ts(FIRST_RUN + timedelta(days=day)) for day in (4, 3, 2)
    ]
    assert all({task.name for task in status.taskStatus} == {"extract", "load"} for status in statuses)
    assert all(status.executionStatus.value == "Successful" for status in statuses)


def test_zero_max_status_skips_status_collection(dag):
    runner = build_runner(dag, max_status=0)

    with patch.object(AirflowLineageRunner, "get_all_pipeline_status") as get_all_pipeline_status:
        runner.add_all_pipeline_status(MagicMock())

    get_all_pipeline_status.assert_not_called()
    runner.metadata.add_pipeline_status.assert_not_called()


def test_statuses_are_sent_to_openmetadata(dag, airflow_session):
    runner = build_runner(dag, max_status=2)
    pipeline = MagicMock()
    pipeline.fullyQualifiedName.root = f"airflow.{DAG_ID}"

    with patch.object(runner_module, "IS_AIRFLOW_3_OR_HIGHER", False):
        runner.add_all_pipeline_status(pipeline)

    sent = [call.kwargs for call in runner.metadata.add_pipeline_status.call_args_list]
    assert [kwargs["fqn"] for kwargs in sent] == [f"airflow.{DAG_ID}"] * 2
    assert [kwargs["status"].timestamp.root for kwargs in sent] == [
        datetime_to_ts(FIRST_RUN + timedelta(days=day)) for day in (4, 3)
    ]


def test_manually_triggered_runs_are_reported_at_their_start_date(dag, airflow_session):
    # Same timestamp as the Airflow connector, so both write the same status for the run
    manual_start = FIRST_RUN + timedelta(days=10, seconds=3)
    for run_id, run_after, start_date in (
        ("manual", FIRST_RUN + timedelta(days=10), manual_start),
        ("manual_queued", FIRST_RUN + timedelta(days=11), None),
    ):
        airflow_session.add(
            DagRun(
                dag_id=DAG_ID,
                run_id=run_id,
                logical_date=None,
                run_after=run_after,
                start_date=start_date,
                run_type="manual",
                state="success" if start_date else "queued",
            )
        )
        for task in dag.tasks:
            airflow_session.add(TaskInstance(task=task, dag_version_id=uuid4(), run_id=run_id))
    airflow_session.commit()
    runner = build_runner(dag, max_status=3)

    with (
        patch.object(runner_module, "IS_AIRFLOW_3_OR_HIGHER", True),
        patch.object(AirflowLineageRunner, "get_pipeline_status_via_api", return_value=[]),
    ):
        statuses = runner.get_all_pipeline_status()

    assert [status.timestamp.root for status in statuses] == [
        datetime_to_ts(manual_start),
        datetime_to_ts(FIRST_RUN + timedelta(days=4)),
    ]


def test_rest_api_reports_manually_triggered_runs_at_their_start_date(dag):
    manual_start = FIRST_RUN + timedelta(days=10, seconds=3)
    dag_runs = [
        {"dag_run_id": "manual_queued", "logical_date": None, "start_date": None},
        {"dag_run_id": "manual", "logical_date": None, "start_date": manual_start.isoformat()},
        {"dag_run_id": "run_4", "logical_date": (FIRST_RUN + timedelta(days=4)).isoformat()},
    ]
    task_instances = [{"task_id": task.task_id, "state": "success"} for task in dag.tasks]

    def airflow_api(url, params=None, **_):
        body = {"task_instances": task_instances} if url.endswith("/taskInstances") else {"dag_runs": dag_runs}
        return MagicMock(status_code=200, json=MagicMock(return_value=body))

    runner = build_runner(dag, max_status=3)
    with (
        patch("requests.post", return_value=MagicMock(status_code=201, json=lambda: {"access_token": "token"})),
        patch("requests.get", side_effect=airflow_api) as get,
    ):
        statuses = runner.get_pipeline_status_via_api()

    assert get.call_args_list[0].kwargs["params"] == {"limit": 3, "order_by": "-run_after"}
    assert [status.timestamp.root for status in statuses] == [
        datetime_to_ts(manual_start),
        datetime_to_ts(FIRST_RUN + timedelta(days=4)),
    ]
