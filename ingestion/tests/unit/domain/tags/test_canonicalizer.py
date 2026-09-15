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

import json
from functools import partial
from unittest.mock import MagicMock

import pytest
from requests import Response
from requests.exceptions import ConnectTimeout
from tenacity import wait_none

from metadata.domain.tags import Canonical, TagCanonicalizer
from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
from metadata.generated.schema.type.basic import ProviderType
from metadata.ingestion.ometa.client import APIError, RestTransportError
from metadata.ingestion.ometa.ometa_api import OpenMetadata


@pytest.fixture(autouse=True)
def _no_retry_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(TagCanonicalizer._es_search.retry, "wait", wait_none())


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
        mock_metadata.es_search_from_fqn.assert_called_once_with(
            entity_type=Classification, fqn_search_string="Foo", raise_on_error=True
        )


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
    @pytest.fixture
    def sdk_metadata(self, request):
        return OpenMetadata(
            OpenMetadataConnection(
                hostPort="http://localhost:8585/api",
                authProvider="basic",
                securityConfig={"jwtToken": "test-token"},
                enableVersionValidation=False,
            ),
            additional_client_config_arguments={"retry": getattr(request, "param", 0), "retry_wait": 0},
        )

    @pytest.fixture
    def http_request(self, sdk_metadata, monkeypatch):
        request = MagicMock()
        monkeypatch.setattr(sdk_metadata.client._session, "request", request)
        return request

    @pytest.fixture(params=[Classification, Tag], ids=["classification", "tag"])
    def sdk_lookup(self, request, sdk_metadata):
        canonicalizer = TagCanonicalizer(sdk_metadata)
        if request.param is Classification:
            lookup = partial(canonicalizer.classification, "pii", "Source desc")
            name, entity_fqn = "PII", "PII"
        else:
            lookup = partial(canonicalizer.tag, "PII", "sensitive", "Source desc")
            name, entity_fqn = "Sensitive", "PII.Sensitive"
        entity = {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": name,
            "fullyQualifiedName": entity_fqn,
            "description": "Canonical desc",
            "provider": "system",
        }
        if request.param is Tag:
            entity["classification"] = {
                "id": "00000000-0000-0000-0000-000000000002",
                "type": "classification",
                "name": "PII",
            }
        responses = [
            _http_response({"hits": {"hits": [{"_source": {"fullyQualifiedName": entity_fqn}}]}}),
            _http_response(entity),
        ]
        return lookup, Canonical(name, "Canonical desc"), responses

    @pytest.fixture(params=["unavailable", "timeout"])
    def http_failure(self, request):
        if request.param == "unavailable":
            return _http_response({"code": 503, "message": "Search unavailable"}, status_code=503), APIError
        return ConnectTimeout("Search timed out"), RestTransportError

    def test_transient_failure_recovers_within_retry_budget(self, sdk_lookup, http_request, http_failure):
        lookup, expected, responses = sdk_lookup
        failure, _ = http_failure
        http_request.side_effect = [failure, failure, *responses]

        assert lookup() == expected
        assert http_request.call_count == 4  # Three searches and one entity GET.

    @pytest.mark.parametrize("sdk_metadata", [3], indirect=True)
    def test_http_retry_exhaustion_reaches_canonicalizer(self, sdk_lookup, http_request):
        lookup, expected, responses = sdk_lookup
        failure = _http_response({"code": 503, "message": "Search unavailable"}, status_code=503)
        http_request.side_effect = [failure] * 4 + responses

        assert lookup() == expected
        assert http_request.call_count == 6

    def test_persistent_failure_raises_without_poisoning_cache(self, sdk_lookup, http_request, http_failure):
        lookup, expected, responses = sdk_lookup
        failure, error_type = http_failure
        http_request.side_effect = [failure] * 5

        with pytest.raises(error_type):
            lookup()
        assert http_request.call_count == 5

        http_request.side_effect = responses
        assert lookup() == expected
        assert http_request.call_count == 7

        assert lookup() == expected
        assert http_request.call_count == 7

    def test_entity_get_failure_retries_the_search(self, sdk_lookup, http_request):
        lookup, expected, responses = sdk_lookup
        http_request.side_effect = [
            responses[0],
            _http_response({"code": 503, "message": "Entity unavailable"}, status_code=503),
            *responses,
        ]

        assert lookup() == expected
        assert http_request.call_count == 4

    def test_successful_empty_search_is_cached_without_retry(self, sdk_lookup, http_request):
        lookup, _, _ = sdk_lookup
        http_request.return_value = _http_response({"hits": {"hits": []}})

        assert lookup() == Canonical(lookup.args[-2], "Source desc")
        assert lookup() == Canonical(lookup.args[-2], "Source desc")
        assert http_request.call_count == 1

    def test_sdk_search_keeps_default_best_effort_behavior(self, sdk_metadata, http_request, http_failure):
        failure, _ = http_failure
        http_request.side_effect = [failure]

        assert sdk_metadata.es_search_from_fqn(Classification, "pii") is None
        assert http_request.call_count == 1


def _http_response(payload: dict, status_code: int = 200) -> Response:
    response = Response()
    response.status_code = status_code
    response._content = json.dumps(payload).encode()
    response.headers["Content-Type"] = "application/json"
    return response


