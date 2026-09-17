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
"""Real pytest sessions retain call failures and surface cleanup failures."""

import json
from xml.etree import ElementTree as ET

import pytest

from .test_workflow_case import CHILD_CONFTEST, _configure_child

SERVICE_FIXTURES = """
import json
import os
from uuid import uuid4
from metadata.generated.schema.entity.services.databaseService import DatabaseService

@pytest.fixture
def service_entity():
    return DatabaseService

@pytest.fixture
def independent_resource(request):
    path = Path("independent-resource")
    path.touch()
    request.addfinalizer(path.unlink)

@pytest.fixture
def om(independent_resource):
    directory = Path("resources")
    directory.mkdir(exist_ok=True)
    class FileSdk:
        def create(self, name):
            entity = DatabaseService(id=uuid4(), name=name, serviceType="Mysql")
            (directory / (name + ".json")).write_text(entity.model_dump_json())
            return entity

        def get_by_name(self, *, entity, fqn):
            assert entity is DatabaseService
            if os.environ["CLEANUP_MODE"] == "lookup_failure":
                raise PermissionError("lookup denied")
            path = directory / (fqn + ".json")
            return entity.model_validate_json(path.read_text()) if path.exists() else None

        def delete(self, *, entity, entity_id, hard_delete, recursive):
            assert entity is DatabaseService
            assert hard_delete is True
            assert recursive is True
            if os.environ["CLEANUP_MODE"] in {"delete_failure", "both_fail"}:
                raise PermissionError("delete denied")
            for path in directory.glob("*.json"):
                if str(entity.model_validate_json(path.read_text()).id.root) == entity_id:
                    path.unlink()
                    return
            raise LookupError(entity_id)
    return FileSdk()

@pytest.fixture
def owned(om, service_name):
    om.create(service_name)
    Path("owned-name").write_text(service_name)
    if os.environ["CLEANUP_MODE"] == "setup_failure":
        raise RuntimeError("setup failed after allocation")
    return service_name
"""


@pytest.mark.parametrize(
    "mode,passed,failed,errors,remaining",
    [
        ("success", 1, 0, 0, 0),
        ("delete_failure", 1, 0, 1, 1),
        ("both_fail", 0, 1, 1, 1),
        ("setup_failure", 0, 0, 1, 0),
        ("lookup_failure", 1, 0, 1, 1),
    ],
)
def test_owned_service_cleanup_is_failure_aware(pytester, monkeypatch, mode, passed, failed, errors, remaining):
    _configure_child(pytester, monkeypatch, conftest=CHILD_CONFTEST + SERVICE_FIXTURES)
    monkeypatch.setenv("CLEANUP_MODE", mode)
    pytester.makepyfile("""
import os
from pathlib import Path
from ingestion.tests.cli_e2e_v2.runtime.cli import WorkflowInvocation

def test_owned_service(cli, owned):
    cli.run(WorkflowInvocation("ingest", {"counter": str(Path("counter").resolve())}))
    assert os.environ["CLEANUP_MODE"] != "both_fail", "call failed"
""")
    result = pytester.runpytest_subprocess("-q", "--junitxml=report.xml")
    result.assert_outcomes(passed=passed, failed=failed, errors=errors)
    assert result.ret == (pytest.ExitCode.TESTS_FAILED if errors or failed else pytest.ExitCode.OK)
    resources = list((pytester.path / "resources").glob("*.json"))
    assert len(resources) == remaining
    assert not (pytester.path / "independent-resource").exists()
    name = (pytester.path / "owned-name").read_text()
    assert name.startswith("e2e_")
    if resources:
        assert json.loads(resources[0].read_text())["name"] == name
    report = pytester.path / "report.xml"
    output = result.stdout.str() + result.stderr.str()
    junit = ET.parse(report)
    assert len(junit.findall(".//failure")) == failed
    assert len(junit.findall(".//error")) == errors
    if mode == "both_fail":
        assert "call failed" in output
        assert "delete denied" in output
    if mode == "lookup_failure":
        assert "lookup denied" in output


def test_never_created_service_is_absent_without_teardown_error(pytester, monkeypatch):
    _configure_child(pytester, monkeypatch, conftest=CHILD_CONFTEST + SERVICE_FIXTURES)
    monkeypatch.setenv("CLEANUP_MODE", "success")
    pytester.makepyfile("""
def test_no_ingestion(service_name):
    assert service_name.startswith("e2e_")
""")
    result = pytester.runpytest_subprocess("-q")
    result.assert_outcomes(passed=1)
    assert result.ret == pytest.ExitCode.OK
    assert list((pytester.path / "resources").iterdir()) == []
