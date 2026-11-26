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
Ensure the DAG config file loader never substitutes values
from the host's environment. The JSON it reads is dumped by
the OpenMetadata server, so user-authored fields must stay
literal instead of being expanded against the Airflow host's
process env.
"""

import json
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from openmetadata_managed_apis.workflows.config import (
    ConfigurationError,
    load_config_file,
)


@pytest.fixture
def config_dir():
    with TemporaryDirectory() as tmp:
        yield Path(tmp)


def write_config(config_dir: Path, payload: dict) -> Path:
    config_file = config_dir / "my_pipeline.json"
    config_file.write_text(json.dumps(payload))
    return config_file


def test_loads_stored_pipeline_config(config_dir, monkeypatch):
    monkeypatch.setenv("DATABASE_PASSWORD", "supersecret")
    config_file = write_config(
        config_dir,
        {
            "name": "my_pipeline",
            "openMetadataServerConnection": {"hostPort": "http://localhost:8585/api"},
        },
    )

    config = load_config_file(config_file)

    assert config["name"] == "my_pipeline"
    assert config["openMetadataServerConnection"]["hostPort"] == "http://localhost:8585/api"


def test_does_not_expand_variables_from_host_environment(config_dir, monkeypatch):
    monkeypatch.setenv("DATABASE_PASSWORD", "supersecret")
    config_file = write_config(
        config_dir,
        {
            "name": "my_pipeline",
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                    "username": "${DATABASE_PASSWORD}",
                }
            },
        },
    )

    config = load_config_file(config_file)

    assert config["sourceConfig"]["config"]["username"] == "${DATABASE_PASSWORD}"


def test_missing_file_raises_configuration_error(config_dir):
    with pytest.raises(ConfigurationError):
        load_config_file(config_dir / "nonexistent.json")


def test_invalid_json_raises_value_error(config_dir):
    config_file = config_dir / "broken.json"
    config_file.write_text("this is not json")

    with pytest.raises(json.JSONDecodeError):
        load_config_file(config_file)