@pytest.mark.parametrize("cache_size", [1, 2])
def test_classification_miss_preserves_each_call_across_eviction(mock_metadata, cache_size):
    mock_metadata.es_search_from_fqn.return_value = []
    canonicalizer = TagCanonicalizer(mock_metadata, cache_size=cache_size)
    for name, description in (("Custom", "first"), ("CUSTOM", "second"), ("Other", "other"), ("custom", "third")):
        assert canonicalizer.classification(name, description) == Canonical(name, description)


@pytest.mark.parametrize("cache_size", [1, 2])
def test_tag_miss_preserves_each_call_across_eviction(mock_metadata, cache_size):
    mock_metadata.es_search_from_fqn.return_value = []
    canonicalizer = TagCanonicalizer(mock_metadata, cache_size=cache_size)
    for name, description in (("Mixed", "first"), ("MIXED", "second"), ("Other", "other"), ("mixed", "third")):
        assert canonicalizer.tag("Custom", name, description) == Canonical(name, description)


def test_cached_system_match_uses_current_description_fallback(mock_metadata):
    canonicalizer = TagCanonicalizer(mock_metadata, cache_size=1)
    mock_metadata.es_search_from_fqn.return_value = [_system_classification("PII")]
    assert canonicalizer.classification("pii", "first") == Canonical("PII", "first")
    assert canonicalizer.classification("Pii", "second") == Canonical("PII", "second")
    mock_metadata.es_search_from_fqn.return_value = [_system_tag("PII", "Sensitive")]
    assert canonicalizer.tag("PII", "sensitive", "first") == Canonical("Sensitive", "first")
    assert canonicalizer.tag("PII", "SENSITIVE", "second") == Canonical("Sensitive", "second")


def test_tag_cache_preserves_classification_identity(mock_metadata):
    canonicalizer = TagCanonicalizer(mock_metadata)
    mock_metadata.es_search_from_fqn.return_value = [_system_tag("PII", "Sensitive")]
    assert canonicalizer.tag("PII", "sensitive", "desc").name == "Sensitive"
    assert canonicalizer.tag("pii", "sensitive", "desc").name == "sensitive"


def test_resolution_caches_bound_matches_and_misses(mock_metadata):
    canonicalizer = TagCanonicalizer(mock_metadata, cache_size=2)
    mock_metadata.es_search_from_fqn.return_value = []
    for number in range(20):
        assert canonicalizer.classification(f"Class{number}", "desc").name == f"Class{number}"
        assert canonicalizer.tag("Class", f"Tag{number}", "desc").name == f"Tag{number}"
    assert len(canonicalizer._classification_cache) == 2
    assert len(canonicalizer._tag_cache) == 2
    mock_metadata.es_search_from_fqn.return_value = [_system_classification("CLASS0", "server")]
    assert canonicalizer.classification("Class0", "desc") == Canonical("CLASS0", "server")
    mock_metadata.es_search_from_fqn.return_value = [_system_tag("Class", "TAG0", "server")]
    assert canonicalizer.tag("Class", "Tag0", "desc") == Canonical("TAG0", "server")


@pytest.mark.parametrize("entity_type", [Classification, Tag], ids=["classification", "tag"])
@pytest.mark.parametrize("system_match", [False, True], ids=["miss", "match"])
def test_recently_used_resolution_avoids_another_search(mock_metadata, entity_type, system_match):
    canonicalizer = TagCanonicalizer(mock_metadata, cache_size=2)
    if entity_type is Classification:
        lookup = canonicalizer.classification
        make_entity = _system_classification
    else:
        lookup = partial(canonicalizer.tag, "Class")
        make_entity = partial(_system_tag, "Class")
    responses = {
        name.lower(): [make_entity(name, "server")] if system_match else [] for name in ("First", "Second", "Third")
    }

    def search(*, fqn_search_string, **_):
        return responses[fqn_search_string.rsplit(".", 1)[-1].lower()]

    mock_metadata.es_search_from_fqn.side_effect = search

    for name, canonical_name in (
        ("First", "First"),
        ("Second", "Second"),
        ("FIRST", "First"),
        ("Third", "Third"),
        ("FIRST", "First"),
        ("SECOND", "Second"),
    ):
        expected = Canonical(canonical_name, "server") if system_match else Canonical(name, "source")
        assert lookup(name, "source") == expected
    assert mock_metadata.es_search_from_fqn.call_count == 4


@pytest.mark.parametrize("cache_size", [0, -1])
def test_canonicalizer_rejects_invalid_capacity(mock_metadata, cache_size):
    with pytest.raises(ValueError, match="positive"):
        TagCanonicalizer(mock_metadata, cache_size=cache_size)


def test_resolve_combines_system_names_and_descriptions(canonicalizer, mock_metadata):
    mock_metadata.es_search_from_fqn.side_effect = [
        [_system_classification("PII", "System classification")],
        [_system_tag("PII", "Sensitive", "System tag")],
    ]
    result = canonicalizer.resolve(
        classification_name="pii",
        tag_name="sensitive",
        classification_description="Source classification",
        tag_description="Source tag",
    )
    assert result.classification_name == "PII"
    assert result.tag_name == "Sensitive"
    assert result.classification_description == "System classification"
    assert result.tag_description == "System tag"
