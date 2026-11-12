#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Validate that the AI Governance sample bundle is optional.

`sampleDataFolder` is caller-supplied, so a deployment pointing it at its own pinned
copy of the sample data may not carry this bundle at all. That must not abort the
sample data workflow, which ingests tables, lineage and test cases no AI Governance
fixture is involved in.
"""

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from metadata.ingestion.source.database.ai_governance_sample import (
    AIGovernanceSampleData,
    AIGovernanceSampleDataError,
)

FIXTURE_FILES = (
    "services.json",
    "llm_models.json",
    "mcp_servers.json",
    "applications.json",
    "lineage.json",
)


@pytest.fixture()
def metadata():
    return MagicMock()


def write_bundle(folder: Path, **overrides) -> Path:
    """Write a syntactically valid bundle whose counts are deliberately off-contract."""
    folder.mkdir(parents=True, exist_ok=True)
    contents = {
        "services.json": {"llmServices": [], "mcpServices": []},
        "llm_models.json": [],
        "mcp_servers.json": [],
        "applications.json": {"registered": [], "shadow": []},
        "lineage.json": [],
    }
    contents.update(overrides)
    for filename, payload in contents.items():
        (folder / filename).write_text(json.dumps(payload), encoding="utf-8")
    return folder


class TestLoadOptional:
    """`load_optional` is what the sample data source calls."""

    def test_returns_none_when_the_bundle_is_absent(self, tmp_path, metadata):
        assert AIGovernanceSampleData.load_optional(tmp_path / "ai_governance", metadata) is None

    def test_returns_none_when_only_some_fixtures_are_present(self, tmp_path, metadata):
        folder = write_bundle(tmp_path / "ai_governance")
        (folder / "lineage.json").unlink()

        assert AIGovernanceSampleData.load_optional(folder, metadata) is None

    def test_returns_none_when_the_counts_are_off_contract(self, tmp_path, metadata):
        """The case that bites downstream: files present, contract moved on."""
        folder = write_bundle(tmp_path / "ai_governance")

        assert AIGovernanceSampleData.load_optional(folder, metadata) is None

    def test_returns_none_when_a_fixture_is_malformed(self, tmp_path, metadata):
        folder = write_bundle(tmp_path / "ai_governance")
        (folder / "llm_models.json").write_text("{not json", encoding="utf-8")

        assert AIGovernanceSampleData.load_optional(folder, metadata) is None

    def test_warns_rather_than_failing_silently(self, tmp_path, metadata, caplog):
        AIGovernanceSampleData.load_optional(tmp_path / "ai_governance", metadata)

        assert any("AI Governance sample data not ingested" in record.message for record in caplog.records)


class TestConstructorStaysStrict:
    """Callers that genuinely require the bundle keep the hard signal."""

    def test_missing_bundle_raises(self, tmp_path, metadata):
        with pytest.raises(AIGovernanceSampleDataError, match="Missing required AI Governance sample fixture"):
            AIGovernanceSampleData(tmp_path / "ai_governance", metadata)

    def test_off_contract_counts_raise(self, tmp_path, metadata):
        folder = write_bundle(tmp_path / "ai_governance")

        with pytest.raises(AIGovernanceSampleDataError, match="Unexpected AI Governance sample entity counts"):
            AIGovernanceSampleData(folder, metadata)

    def test_malformed_fixture_raises(self, tmp_path, metadata):
        folder = write_bundle(tmp_path / "ai_governance")
        (folder / "services.json").write_text("[", encoding="utf-8")

        with pytest.raises(AIGovernanceSampleDataError, match="Malformed AI Governance sample fixture"):
            AIGovernanceSampleData(folder, metadata)


class TestShippedBundleStaysInContract:
    """The bundle that ships in this repo must satisfy its own validation, or
    `load_optional` would skip the showcase in a default install."""

    def test_repo_bundle_loads(self, metadata):
        folder = Path(__file__).parents[2] / "examples" / "sample_data" / "ai_governance"
        if not folder.is_dir():
            pytest.skip(f"sample data bundle not present at {folder}")

        assert AIGovernanceSampleData.load_optional(folder, metadata) is not None
