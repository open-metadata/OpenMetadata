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

"""Behavior checks for the shared model-generation schema directory."""

import hashlib
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "model_schemas", ROOT / "openmetadata-spec/scripts/prepare_model_schemas.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


@pytest.fixture
def schema_inputs(tmp_path):
    source = tmp_path / "source"
    entity = source / "entity/contract.json"
    entity.parent.mkdir(parents=True)
    entity.write_text('{"$ref": "../type/name.json"}\n')
    shared = source / "type/name.json"
    shared.parent.mkdir(parents=True)
    shared.write_text('{"type": "string"}\n')
    vendor = tmp_path / "vendor"
    upstream = vendor / "v3.1.0/schema.json"
    upstream.parent.mkdir(parents=True)
    upstream.write_bytes((ROOT / "openmetadata-spec/src/main/resources/odcs/v3.1.0/schema.json").read_bytes())
    return source, vendor, tmp_path / "prepared"


def prepare(inputs, *, check=False):
    source, vendor, output = inputs
    return MODULE.prepare(output, source_directory=source, vendor_directory=vendor, check=check)


def test_prepared_tree_preserves_references_and_keeps_sources_unchanged(schema_inputs):
    source, vendor, output = schema_inputs
    before = {path: path.read_bytes() for root in (source, vendor) for path in root.rglob("*.json")}

    assert prepare(schema_inputs)

    entity = output / "entity/contract.json"
    reference = json.loads(entity.read_text())["$ref"]
    assert (entity.parent / reference).read_bytes() == before[source / "type/name.json"]
    model = json.loads((output / "type/datacontract/odcs/v310/odcsContract.json").read_text())
    assert model["properties"]["apiVersion"]["enum"] == ["v3.1.0"]
    assert "query" in model["definitions"]["DataQuality"]["properties"]
    assert before == {path: path.read_bytes() for path in before}
    assert not (source / "type/datacontract/odcs").exists()


def test_repeated_preparation_preserves_unchanged_file_timestamps(schema_inputs):
    assert prepare(schema_inputs)
    output = schema_inputs[2]
    files = list(output.rglob("*.json"))
    for path in files:
        os.utime(path, ns=(1_000_000_000, 1_000_000_000))

    assert prepare(schema_inputs)
    assert all(path.stat().st_mtime_ns == 1_000_000_000 for path in files)
    assert prepare(schema_inputs, check=True)


def test_preparation_removes_deleted_inputs_and_obsolete_profiles(schema_inputs):
    source, _, output = schema_inputs
    assert prepare(schema_inputs)
    (source / "entity/contract.json").unlink()
    obsolete = output / "type/datacontract/odcs/v999/odcsContract.json"
    obsolete.parent.mkdir(parents=True)
    obsolete.write_text("{}")

    assert not prepare(schema_inputs, check=True)
    assert (output / "entity/contract.json").exists()
    assert obsolete.exists()
    assert prepare(schema_inputs)
    assert not (output / "entity/contract.json").exists()
    assert not obsolete.exists()
    assert prepare(schema_inputs, check=True)


def test_check_reports_missing_and_changed_inputs_without_writing(schema_inputs):
    source, _, output = schema_inputs
    assert not prepare(schema_inputs, check=True)
    assert not output.exists()
    assert prepare(schema_inputs)
    original = (output / "type/name.json").read_bytes()
    (source / "type/name.json").write_text('{"type": "integer"}')

    assert not prepare(schema_inputs, check=True)
    assert (output / "type/name.json").read_bytes() == original
    assert prepare(schema_inputs)
    assert json.loads((output / "type/name.json").read_text()) == {"type": "integer"}


def test_preparation_rejects_output_overlapping_source_inputs(schema_inputs):
    source, vendor, _ = schema_inputs
    for output in (source, source / "prepared", vendor, source.parent):
        with pytest.raises(ValueError, match="overlap"):
            MODULE.prepare(output, source_directory=source, vendor_directory=vendor)


def test_cli_prepares_all_profiles_from_another_working_directory(tmp_path):
    output = tmp_path / "schemas"
    command = [
        sys.executable,
        str(ROOT / "openmetadata-spec/scripts/prepare_model_schemas.py"),
        "--output-dir",
        str(output),
    ]

    result = subprocess.run(command, cwd=tmp_path, check=True, capture_output=True, text=True)

    assert result.stdout.strip() == str(output)
    models = sorted((output / "type/datacontract/odcs").glob("v*/odcsContract.json"))
    sources = sorted((ROOT / "openmetadata-spec/src/main/resources/odcs").glob("v*/schema.json"))
    assert len(models) == len(sources) == 6
    for source in sources:
        model = json.loads(
            (output / "type/datacontract/odcs" / source.parent.name.replace(".", "") / "odcsContract.json").read_text()
        )
        assert model["properties"]["apiVersion"]["enum"] == [source.parent.name]
        assert model["x-odcs-version"] == source.parent.name
        assert model["x-odcs-upstream-sha256"] == hashlib.sha256(source.read_bytes()).hexdigest()
    checked = subprocess.run([*command, "--check"], cwd=tmp_path, check=False, capture_output=True, text=True)
    assert checked.returncode == 0
    assert checked.stdout == ""


def test_cli_requires_an_explicit_output_directory(tmp_path):
    result = subprocess.run(
        [sys.executable, str(ROOT / "openmetadata-spec/scripts/prepare_model_schemas.py")],
        cwd=tmp_path,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 2
    assert "--output-dir" in result.stderr
