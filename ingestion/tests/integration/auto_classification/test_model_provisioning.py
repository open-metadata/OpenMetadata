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
"""Real-artifact coverage for Auto Classification model provisioning."""

import os
import subprocess
import venv
from pathlib import Path

import pytest

WHEEL_ENVIRONMENT_VARIABLE = "OM_MODEL_PROVISIONING_WHEEL"

pytestmark = [
    pytest.mark.slow,
    pytest.mark.skipif(
        not os.getenv(WHEEL_ENVIRONMENT_VARIABLE),
        reason=(
            "requires a candidate ingestion wheel and network access; set "
            f"{WHEEL_ENVIRONMENT_VARIABLE} to run this real-artifact integration test"
        ),
    ),
]


def _run(command: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    assert result.returncode == 0, (result.stderr or result.stdout)[-2000:]
    return result


def test_provisions_and_reuses_models_in_a_clean_environment(tmp_path: Path):
    """Install the candidate wheel, provision English, and load it in a new process."""
    wheel = Path(os.environ[WHEEL_ENVIRONMENT_VARIABLE])
    assert wheel.is_file(), f"Candidate wheel does not exist: {wheel}"

    environment = tmp_path / "model-provisioning"
    venv.EnvBuilder(with_pip=True).create(environment)
    python = environment / "bin" / "python"

    _run([str(python), "-m", "pip", "install", f"{wheel}[pii-processor]"])
    _run([str(python), "-m", "metadata", "install-classification-models", "--languages", "en"])
    repeated_provisioning = _run(
        [str(python), "-m", "metadata", "install-classification-models", "--languages", "en"],
    )
    assert "Reusing en_core_web_md 3.8.0" in repeated_provisioning.stdout + repeated_provisioning.stderr
    _run(
        [
            str(python),
            "-c",
            (
                "import spacy\n"
                "from unittest.mock import patch\n"
                "from metadata.generated.schema.type.classificationLanguages import ClassificationLanguage\n"
                "from metadata.pii.algorithms.presidio_utils import build_analyzer_engine\n"
                "model = spacy.load('en_core_web_md')\n"
                "document = model('Barack Obama visited Paris.')\n"
                "assert document and any(entity.label_ == 'PERSON' for entity in document.ents)\n"
                "with patch('metadata.pii.algorithms.presidio_utils.download', side_effect=AssertionError('unexpected model download')):\n"
                "    engine = build_analyzer_engine(ClassificationLanguage.en)\n"
                "assert engine.analyze(text='Barack Obama visited Paris.', entities=['PERSON'], language='en')"
            ),
        ]
    )
