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

"""The engines-node Yarn plugin keeps `yarn install` refusing a Node older than engines.node."""

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs node")


def install(tmp_path, engines):
    shutil.copyfile(ROOT / ".yarnrc.yml", tmp_path / ".yarnrc.yml")
    shutil.copytree(ROOT / ".yarn/releases", tmp_path / ".yarn/releases")
    shutil.copytree(ROOT / ".yarn/plugins", tmp_path / ".yarn/plugins")
    (tmp_path / "package.json").write_text(json.dumps({"name": "probe", "engines": engines}))
    # No dependencies, so the install needs no network; CI would otherwise refuse to write the lockfile.
    env = {**os.environ, "YARN_ENABLE_IMMUTABLE_INSTALLS": "false", "YARN_GLOBAL_FOLDER": str(tmp_path / "global")}
    release = tmp_path / ".yarn/releases" / os.listdir(tmp_path / ".yarn/releases")[0]
    return subprocess.run(
        ["node", str(release), "install"], cwd=tmp_path, env=env, capture_output=True, text=True, check=False
    )


def test_install_fails_on_a_node_older_than_engines(tmp_path):
    result = install(tmp_path, {"node": ">=999.0.0"})
    assert result.returncode == 1
    assert 'does not satisfy engines.node ">=999.0.0"' in result.stdout


def test_install_passes_on_a_node_that_satisfies_engines(tmp_path):
    result = install(tmp_path, {"node": ">=0.0.0"})
    assert result.returncode == 0, result.stdout
