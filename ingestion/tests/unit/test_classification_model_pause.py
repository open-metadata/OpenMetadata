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

"""Behavioral checks for the temporary classification model pause."""

import os
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest


@pytest.mark.parametrize("paused", [True, False])
def test_model_pause_skips_real_loading_and_preserves_other_tests(tmp_path, paused):
    tests = Path(__file__).resolve().parents[1]
    shutil.copyfile(tests / "conftest.py", tmp_path / "conftest.py")
    (tmp_path / "test_selection.py").write_text(
        "import spacy\n"
        "from unittest.mock import patch\n"
        "def test_real_model(tmp_path):\n"
        "    model_path = tmp_path / 'model'\n"
        "    spacy.blank('en').to_disk(model_path)\n"
        "    assert spacy.load(model_path)('hello')[0].text == 'hello'\n"
        "def test_without_model():\n"
        "    assert spacy.blank('en')('hello')[0].text == 'hello'\n"
        "def test_mocked_model():\n"
        "    with patch('spacy.load', return_value=spacy.blank('en')):\n"
        "        assert spacy.load('my_model')('hello')[0].text == 'hello'\n"
    )
    environment = os.environ.copy()
    environment.update(
        OM_SKIP_CLASSIFICATION_MODELS="true" if paused else "false",
        PYTEST_DISABLE_PLUGIN_AUTOLOAD="1",
        PYTEST_ADDOPTS="",
    )
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "--junitxml=results.xml"],
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
        timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    cases = {case.attrib["name"]: case for case in ET.parse(tmp_path / "results.xml").findall(".//testcase")}
    assert set(cases) == {"test_real_model", "test_without_model", "test_mocked_model"}
    assert (cases["test_real_model"].find("skipped") is not None) is paused
    assert cases["test_without_model"].find("skipped") is None
    assert cases["test_mocked_model"].find("skipped") is None
