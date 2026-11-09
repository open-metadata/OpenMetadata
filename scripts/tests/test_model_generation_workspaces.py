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

"""Exercise generation entry points with read-only inputs and caller-owned workspaces."""

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
UI = Path("openmetadata-ui/src/main/resources/ui")
HELPER = Path("openmetadata-spec/scripts/prepare_model_schemas.py")
GENERATORS = ["json2ts.sh", "json2ts-generate-all.sh"]


@pytest.fixture
def generation_repo(tmp_path):
    for relative in [HELPER, *(UI / name for name in GENERATORS), UI / "scripts/normalize-generated-map-types.mjs"]:
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)
    source = tmp_path / "openmetadata-spec/src/main/resources/json/schema"
    for relative, schema in {
        "entity/contract.json": {"type": "object", "properties": {"name": {"$ref": "../type/name.json"}}},
        "type/name.json": {"type": "object", "properties": {"value": {"type": "string"}}},
    }.items():
        target = source / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({"$id": "https://open-metadata.org/schema/" + relative, **schema}))
    (tmp_path / "openmetadata-spec/src/main/resources/odcs").mkdir()
    spec = tmp_path / "openmetadata-spec"
    for path in [*spec.rglob("*"), spec]:
        path.chmod(0o555 if path.is_dir() else 0o444)
    try:
        yield tmp_path
    finally:
        for path in [spec, *spec.rglob("*")]:
            path.chmod(0o755 if path.is_dir() else 0o644)


def run_generator(repo, generator, environment):
    command = ["bash", str(repo / UI / generator)]
    if generator == "json2ts.sh":
        command.append("openmetadata-spec/src/main/resources/json/schema/entity/contract.json")
    return subprocess.run(command, cwd=repo, env=environment, check=False, capture_output=True, text=True, timeout=60)


@pytest.mark.parametrize("generator", GENERATORS)
def test_ui_generation_cleans_workspace_after_tool_resolution_failure(generation_repo, generator):
    repo = generation_repo
    binaries = repo / "bin"
    binaries.mkdir()
    npx = binaries / "npx"
    npx.write_text("#!/bin/sh\nexit 9\n")
    npx.chmod(0o755)
    temporary = repo / "temporary"
    temporary.mkdir()
    environment = {**os.environ, "PATH": str(binaries) + os.pathsep + os.environ["PATH"], "TMPDIR": str(temporary)}

    result = run_generator(repo, generator, environment)

    assert result.returncode != 0
    assert "resolve quicktype" in (result.stdout + result.stderr).lower()
    assert list(temporary.iterdir()) == []
    assert not (repo / "openmetadata-spec/target").exists()


@pytest.mark.skipif(
    not (ROOT / "node_modules/.bin/quicktype").exists()
    or any(shutil.which(tool) is None for tool in ["node", "npx", "jq"]),
    reason="Requires the installed UI generation toolchain",
)
@pytest.mark.parametrize("generator", GENERATORS)
def test_ui_generation_keeps_prepared_inputs_out_of_generated_paths(generation_repo, generator):
    repo = generation_repo
    (repo / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
    temporary = repo / "temporary"
    temporary.mkdir()
    environment = {
        **os.environ,
        "TMPDIR": str(temporary),
        "npm_config_offline": "true",
        "NODE_COMPILE_CACHE": str(repo / "node-cache"),
    }

    result = run_generator(repo, generator, environment)

    assert result.returncode == 0, result.stdout + result.stderr
    output = repo / UI / "src/generated"
    generated = {path.relative_to(output).as_posix() for path in output.rglob("*.ts")}
    expected = {"entity/contract.ts"}
    if generator == "json2ts-generate-all.sh":
        expected.add("type/name.ts")
    assert generated == expected
    assert list(temporary.iterdir()) == []
    assert not (repo / "openmetadata-spec/target").exists()
