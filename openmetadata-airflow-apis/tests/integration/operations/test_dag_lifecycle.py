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

"""Run against an initialized Airflow database (``airflow db migrate``)."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from airflow import DAG, settings
from airflow.api.common.delete_dag import delete_dag as airflow_delete_dag
from airflow.exceptions import AirflowException
from airflow.models import DagModel, DagRun, TaskInstance
from airflow.utils import timezone
from airflow.utils.state import DagRunState, TaskInstanceState
from airflow.utils.types import DagRunType
from flask import Flask

from openmetadata_managed_apis.operations import delete, deploy, trigger


@pytest.fixture
def stored_dag(tmp_path, monkeypatch):
    dag_version_module = pytest.importorskip("airflow.models.dag_version")
    from airflow.models.dagbundle import DagBundleModel
    from airflow.providers.standard.operators.empty import EmptyOperator

    name = f"lifecycle_{uuid4().hex}"
    dag = DAG(name, schedule=None)
    task = EmptyOperator(task_id="ingest", dag=dag)
    dag_file = tmp_path / f"{name}.py"
    config_file = tmp_path / f"{name}.json"
    dag_file.write_text(f'from airflow import DAG\ndag = DAG("{name}", schedule=None)\n')
    config_file.write_text("{}")
    monkeypatch.setattr(delete, "AIRFLOW_DAGS_FOLDER", str(tmp_path))
    monkeypatch.setattr(delete, "DAG_GENERATED_CONFIGS", str(tmp_path))

    with settings.Session() as session:
        if not session.get(DagBundleModel, "dags-folder"):
            session.add(DagBundleModel(name="dags-folder"))
            session.flush()
        session.add(
            DagModel(dag_id=name, fileloc=str(dag_file), relative_fileloc=dag_file.name, bundle_name="dags-folder")
        )
        session.flush()
        version = dag_version_module.DagVersion(dag_id=name, bundle_name="dags-folder")
        session.add(version)
        session.flush()
        run = DagRun(
            dag_id=name,
            run_id="manual__lifecycle",
            logical_date=timezone.utcnow(),
            run_after=timezone.utcnow(),
            state=DagRunState.SUCCESS,
            run_type=DagRunType.MANUAL,
        )
        session.add(run)
        session.flush()
        session.add(TaskInstance(task, version.id, run_id=run.run_id, state=TaskInstanceState.SUCCESS))
        session.commit()

    try:
        yield name, dag_file, config_file, dag_version_module.DagVersion
    finally:
        with settings.Session() as session:
            if session.query(DagModel).filter_by(dag_id=name).count():
                session.query(TaskInstance).filter_by(dag_id=name).update({"state": TaskInstanceState.SUCCESS})
                airflow_delete_dag(name, session=session)
                session.commit()


def test_delete_dag_with_versioned_task_history(stored_dag):
    name, dag_file, config_file, version_model = stored_dag
    with Flask(__name__).app_context():
        response = delete.delete_dag_id(name)

    assert response.status_code == 200
    assert not dag_file.exists()
    assert not config_file.exists()
    with settings.Session() as session:
        for model in (TaskInstance, DagRun, version_model, DagModel):
            assert session.query(model).filter_by(dag_id=name).count() == 0


def test_running_dag_keeps_its_files_when_deletion_is_rejected(stored_dag):
    name, dag_file, config_file, _ = stored_dag
    with settings.Session() as session:
        session.query(TaskInstance).filter_by(dag_id=name).update({"state": TaskInstanceState.RUNNING})
        session.commit()

    with Flask(__name__).app_context(), pytest.raises(AirflowException, match="TaskInstances still running"):
        delete.delete_dag_id(name)

    assert dag_file.exists()
    assert config_file.exists()


def test_invalid_dag_does_not_report_success(tmp_path, monkeypatch):
    path = tmp_path / "invalid.py"
    path.write_text('from airflow import DAG\nraise ValueError("invalid ingestion config")\n')
    deployer = object.__new__(deploy.DagDeployer)
    deployer.dag_id = f"invalid_{uuid4().hex}"
    monkeypatch.setattr(deploy, "scan_dags_job_background", lambda: None)

    with Flask(__name__).app_context():
        response = deployer.refresh_session_dag(str(path))

    assert response.status_code == 500


@pytest.mark.parametrize("invalid_second", [False, True])
def test_concurrent_deployments_report_each_dag_result(invalid_second):
    dag_folder = Path(settings.DAGS_FOLDER)
    dag_folder.mkdir(parents=True, exist_ok=True)
    names = [f"bulk_{uuid4().hex}" for _ in range(2)]
    for index, name in enumerate(names):
        source = f'from airflow import DAG\ndag = DAG("{name}", schedule=None)\n'
        if invalid_second and index == 1:
            source += 'raise ValueError("invalid second pipeline")\n'
        (dag_folder / f"{name}.py").write_text(source)

    def refresh(name):
        deployer = object.__new__(deploy.DagDeployer)
        deployer.dag_id = name
        with Flask(__name__).app_context():
            response = deployer.refresh_session_dag(str(dag_folder / f"{name}.py"))
            return response.status_code, response.get_json()

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(refresh, names))

        assert [status for status, _ in results] == [200, 500 if invalid_second else 200]
        for name, (status, body) in zip(names, results, strict=True):
            if status == 200:
                assert name in body["message"]
            else:
                assert body == {"error": "An unexpected problem occurred"}
    finally:
        for name in names:
            (dag_folder / f"{name}.py").unlink(missing_ok=True)
        with settings.Session() as session:
            for name in names:
                if session.get(DagModel, name) is not None:
                    airflow_delete_dag(name, session=session)
            session.commit()


@pytest.fixture
def deployable_dag():
    pytest.importorskip("airflow.models.dag_version")
    name = f"deploy_ready_{uuid4().hex}"
    path = Path(settings.DAGS_FOLDER) / f"{name}.py"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f'from airflow import DAG\ndag = DAG("{name}", schedule=None)\n')
    deployer = object.__new__(deploy.DagDeployer)
    deployer.dag_id = name

    try:
        yield deployer, path
    finally:
        path.unlink(missing_ok=True)
        with settings.Session() as session:
            if session.query(DagModel).filter_by(dag_id=name).count():
                airflow_delete_dag(name, session=session)
                session.commit()


@pytest.mark.parametrize("api_clock_offset", [timedelta(0), timedelta(hours=1)], ids=["aligned", "api-ahead"])
def test_deploy_is_triggerable_before_success_returns(deployable_dag, api_clock_offset, monkeypatch):
    deployer, path = deployable_dag

    class ApiClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime.now(tz) + api_clock_offset

    monkeypatch.setattr(deploy, "datetime", ApiClock)

    with Flask(__name__).app_context():
        response = deployer.refresh_session_dag(str(path))
        assert response.status_code == 200
        _, status = trigger.trigger(deployer.dag_id, f"manual__{uuid4().hex}")
        assert status == 200
    with settings.Session() as session:
        assert session.query(DagRun).filter_by(dag_id=deployer.dag_id).count() == 1


@pytest.mark.parametrize("processor_clock_offset", [-60, 0, 60], ids=["backward", "unchanged", "forward"])
def test_registration_requires_a_changed_processor_marker(deployable_dag, processor_clock_offset):
    deployer, path = deployable_dag
    with Flask(__name__).app_context():
        assert deployer.refresh_session_dag(str(path)).status_code == 200

    with settings.Session() as session:
        model = session.get(DagModel, deployer.dag_id)
        previous_parse = model.last_parsed_time
        model.last_parsed_time += timedelta(seconds=processor_clock_offset)
        session.commit()

    assert deployer._wait_for_dag_registration(previous_parse, timeout_seconds=0) is (processor_clock_offset != 0)


def test_identical_redeploy_does_not_require_a_new_dag_version(deployable_dag):
    from airflow.models.serialized_dag import SerializedDagModel

    deployer, path = deployable_dag
    with Flask(__name__).app_context():
        assert deployer.refresh_session_dag(str(path)).status_code == 200
    with settings.Session() as session:
        previous_version = SerializedDagModel.get(deployer.dag_id, session=session).dag_version_id

    with Flask(__name__).app_context():
        assert deployer.refresh_session_dag(str(path)).status_code == 200
        _, status = trigger.trigger(deployer.dag_id, f"manual__{uuid4().hex}")
        assert status == 200
    with settings.Session() as session:
        assert SerializedDagModel.get(deployer.dag_id, session=session).dag_version_id == previous_version


def test_redeploy_rejects_unchanged_registration(deployable_dag, monkeypatch):
    deployer, path = deployable_dag
    with Flask(__name__).app_context():
        assert deployer.refresh_session_dag(str(path)).status_code == 200

    monkeypatch.setattr(deploy, "scan_dags_job_background", lambda: None)
    clock = iter([0, 60])
    monkeypatch.setattr(deploy, "monotonic", lambda: next(clock))

    with Flask(__name__).app_context():
        assert deployer.refresh_session_dag(str(path)).status_code == 500


@pytest.mark.parametrize("incomplete_state", ["import-error", "missing-serialization"])
def test_registration_rejects_incomplete_dag_metadata(deployable_dag, incomplete_state):
    from airflow.models.serialized_dag import SerializedDagModel

    deployer, path = deployable_dag
    with Flask(__name__).app_context():
        assert deployer.refresh_session_dag(str(path)).status_code == 200

    with settings.Session() as session:
        if incomplete_state == "import-error":
            session.get(DagModel, deployer.dag_id).has_import_errors = True
        else:
            session.query(SerializedDagModel).filter_by(dag_id=deployer.dag_id).delete()
        session.commit()

    assert not deployer._wait_for_dag_registration(None, timeout_seconds=0)
