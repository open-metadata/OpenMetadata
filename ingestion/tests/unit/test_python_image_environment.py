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

"""Check the image-only Doris driver replacement against distribution metadata."""

import importlib.metadata
import importlib.util
from pathlib import Path

import pytest

SPEC = importlib.util.spec_from_file_location(
    "python_artifact_smoke", Path(__file__).resolve().parents[3] / "scripts/python_artifact_smoke.py"
)
smoke = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(smoke)


@pytest.fixture
def image(tmp_path, monkeypatch):
    distributions = importlib.metadata.distributions
    monkeypatch.setattr(importlib.metadata, "distributions", lambda: distributions(path=[str(tmp_path)]))
    return tmp_path


def install(image, name, version, requirements=()):
    metadata = image / f"{name}-{version}.dist-info/METADATA"
    metadata.parent.mkdir()
    metadata.write_text(
        f"Metadata-Version: 2.1\nName: {name}\nVersion: {version}\n"
        + "".join(f"Requires-Dist: {requirement}\n" for requirement in requirements)
    )


def test_operator_uses_pymysql_for_pydoris(image):
    install(image, "pydoris", "1.2.0", ["mysqlclient>=2.1.0,<3"])
    install(image, "pymysql", "1.1.2")
    smoke.check_metadata({"kind": "operator"})


@pytest.mark.parametrize("kind", ["airflow", None])
def test_other_environments_still_require_mysqlclient(image, kind):
    install(image, "pydoris", "1.2.0", ["mysqlclient>=2.1.0,<3"])
    install(image, "pymysql", "1.1.2")
    with pytest.raises(ValueError, match=r"mysqlclient.*missing"):
        smoke.check_metadata({"kind": kind})


def test_airflow_keeps_its_mysqlclient_driver(image):
    install(image, "pydoris", "1.2.0", ["mysqlclient>=2.1.0,<3"])
    install(image, "mysqlclient", "2.1.1")
    smoke.check_metadata({"kind": "airflow"})


@pytest.mark.parametrize("version, requirement", [("1.2.1", "mysqlclient>=2.1.0,<3"), ("1.2.0", "mysqlclient>=2.2")])
def test_operator_rejects_pydoris_exception_drift(image, version, requirement):
    install(image, "pydoris", version, [requirement])
    install(image, "pymysql", "1.1.2")
    with pytest.raises(ValueError, match="pydoris metadata exception drifted"):
        smoke.check_metadata({"kind": "operator"})


def test_operator_still_requires_replacement_driver(image):
    install(image, "pydoris", "1.2.0", ["mysqlclient>=2.1.0,<3"])
    with pytest.raises(ValueError, match=r"pymysql.*missing"):
        smoke.check_metadata({"kind": "operator"})


def test_operator_rejects_unrelated_mysqlclient_requirement(image):
    install(image, "image-client", "1.0", ["mysqlclient>=2.1.0,<3"])
    install(image, "pymysql", "1.1.2")
    with pytest.raises(ValueError, match=r"image-client requires mysqlclient.*missing"):
        smoke.check_metadata({"kind": "operator"})


def test_operator_rejects_unused_mysqlclient(image):
    install(image, "mysqlclient", "2.1.1")
    with pytest.raises(ValueError, match="Operator image contains unused mysqlclient"):
        smoke.check_metadata({"kind": "operator"})
