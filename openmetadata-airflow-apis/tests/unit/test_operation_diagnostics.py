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

import logging
from types import SimpleNamespace

from flask import Flask

from openmetadata_managed_apis.operations import delete, last_dag_logs


class FakeDagModel:
    @staticmethod
    def get_last_dagrun(include_externally_triggered):
        return SimpleNamespace(get_task_instances=lambda: [SimpleNamespace(task_id="task", try_number=1)])


class FakeQuery:
    def filter(self, *_args):
        return self

    def delete(self):
        return 0


class FakeSession:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def query(self, *_args):
        return FakeQuery()

    def commit(self):
        return None


def test_unsupported_task_log_reader_is_logged(monkeypatch, caplog):
    monkeypatch.setattr(
        last_dag_logs.DagModel,
        "get_dagmodel",
        lambda **_kwargs: FakeDagModel(),
    )
    monkeypatch.setattr(
        last_dag_logs,
        "TaskLogReader",
        lambda: SimpleNamespace(supports_read=False),
    )

    with (
        Flask(__name__).app_context(),
        caplog.at_level(logging.ERROR, logger="AirflowOperations"),
    ):
        response = last_dag_logs.last_dag_logs("my_dag", "task")

    assert response.status_code == 500
    assert "Task log reader does not support reading logs" in caplog.text


def test_partial_dag_deletion_is_logged(monkeypatch, tmp_path, caplog):
    monkeypatch.setattr(delete, "AIRFLOW_DAGS_FOLDER", str(tmp_path / "dags"))
    monkeypatch.setattr(delete, "DAG_GENERATED_CONFIGS", str(tmp_path / "configs"))
    monkeypatch.setattr(delete.settings, "Session", FakeSession)

    with (
        Flask(__name__).app_context(),
        caplog.at_level(logging.ERROR, logger="AirflowOperations"),
    ):
        response = delete.delete_dag_id("my_dag")

    assert response.status_code == 500
    assert response.get_json() == {"error": "An unexpected problem occurred"}
    assert "Could not fully delete DAG my_dag" in caplog.text
    assert "database records: 0; DAG file: False; config file: False" in caplog.text
