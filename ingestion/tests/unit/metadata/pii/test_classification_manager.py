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
"""
Unit tests for ClassificationRunManager.
"""

from copy import deepcopy
from unittest.mock import Mock, create_autospec

import pytest
from requests.exceptions import ConnectionError, Timeout

from _openmetadata_testutils.factories.metadata.generated.schema.type.recognizer import (
    ContextRecognizerFactory,
    CustomRecognizerFactory,
    ExactTermsRecognizerFactory,
    PatternRecognizerFactory,
    PredefinedRecognizerFactory,
)
from metadata.generated.schema.entity.classification.classification import (
    Classification,
    ConflictResolution,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.basic import EntityName
from metadata.ingestion.api.status import Status
from metadata.ingestion.ometa.client import RestTransportError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.classification_manager import MAX_CACHE_ENTRIES, ClassificationManager


def _sdk_response(*raw):
    sdk = object.__new__(OpenMetadata)
    sdk.client = Mock()
    sdk._use_raw_data = False
    sdk.client.get.return_value = {"data": list(raw), "paging": {"total": len(raw)}}
    return sdk


def _warning_message(status):
    assert status.failures == []
    assert len(status.warnings) == 1
    return next(iter(status.warnings[0].values()))


@pytest.mark.parametrize("enablement", [None, False, "false", "0", 0, "absent"])
def test_bad_disabled_tags_do_not_report_diagnostics(pii_classification, email_tag_pii, enablement):
    raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
    raw["recognizers"][0]["recognizerConfig"].pop("supportedLanguage")
    if enablement == "absent":
        raw.pop("autoClassificationEnabled")
    else:
        raw["autoClassificationEnabled"] = enablement
    status = Status()

    assert ClassificationManager(_sdk_response(raw), status).get_enabled_tags([pii_classification]) == []
    assert status.failures == []
    assert status.warnings == []


@pytest.mark.parametrize(
    "config", [None, {}, {"enabled": None}, {"enabled": False}, {"enabled": "false"}, {"enabled": "0"}, "absent"]
)
def test_bad_disabled_classifications_do_not_report_diagnostics(pii_classification, config):
    raw = pii_classification.model_dump(mode="json", exclude_none=True)
    raw.pop("description")
    if config == "absent":
        raw.pop("autoClassificationConfig")
    else:
        raw["autoClassificationConfig"] = config
    status = Status()

    assert ClassificationManager(_sdk_response(raw), status).get_enabled_classifications() == []
    assert status.failures == []
    assert status.warnings == []


@pytest.mark.parametrize("entity", ["tag", "classification"])
def test_malformed_selection_field_is_reported(pii_classification, email_tag_pii, entity):
    raw = (email_tag_pii if entity == "tag" else pii_classification).model_dump(mode="json", exclude_none=True)
    field = "autoClassificationEnabled" if entity == "tag" else "autoClassificationConfig"
    raw[field] = ["private-input"]
    status = Status()
    manager = ClassificationManager(_sdk_response(raw), status)

    if entity == "tag":
        assert manager.get_enabled_tags([pii_classification]) == []
    else:
        assert manager.get_enabled_classifications() == []
    message = _warning_message(status)
    assert field in message
    assert "private-input" not in message


def test_quoted_classification_name_preserves_parse_warning(pii_classification, email_tag_pii):
    classification = pii_classification.model_copy(update={"name": EntityName(root="acme.pii")})
    raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
    raw["fullyQualifiedName"] = '"acme.pii".ssn'
    raw["recognizers"][0]["recognizerConfig"].pop("supportedLanguage")
    status = Status()

    sdk = _sdk_response(raw)
    sdk.client.get.side_effect = [
        {"data": [raw], "paging": {"total": 2, "after": "next"}},
        {"data": [raw], "paging": {"total": 2}},
    ]
    assert ClassificationManager(sdk, status).get_enabled_tags([classification]) == []
    assert '"acme.pii".ssn' in _warning_message(status)
    assert [call.kwargs["data"] for call in sdk.client.get.call_args_list] == [
        {"parent": '"acme.pii"'},
        {"parent": '"acme.pii"'},
    ]


@pytest.mark.parametrize("pattern", [123, {"name": "test", "regex": 123, "score": 0.8}])
def test_pattern_list_validation_location_names_field(pii_classification, email_tag_pii, pattern):
    raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
    raw["recognizers"][0]["recognizerConfig"]["patterns"] = [pattern]
    status = Status()

    assert ClassificationManager(_sdk_response(raw), status).get_enabled_tags([pii_classification]) == []
    message = _warning_message(status)
    assert "patterns[0]" in message
    assert "PatternRecognizer" not in message
    assert "123" not in message


@pytest.mark.parametrize("config", [None, [], "private-input"])
def test_malformed_recognizer_container_omits_union_paths(pii_classification, email_tag_pii, config):
    raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
    raw["recognizers"][0]["recognizerConfig"] = config
    status = Status()

    assert ClassificationManager(_sdk_response(raw), status).get_enabled_tags([pii_classification]) == []
    message = _warning_message(status)
    assert message.endswith("missing or invalid recognizerConfig")
    assert raw["recognizers"][0]["name"] in message
    assert "private-input" not in message
    assert "PatternRecognizer" not in message


@pytest.mark.parametrize("fqn", ["", '"PII.Email', '"Other.Bad', "Other..Bad"])
def test_invalid_parent_identity_does_not_suppress_selected_tag_warning(pii_classification, email_tag_pii, fqn):
    raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
    raw["fullyQualifiedName"] = fqn
    raw["recognizers"][0]["recognizerConfig"].pop("supportedLanguage")
    status = Status()

    assert ClassificationManager(_sdk_response(raw), status).get_enabled_tags([pii_classification]) == []
    assert "supportedLanguage" in _warning_message(status)


@pytest.mark.parametrize("raw_name", [None, ""])
def test_missing_classification_name_uses_quoted_fqn_for_selection(pii_classification, raw_name):
    raw = pii_classification.model_dump(mode="json", exclude_none=True)
    raw["fullyQualifiedName"] = '"acme.pii"'
    if raw_name is None:
        raw.pop("name")
    else:
        raw["name"] = raw_name
    status = Status()

    assert ClassificationManager(_sdk_response(raw), status).get_enabled_classifications(["acme.pii"]) == []
    assert "name" in _warning_message(status)


def test_first_page_failure_does_not_claim_other_classification_results(
    pii_classification, general_classification, email_tag_pii
):
    metadata = create_autospec(OpenMetadata, instance=True, spec_set=True)
    metadata.list_all_entities.side_effect = [[email_tag_pii], RuntimeError("private")]
    status = Status()

    tags = ClassificationManager(metadata, status).get_enabled_tags([pii_classification, general_classification])

    assert tags == [email_tag_pii]
    assert "General" in status.failures[0].error
    assert "after partial results" not in status.failures[0].error


def test_incomplete_retry_reports_identical_warning_and_failure_once(pii_classification, email_tag_pii):
    raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
    raw["recognizers"][0]["recognizerConfig"].pop("supportedLanguage")
    sdk = _sdk_response(raw)
    sdk.client.get.side_effect = [
        {"data": [raw], "paging": {"total": 2, "after": "next"}},
        Timeout("private"),
        {"data": [raw], "paging": {"total": 2, "after": "next"}},
        Timeout("private"),
        {"data": [raw], "paging": {"total": 2, "after": "next"}},
        RuntimeError("private"),
    ]
    status = Status()
    manager = ClassificationManager(sdk, status)

    assert manager.get_enabled_tags([pii_classification]) == []
    assert manager.get_enabled_tags([pii_classification]) == []
    assert len(status.warnings) == 1
    assert len(status.failures) == 1
    assert manager.get_enabled_tags([pii_classification]) == []
    assert len(status.warnings) == 1
    assert len(status.failures) == 2


@pytest.mark.parametrize(
    "factory",
    [
        PatternRecognizerFactory,
        ExactTermsRecognizerFactory,
        ContextRecognizerFactory,
        CustomRecognizerFactory,
        PredefinedRecognizerFactory,
    ],
)
def test_valid_recognizer_branch_does_not_hide_later_invalid_recognizer(pii_classification, email_tag_pii, factory):
    raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
    valid = deepcopy(raw["recognizers"][0])
    valid["recognizerConfig"] = factory.create().model_dump(mode="json", exclude_none=True)
    bad = deepcopy(raw["recognizers"][0])
    bad["name"] = "broken-recognizer"
    bad["recognizerConfig"].pop("supportedLanguage")
    raw["recognizers"] = [valid, bad]
    status = Status()

    assert ClassificationManager(_sdk_response(raw), status).get_enabled_tags([pii_classification]) == []
    message = _warning_message(status)
    assert "broken-recognizer" in message
    assert "supportedLanguage" in message
    assert not message.endswith("invalid type")


def test_fetch_retry_diagnostic_history_is_bounded(pii_classification):
    sdk = _sdk_response()
    sdk.client.get.side_effect = Timeout("private")
    status = Status()
    manager = ClassificationManager(sdk, status)
    classifications = [
        pii_classification.model_copy(update={"name": EntityName(root=f"Class{index}")})
        for index in range(MAX_CACHE_ENTRIES + 1)
    ]

    for classification in classifications:
        assert manager.get_enabled_tags([classification]) == []
    assert len(status.failures) == MAX_CACHE_ENTRIES + 1
    assert manager.get_enabled_tags([classifications[-1]]) == []
    assert len(status.failures) == MAX_CACHE_ENTRIES + 1
    assert manager.get_enabled_tags([classifications[0]]) == []
    assert len(status.failures) == MAX_CACHE_ENTRIES + 2


def test_fetch_transport_diagnostic_reports_safe_cause(pii_classification):
    sdk = _sdk_response()
    sdk.client.get.side_effect = RestTransportError("GET", "private-url", ConnectionError("private-cause"))
    status = Status()

    assert ClassificationManager(sdk, status).get_enabled_tags([pii_classification]) == []
    assert status.failures[0].error.endswith("transport failure (ConnectionError)")
    assert "private" not in status.failures[0].error


class TestClassificationRunManager:
    """Tests for ClassificationRunManager."""

    @pytest.fixture
    def metadata(self) -> Mock:
        mock = create_autospec(OpenMetadata, instance=True, spec_set=True)

        return mock  # noqa: RET504

    def test_get_enabled_classifications(
        self,
        metadata,
        pii_classification: Classification,
        general_classification: Classification,
        disabled_classification: Classification,
    ):
        """Test fetching enabled classifications."""
        metadata.list_all_entities.return_value = [
            pii_classification,
            general_classification,
            disabled_classification,
        ]

        manager = ClassificationManager(metadata)
        enabled = manager.get_enabled_classifications()

        # Should return only enabled classifications (PII and General)
        assert len(enabled) == 2
        classification_names = [c.name.root for c in enabled]
        assert "PII" in classification_names
        assert "General" in classification_names
        assert "Disabled" not in classification_names

        # Verify configs are populated correctly
        pii_config = next(c.autoClassificationConfig for c in enabled if c.name.root == "PII")
        assert pii_config.minimumConfidence == 0.7
        assert pii_config.conflictResolution == ConflictResolution.highest_confidence
        assert pii_config.enabled is True

    def test_get_enabled_classifications_with_filter(
        self,
        metadata,
        pii_classification: Classification,
        general_classification: Classification,
    ):
        """Test fetching enabled classifications with name filter."""
        metadata.list_all_entities.return_value = [
            pii_classification,
            general_classification,
        ]

        manager = ClassificationManager(metadata)
        enabled = manager.get_enabled_classifications(filter_names=["PII"])

        # Should return only PII
        assert len(enabled) == 1
        assert enabled[0].name.root == "PII"

    def test_get_enabled_classifications_caching(self, metadata, pii_classification: Classification):
        """Test that classifications are cached."""
        metadata.list_all_entities.return_value = [pii_classification]

        manager = ClassificationManager(metadata)

        # First call
        enabled1 = manager.get_enabled_classifications()
        # Second call
        enabled2 = manager.get_enabled_classifications()

        # Should only call API once
        assert metadata.list_all_entities.call_count == 1
        assert enabled1 == enabled2

    def test_get_enabled_tags(
        self,
        metadata,
        pii_classification: Classification,
        email_tag_pii: Tag,
        phone_tag_pii: Tag,
        disabled_tag: Tag,
        tag_without_recognizers: Tag,
    ):
        """Test fetching enabled tags with recognizers."""
        metadata.list_all_entities.return_value = [
            email_tag_pii,
            phone_tag_pii,
            disabled_tag,
            tag_without_recognizers,
        ]

        manager = ClassificationManager(metadata)
        tags = manager.get_enabled_tags(classifications=[pii_classification])

        # Should return only enabled tags with recognizers
        assert len(tags) == 2
        tag_names = [t.name.root for t in tags]
        assert "Email" in tag_names
        assert "Phone" in tag_names
        assert "DisabledTag" not in tag_names
        assert "NoRecognizers" not in tag_names

    def test_get_enabled_tags_multiple_classifications(
        self,
        metadata,
        pii_classification: Classification,
        general_classification: Classification,
        email_tag_pii: Tag,
        credit_card_tag_general: Tag,
    ):
        """Test fetching tags from multiple classifications."""

        def list_entities_side_effect(entity, fields, params, **_):
            if params.get("parent") == "PII":
                return [email_tag_pii]
            elif params.get("parent") == "General":  # noqa: RET505
                return [credit_card_tag_general]
            return []

        metadata.list_all_entities.side_effect = list_entities_side_effect

        manager = ClassificationManager(metadata)
        tags = manager.get_enabled_tags(classifications=[pii_classification, general_classification])

        # Should return tags from both classifications
        assert len(tags) == 2
        tag_fqns = {t.fullyQualifiedName for t in tags}
        assert "PII.Email" in tag_fqns
        assert "General.CreditCard" in tag_fqns

    def test_get_enabled_tags_caching(self, metadata, pii_classification: Classification, email_tag_pii: Tag):
        """Test that tags are cached."""
        metadata.list_all_entities.return_value = [email_tag_pii]

        manager = ClassificationManager(metadata)

        # First call
        tags1 = manager.get_enabled_tags(classifications=[pii_classification])
        # Second call
        tags2 = manager.get_enabled_tags(classifications=[pii_classification])

        # Should only call API once
        assert metadata.list_all_entities.call_count == 1
        assert tags1 == tags2

    def test_clear_cache(self, metadata, pii_classification: Classification, email_tag_pii: Tag):
        """Test clearing the cache."""
        metadata.list_all_entities.return_value = [pii_classification]

        manager = ClassificationManager(metadata)

        # First call
        manager.get_enabled_classifications()
        assert metadata.list_all_entities.call_count == 1

        # Clear cache
        manager.clear_cache()

        # Second call should hit API again
        manager.get_enabled_classifications()
        assert metadata.list_all_entities.call_count == 2

    def test_get_enabled_classifications_api_error(self, metadata):
        """Test handling of API errors."""
        metadata.list_all_entities.side_effect = Exception("API Error")

        manager = ClassificationManager(metadata)
        enabled = manager.get_enabled_classifications()

        # Should return empty list on error
        assert enabled == []

    def test_get_enabled_tags_api_error(self, metadata, pii_classification: Classification):
        """Test handling of API errors when fetching tags."""
        metadata.list_all_entities.side_effect = Exception("API Error")

        manager = ClassificationManager(metadata)
        tags = manager.get_enabled_tags(classifications=[pii_classification])

        # Should return empty list on error
        assert tags == []

    def test_partial_page_failure_keeps_valid_tags_and_retries(self, metadata, pii_classification, email_tag_pii):
        calls = 0

        def tags(*_, **__):
            nonlocal calls
            calls += 1
            yield email_tag_pii
            if calls == 1:
                raise RuntimeError("private response")

        metadata.list_all_entities.side_effect = tags
        status = Status()
        manager = ClassificationManager(metadata, status=status)

        assert manager.get_enabled_tags([pii_classification]) == [email_tag_pii]
        assert len(status.failures) == 1
        assert "private response" not in status.failures[0].error
        assert manager.get_enabled_tags([pii_classification]) == [email_tag_pii]
        assert calls == 2

    def test_empty_results_are_cached(self, metadata, pii_classification):
        metadata.list_all_entities.return_value = []
        manager = ClassificationManager(metadata)

        assert manager.get_enabled_classifications() == []
        assert manager.get_enabled_classifications() == []
        assert manager.get_enabled_tags([pii_classification]) == []
        assert manager.get_enabled_tags([pii_classification]) == []
        assert metadata.list_all_entities.call_count == 2

    def test_parse_diagnostics_filter_disabled_and_unselected(self, pii_classification, email_tag_pii):
        raw_valid = email_tag_pii.model_dump(mode="json", exclude_none=True)
        raw_invalid = {**deepcopy(raw_valid), "name": "SPI", "fullyQualifiedName": "PII.SPI"}
        raw_invalid["recognizers"][0]["recognizerConfig"].pop("supportedLanguage")
        raw_invalid["recognizers"][0]["name"] = "acct-name"
        raw_invalid["recognizers"][0]["recognizerConfig"]["patterns"][0]["regex"] = "private-pattern"
        raw_disabled = {
            **raw_invalid,
            "name": "Disabled",
            "fullyQualifiedName": "PII.Disabled",
            "autoClassificationEnabled": False,
        }
        raw_other = {**raw_invalid, "name": "Other", "fullyQualifiedName": "Other.Bad"}
        sdk = object.__new__(OpenMetadata)
        sdk.client = Mock()
        sdk._use_raw_data = False
        sdk.client.get.return_value = {
            "data": [raw_valid, raw_invalid, raw_disabled, raw_other],
            "paging": {"total": 4},
        }
        status = Status()
        manager = ClassificationManager(sdk, status=status)

        tags = manager.get_enabled_tags([pii_classification])

        assert [tag.name.root for tag in tags] == [email_tag_pii.name.root]
        assert len(status.warnings) == 1
        assert "PII.SPI" in _warning_message(status)
        assert "acct-name" in _warning_message(status)
        assert "supportedLanguage" in _warning_message(status)
        assert "private-pattern" not in _warning_message(status)

    def test_partial_classification_fetch_retains_candidates_and_retries(self, metadata, pii_classification):
        calls = 0

        def classifications(*_, **__):
            nonlocal calls
            calls += 1
            yield pii_classification
            if calls == 1:
                raise RuntimeError("private response")

        metadata.list_all_entities.side_effect = classifications
        status = Status()
        manager = ClassificationManager(metadata, status=status)

        assert manager.get_enabled_classifications() == [pii_classification]
        assert len(status.failures) == 1
        assert manager.get_enabled_classifications() == [pii_classification]
        assert calls == 2

    def test_cache_is_bounded(self, metadata, pii_classification):
        metadata.list_all_entities.return_value = [pii_classification]
        manager = ClassificationManager(metadata)

        for index in range(MAX_CACHE_ENTRIES + 1):
            manager.get_enabled_classifications([f"Other{index}"])

        assert len(manager._classification_cache) == MAX_CACHE_ENTRIES
        metadata.list_all_entities.return_value = []
        manager.get_enabled_tags([pii_classification])
        for index in range(MAX_CACHE_ENTRIES + 1):
            manager.get_enabled_tags([pii_classification.model_copy(update={"name": EntityName(root=f"Other{index}")})])
        assert len(manager._tags_cache) == MAX_CACHE_ENTRIES

    def test_invalid_middle_page_keeps_later_tags_and_other_classification(
        self, pii_classification, general_classification, email_tag_pii, phone_tag_pii, credit_card_tag_general
    ):
        invalid = email_tag_pii.model_dump(mode="json", exclude_none=True)
        invalid["name"] = "SPI"
        invalid["fullyQualifiedName"] = "PII.SPI"
        invalid["recognizers"][0]["recognizerConfig"].pop("supportedLanguage")
        sdk = object.__new__(OpenMetadata)
        sdk.client = Mock()
        sdk._use_raw_data = False
        sdk.client.get.side_effect = [
            {
                "data": [email_tag_pii.model_dump(mode="json", exclude_none=True)],
                "paging": {"total": 3, "after": "middle"},
            },
            {"data": [invalid], "paging": {"total": 3, "after": "last"}},
            {"data": [phone_tag_pii.model_dump(mode="json", exclude_none=True)], "paging": {"total": 3}},
            {"data": [credit_card_tag_general.model_dump(mode="json", exclude_none=True)], "paging": {"total": 1}},
        ]
        status = Status()

        tags = ClassificationManager(sdk, status=status).get_enabled_tags([pii_classification, general_classification])

        assert [tag.name.root for tag in tags] == ["Email", "Phone", "CreditCard"]
        assert len(status.warnings) == 1
        assert "PII.SPI" in _warning_message(status)

    def test_diagnostic_names_second_failing_recognizer(self, pii_classification, email_tag_pii):
        raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
        bad_recognizer = deepcopy(raw["recognizers"][0])
        bad_recognizer["name"] = "second-recognizer"
        bad_recognizer["recognizerConfig"].pop("supportedLanguage")
        bad_recognizer["recognizerConfig"]["patterns"][0]["regex"] = "private-pattern"
        raw["recognizers"].append(bad_recognizer)
        sdk = object.__new__(OpenMetadata)
        sdk.client = Mock()
        sdk._use_raw_data = False
        sdk.client.get.return_value = {"data": [raw], "paging": {"total": 1}}
        status = Status()

        assert ClassificationManager(sdk, status=status).get_enabled_tags([pii_classification]) == []
        assert len(status.warnings) == 1
        assert "second-recognizer" in _warning_message(status)
        assert "supportedLanguage" in _warning_message(status)
        assert "private-pattern" not in _warning_message(status)
        assert "PatternRecognizer" not in _warning_message(status)

    def test_fetch_diagnostic_uses_http_status_without_response_body(self, metadata, pii_classification):
        error = Exception("private response body")
        error.status_code = 503
        metadata.list_all_entities.side_effect = error
        status = Status()

        assert ClassificationManager(metadata, status=status).get_enabled_tags([pii_classification]) == []
        assert status.failures[0].error.endswith("HTTP 503")
        assert "private response body" not in status.failures[0].error

    def test_classification_parse_reports_only_relevant_enabled_selection(self, pii_classification):
        valid = pii_classification.model_dump(mode="json", exclude_none=True)
        invalid_selected = deepcopy(valid)
        invalid_selected.pop("description")
        invalid_selected["autoClassificationConfig"]["enabled"] = True
        invalid_excluded = {**deepcopy(invalid_selected), "name": "Other", "fullyQualifiedName": "Other"}
        invalid_disabled = deepcopy(invalid_selected)
        invalid_disabled["autoClassificationConfig"]["enabled"] = False
        sdk = object.__new__(OpenMetadata)
        sdk.client = Mock()
        sdk._use_raw_data = False
        sdk.client.get.return_value = {
            "data": [valid, invalid_selected, invalid_excluded, invalid_disabled],
            "paging": {"total": 4},
        }
        status = Status()

        classifications = ClassificationManager(sdk, status=status).get_enabled_classifications(["PII"])

        assert [classification.name.root for classification in classifications] == ["PII"]
        assert len(status.warnings) == 1
        assert "PII" in _warning_message(status)
        assert "description" in _warning_message(status)

    def test_exact_terms_error_names_its_branch_field(self, pii_classification, email_tag_pii):
        raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
        raw["recognizers"][0]["name"] = "exact-terms"
        raw["recognizers"][0]["recognizerConfig"] = ExactTermsRecognizerFactory.create().model_dump(
            mode="json", exclude_none=True
        )
        raw["recognizers"][0]["recognizerConfig"].pop("supportedLanguage")
        sdk = object.__new__(OpenMetadata)
        sdk.client = Mock()
        sdk._use_raw_data = False
        sdk.client.get.return_value = {"data": [raw], "paging": {"total": 1}}
        status = Status()

        assert ClassificationManager(sdk, status=status).get_enabled_tags([pii_classification]) == []
        assert len(status.warnings) == 1
        assert "exact-terms" in _warning_message(status)
        assert "supportedLanguage" in _warning_message(status)
        assert "patterns" not in _warning_message(status)
        assert "ExactTermsRecognizer" not in _warning_message(status)

    def test_invalid_exact_terms_language_names_its_field(self, pii_classification, email_tag_pii):
        raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
        raw["recognizers"][0]["recognizerConfig"] = ExactTermsRecognizerFactory.create().model_dump(
            mode="json", exclude_none=True
        )
        raw["recognizers"][0]["recognizerConfig"]["supportedLanguage"] = "unsupported-language"
        sdk = object.__new__(OpenMetadata)
        sdk.client = Mock()
        sdk._use_raw_data = False
        sdk.client.get.return_value = {"data": [raw], "paging": {"total": 1}}
        status = Status()

        assert ClassificationManager(sdk, status=status).get_enabled_tags([pii_classification]) == []
        assert "supportedLanguage" in _warning_message(status)
        assert "unsupported-language" not in _warning_message(status)

    def test_unknown_recognizer_type_reports_type_without_raw_value(self, pii_classification, email_tag_pii):
        raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
        raw["recognizers"][0]["name"] = "acct-recognizer"
        raw["recognizers"][0]["recognizerConfig"]["type"] = "private-bogus-type"
        sdk = object.__new__(OpenMetadata)
        sdk.client = Mock()
        sdk._use_raw_data = False
        sdk.client.get.return_value = {"data": [raw], "paging": {"total": 1}}
        status = Status()

        assert ClassificationManager(sdk, status=status).get_enabled_tags([pii_classification]) == []
        assert len(status.warnings) == 1
        assert "acct-recognizer" in _warning_message(status)
        assert _warning_message(status).endswith("invalid type")
        assert "private-bogus-type" not in _warning_message(status)
        assert "patterns" not in _warning_message(status)

    @pytest.mark.parametrize("invalid_type", [["private"], {"private": "type"}])
    def test_unhashable_recognizer_type_preserves_neighbors(
        self, pii_classification, email_tag_pii, phone_tag_pii, invalid_type
    ):
        bad = email_tag_pii.model_dump(mode="json", exclude_none=True)
        bad["name"] = "SPI"
        bad["fullyQualifiedName"] = "PII.SPI"
        bad["recognizers"][0]["recognizerConfig"]["type"] = invalid_type
        sdk = object.__new__(OpenMetadata)
        sdk.client = Mock()
        sdk._use_raw_data = False
        sdk.client.get.return_value = {
            "data": [
                email_tag_pii.model_dump(mode="json", exclude_none=True),
                bad,
                phone_tag_pii.model_dump(mode="json", exclude_none=True),
            ],
            "paging": {"total": 3},
        }
        status = Status()

        tags = ClassificationManager(sdk, status=status).get_enabled_tags([pii_classification])

        assert [tag.name.root for tag in tags] == ["Email", "Phone"]
        assert len(status.warnings) == 1
        assert _warning_message(status).endswith("invalid type")
        assert "private" not in _warning_message(status)

    def test_punctuated_long_identifiers_remain_visible_in_diagnostic(self, pii_classification, email_tag_pii):
        raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
        tag_name = "PII.Special:$@#" + "x" * 2200 + "TAIL"
        raw["fullyQualifiedName"] = tag_name
        raw["recognizers"][0]["name"] = "acct-num@tenant#1"
        raw["recognizers"][0]["recognizerConfig"].pop("supportedLanguage")
        sdk = object.__new__(OpenMetadata)
        sdk.client = Mock()
        sdk._use_raw_data = False
        sdk.client.get.return_value = {"data": [raw], "paging": {"total": 1}}
        status = Status()

        assert ClassificationManager(sdk, status=status).get_enabled_tags([pii_classification]) == []
        assert len(status.warnings) == 1
        assert next(iter(status.warnings[0])) == tag_name
        assert tag_name in _warning_message(status)
        assert "acct-num@tenant#1" in _warning_message(status)

    def test_control_characters_in_identifier_do_not_break_status_line(self, pii_classification, email_tag_pii):
        raw = email_tag_pii.model_dump(mode="json", exclude_none=True)
        raw["fullyQualifiedName"] = "PII.Special\nName"
        raw["recognizers"][0]["recognizerConfig"].pop("supportedLanguage")
        sdk = object.__new__(OpenMetadata)
        sdk.client = Mock()
        sdk._use_raw_data = False
        sdk.client.get.return_value = {"data": [raw], "paging": {"total": 1}}
        status = Status()

        assert ClassificationManager(sdk, status=status).get_enabled_tags([pii_classification]) == []
        assert next(iter(status.warnings[0])) == "PII.Special?Name"
        assert "\n" not in _warning_message(status)

    def test_timeout_diagnostic_omits_transport_message(self, metadata, pii_classification):
        metadata.list_all_entities.side_effect = Timeout("private URL")
        status = Status()

        assert ClassificationManager(metadata, status=status).get_enabled_tags([pii_classification]) == []
        assert status.failures[0].error.endswith("request timed out")
        assert "private URL" not in status.failures[0].error
