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

"""Verify messaging fixture teardown against the real metadata API."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

from metadata.generated.schema.api.classification.createClassification import CreateClassificationRequest
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag

from ...utils.classification import snapshot_classification, snapshot_tag  # noqa: TID252

PII_FIELDS = {"name", "displayName", "description", "provider", "mutuallyExclusive", "autoClassificationConfig"}
TAG_FIELDS = (PII_FIELDS - {"autoClassificationConfig"}) | {
    "style",
    "recognizers",
    "autoClassificationEnabled",
    "autoClassificationPriority",
}


def pii_state(metadata):
    classification = metadata.get_by_name(entity=Classification, fqn="PII", fields=["autoClassificationConfig"])
    state = {"PII": classification.model_dump(mode="json", include=PII_FIELDS)}
    for name in ["Sensitive", "NonSensitive"]:
        tag = metadata.get_by_name(entity=Tag, fqn=f"PII.{name}", fields=["recognizers"])
        state[name] = tag.model_dump(mode="json", include=TAG_FIELDS)
    return state


@pytest.fixture
def nondefault_pii(metadata):
    original_classification = snapshot_classification(metadata, "PII")
    original_tags = [snapshot_tag(metadata, f"PII.{name}") for name in ["Sensitive", "NonSensitive"]]
    try:
        config = original_classification.model_dump(mode="json")
        config.update(description="Fixture cleanup sentinel", displayName="Fixture cleanup sentinel")
        config["autoClassificationConfig"].update(minimumConfidence=0.83, requireExplicitMatch=False)
        metadata.create_or_update(CreateClassificationRequest.model_validate(config))
        for tag in original_tags:
            config = tag.model_dump(mode="json")
            config.update(autoClassificationPriority=37, autoClassificationEnabled=False)
            metadata.create_or_update(CreateTagRequest.model_validate(config))
        yield pii_state(metadata)
    finally:
        for tag in original_tags:
            metadata.create_or_update(tag)
        metadata.create_or_update(original_classification)


@pytest.mark.parametrize("fixture_name", ["pii_classification", "sensitive_pii_tag", "non_sensitive_pii_tag"])
@pytest.mark.parametrize("fail_after_write", [False, True], ids=["normal", "setup-failure"])
def test_messaging_fixture_restores_prior_definition(
    metadata, nondefault_pii, tmp_path, fixture_name, fail_after_write
):
    root = Path(__file__).resolve().parents[4]
    (tmp_path / "fixture_cleanup_probe.py").write_text(
        """import pytest
from _openmetadata_testutils.ometa import int_admin_ometa
from ingestion.tests.integration.auto_classification.messaging.conftest import (
    pii_classification, sensitive_pii_tag, non_sensitive_pii_tag,
    email_recognizer, credit_card_recognizer, us_ssn_recognizer,
    phone_recognizer, pii_spacy_recognizer,
)
from metadata.generated.schema.api.classification.createClassification import CreateClassificationRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str

@pytest.fixture(scope="module")
def metadata():
    return int_admin_ometa()

@pytest.fixture(scope="session", autouse=True)
def fail_after_commit():
    original = OpenMetadata.create_or_update
    fired = False
    def update(self, data):
        nonlocal fired
        result = original(self, data)
        if isinstance(data, CreateClassificationRequest):
            name = "pii_classification"
        else:
            name = "sensitive_pii_tag" if model_str(data.name) == "Sensitive" else "non_sensitive_pii_tag"
        if FAIL_AFTER_WRITE and not fired and name == FIXTURE_NAME:
            fired = True
            raise RuntimeError("Synthetic failure after committed fixture write")
        return result
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(OpenMetadata, "create_or_update", update)
        yield
"""
        + f"\nFIXTURE_NAME = {fixture_name!r}\nFAIL_AFTER_WRITE = {fail_after_write!r}\n"
    )
    probe = tmp_path / "test_probe.py"
    probe.write_text(f'def test_fixture(request):\n    request.getfixturevalue("{fixture_name}")\n')
    environment = {key: value for key, value in os.environ.items() if not key.startswith("COV_CORE_")}
    environment["PYTHONPATH"] = os.pathsep.join([str(tmp_path), str(root), environment.get("PYTHONPATH", "")])
    environment["COVERAGE_FILE"] = str(tmp_path / ".coverage")
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-c",
            str(root / "ingestion/pyproject.toml"),
            "-p",
            "fixture_cleanup_probe",
            "-q",
            str(probe),
        ],
        cwd=root,
        env=environment,
        capture_output=True,
        text=True,
        timeout=90,
        check=False,
    )
    output = result.stdout + result.stderr
    assert result.returncode == (1 if fail_after_write else 0), output
    if fail_after_write:
        assert "Synthetic failure after committed fixture write" in output, output
    assert pii_state(metadata) == nondefault_pii
