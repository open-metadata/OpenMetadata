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

import os
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest


def pytest_configure(config):
    # Airflow caches configuration at import time, before session fixtures execute.
    environment = pytest.MonkeyPatch()
    config.add_cleanup(environment.undo)
    if "AIRFLOW_HOME" not in os.environ:
        home = TemporaryDirectory(prefix="openmetadata-airflow-tests-")
        config.add_cleanup(home.cleanup)
        environment.setenv("AIRFLOW_HOME", home.name)

    defaults = {
        "AIRFLOW__CORE__LOAD_EXAMPLES": "false",
        "AIRFLOW__OPENMETADATA_AIRFLOW_APIS__DAG_GENERATED_CONFIGS": str(
            Path(os.environ["AIRFLOW_HOME"]) / "dag_generated_configs"
        ),
        "AIRFLOW__OPENMETADATA_AIRFLOW_APIS__DAG_RUNNER_TEMPLATE": str(
            Path(__file__).resolve().parents[1] / "openmetadata_managed_apis/resources/dag_runner.j2"
        ),
    }
    for name, value in defaults.items():
        if name not in os.environ:
            environment.setenv(name, value)


@pytest.fixture(scope="session", autouse=True)
def airflow_database():
    from airflow import settings
    from airflow.utils.db import initdb

    initdb()
    yield
    settings.Session.remove()
    settings.engine.dispose()
