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

"""Exercise DAG delete operations against the shared test Airflow database."""

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

from openmetadata_managed_apis.operations import delete


@pytest.fixture
def stored_dag(tmp_path, monkeypatch):
    dag_version_module = pytest.importorskip("airflow.models.dag_version")
    from airflow.models.dagbundle import DagBundleModel  # noqa: PLC0415
    from airflow.providers.standard.operators.empty import EmptyOperator  # noqa: PLC0415

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
            DagModel(
                dag_id=name,
                fileloc=str(dag_file),
                relative_fileloc=dag_file.name,
                bundle_name="dags-folder",
            )
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

    with (
        Flask(__name__).app_context(),
        pytest.raises(AirflowException, match="TaskInstances still running"),
    ):
        delete.delete_dag_id(name)

    assert dag_file.exists()
    assert config_file.exists()
