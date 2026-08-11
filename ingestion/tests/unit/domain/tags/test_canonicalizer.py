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
"""Unit tests for ``metadata.domain.tags.TagCanonicalizer``."""

from unittest.mock import MagicMock

import pytest

from metadata.domain.tags import Canonical, TagCanonicalizer
from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.type.basic import ProviderType


@pytest.fixture(autouse=True)
def _no_retry_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    """Skip tenacity's between-retry sleeps so retry-tests run instantly."""
    monkeypatch.setattr("time.sleep", lambda *_args, **_kwargs: None)


@pytest.fixture
def mock_metadata() -> MagicMock:
    return MagicMock()


@pytest.fixture
def canonicalizer(mock_metadata: MagicMock) -> TagCanonicalizer:
    return TagCanonicalizer(metadata=mock_metadata)


def _system_classification(name: str, description: str = "") -> MagicMock:
    m = MagicMock()
    m.provider = ProviderType.system
    m.name.root = name
    if description:
        m.description.root = description
    else:
        m.description = None
    return m


def _system_tag(classification: str, name: str, description: str = "") -> MagicMock:
    m = MagicMock()
    m.provider = ProviderType.system
    m.classification.name = classification
    m.name.root = name
    if description:
        m.description.root = description
    else:
        m.description = None
    return m


class TestClassification:
    def test_no_match_returns_source_unchanged(self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock):
        mock_metadata.es_search_from_fqn.return_value = []
        result = canonicalizer.classification("MyClass", "Source desc")
        assert result == Canonical(name="MyClass", description="Source desc")

    def test_system_match_uses_canonical_case(self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock):
        mock_metadata.es_search_from_fqn.return_value = [_system_classification("PII", "Canonical desc")]
        result = canonicalizer.classification("pii", "Source desc")
        assert result == Canonical(name="PII", description="Canonical desc")

    def test_caches_per_case_insensitive_key(self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock):
        mock_metadata.es_search_from_fqn.return_value = [_system_classification("PII", "Canonical desc")]
        canonicalizer.classification("pii", "Source desc")
        canonicalizer.classification("PII", "Source desc")
        canonicalizer.classification("Pii", "Source desc")
        # Three case variants share the same case-insensitive cache key
        assert mock_metadata.es_search_from_fqn.call_count == 1

    def test_non_system_match_ignored(self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock):
        non_system = _system_classification("PII", "Canonical desc")
        non_system.provider = ProviderType.user
        mock_metadata.es_search_from_fqn.return_value = [non_system]
        result = canonicalizer.classification("pii", "Source desc")
        assert result == Canonical(name="pii", description="Source desc")

    def test_classification_es_called_with_correct_args(
        self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock
    ):
        mock_metadata.es_search_from_fqn.return_value = []
        canonicalizer.classification("Foo", "Source desc")
        mock_metadata.es_search_from_fqn.assert_called_once_with(entity_type=Classification, fqn_search_string="Foo")


class TestTag:
    def test_no_match_returns_source_unchanged(self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock):
        mock_metadata.es_search_from_fqn.return_value = []
        result = canonicalizer.tag("PII", "MyTag", "Source desc")
        assert result == Canonical(name="MyTag", description="Source desc")

    def test_system_match_uses_canonical_case(self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock):
        mock_metadata.es_search_from_fqn.return_value = [_system_tag("PII", "Sensitive", "Canonical desc")]
        result = canonicalizer.tag("PII", "sensitive", "Source desc")
        assert result == Canonical(name="Sensitive", description="Canonical desc")

    def test_caches_per_case_insensitive_key(self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock):
        mock_metadata.es_search_from_fqn.return_value = [_system_tag("PII", "Sensitive", "")]
        canonicalizer.tag("PII", "sensitive", "Source desc")
        canonicalizer.tag("PII", "SENSITIVE", "Source desc")
        canonicalizer.tag("PII", "Sensitive", "Source desc")
        # Three case variants share the same case-insensitive cache key
        assert mock_metadata.es_search_from_fqn.call_count == 1

    def test_match_requires_classification_match(self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock):
        # ES returns a tag but for a different classification — no canonicalization
        wrong_class_tag = _system_tag("OtherClass", "Sensitive", "Canonical desc")
        mock_metadata.es_search_from_fqn.return_value = [wrong_class_tag]
        result = canonicalizer.tag("PII", "sensitive", "Source desc")
        assert result == Canonical(name="sensitive", description="Source desc")

    def test_non_system_match_ignored(self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock):
        non_system = _system_tag("PII", "Sensitive", "Canonical desc")
        non_system.provider = ProviderType.user
        mock_metadata.es_search_from_fqn.return_value = [non_system]
        result = canonicalizer.tag("PII", "sensitive", "Source desc")
        assert result == Canonical(name="sensitive", description="Source desc")


class TestRetryAndFailure:
    def test_transient_failure_recovers_within_retry_budget(
        self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock
    ):
        # First two ES calls raise; third succeeds.
        mock_metadata.es_search_from_fqn.side_effect = [
            RuntimeError("transient 1"),
            RuntimeError("transient 2"),
            [_system_classification("PII", "Canonical desc")],
        ]
        result = canonicalizer.classification("pii", "Source desc")
        assert result == Canonical(name="PII", description="Canonical desc")
        assert mock_metadata.es_search_from_fqn.call_count == 3

    def test_persistent_failure_raises_after_retries_exhaust(
        self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock
    ):
        mock_metadata.es_search_from_fqn.side_effect = RuntimeError("persistent")
        with pytest.raises(RuntimeError, match="persistent"):
            canonicalizer.classification("MyClass", "Source desc")
        assert mock_metadata.es_search_from_fqn.call_count == 5

    def test_persistent_failure_does_not_poison_cache(self, canonicalizer: TagCanonicalizer, mock_metadata: MagicMock):
        # First call: ES persistently fails -> raises.
        mock_metadata.es_search_from_fqn.side_effect = RuntimeError("persistent")
        with pytest.raises(RuntimeError):
            canonicalizer.classification("MyClass", "Source desc")

        # ES recovers; subsequent call must reach ES again, not return a cached fallback.
        mock_metadata.es_search_from_fqn.side_effect = None
        mock_metadata.es_search_from_fqn.return_value = [_system_classification("MyClass", "Canonical desc")]
        result = canonicalizer.classification("MyClass", "Source desc")
        assert result == Canonical(name="MyClass", description="Canonical desc")
