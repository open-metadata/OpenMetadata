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
from unittest.mock import Mock, patch

import pytest
from presidio_analyzer import EntityRecognizer, RecognizerResult, predefined_recognizers
from presidio_analyzer.nlp_engine import NlpArtifacts

from metadata.generated.schema.type.classificationLanguages import ClassificationLanguage
from metadata.generated.schema.type.predefinedRecognizer import Name, PredefinedRecognizer
from metadata.generated.schema.type.recognizer import Recognizer, RecognizerConfig
from metadata.pii.algorithms.presidio_recognizer_factory import PresidioRecognizerFactory
from metadata.pii.algorithms.presidio_utils import (
    MIN_SCORE_FOR_ENHANCEMENT,
    PrefixedItVatRecognizer,
    _get_all_pattern_recognizers,
    apply_confidence_threshold,
    build_analyzer_engine,
    context_matches,
    decorate_recognizer,
    enhance_using_context,
    load_nlp_engine,
    set_presidio_logger_level,
)
from metadata.pii.algorithms.tags import PIITag
from metadata.pii.scanners.ner_scanner import SUPPORTED_LANG


def test_analyzer_supports_all_expected_pii_entities():
    """
    Here we check that the analyzer can potentially detect all our PII entities.
    """
    set_presidio_logger_level()
    analyzer = build_analyzer_engine()

    entities = set(PIITag.values())
    supported_entities = set(analyzer.get_supported_entities(SUPPORTED_LANG))
    assert entities <= supported_entities, (
        f"Analyzer does not support all expected PII entities. {entities - supported_entities}"
    )


class TestApplyConfidenceThreshold:
    """Test the apply_confidence_threshold function"""

    @pytest.fixture
    def mock_recognizer(self):
        """Create a mock EntityRecognizer"""
        recognizer = Mock(spec=EntityRecognizer)
        recognizer.name = "test_recognizer"
        recognizer.supported_entities = ["TEST_ENTITY"]
        return recognizer

    def test_filters_results_below_threshold(self, mock_recognizer):
        """Test that results below threshold are filtered out"""
        # Create mock results with varying confidence scores
        mock_results = [
            RecognizerResult(entity_type="TEST_ENTITY", start=0, end=5, score=0.9),
            RecognizerResult(entity_type="TEST_ENTITY", start=10, end=15, score=0.5),
            RecognizerResult(entity_type="TEST_ENTITY", start=20, end=25, score=0.3),
        ]

        mock_recognizer.analyze = Mock(return_value=mock_results)

        # Apply threshold of 0.6
        threshold = 0.6
        decorator = apply_confidence_threshold(threshold)
        decorated_recognizer = decorator(mock_recognizer)

        # Test the decorated analyze method
        nlp_artifacts = Mock(spec=NlpArtifacts)
        results = decorated_recognizer.analyze("test text", ["TEST_ENTITY"], nlp_artifacts)

        # Should only return results with score >= 0.6
        assert len(results) == 1
        assert results[0].score == 0.9

    def test_returns_all_results_above_threshold(self, mock_recognizer):
        """Test that all results above threshold are kept"""
        mock_results = [
            RecognizerResult(entity_type="TEST_ENTITY", start=0, end=5, score=0.8),
            RecognizerResult(entity_type="TEST_ENTITY", start=10, end=15, score=0.7),
            RecognizerResult(entity_type="TEST_ENTITY", start=20, end=25, score=0.9),
        ]

        mock_recognizer.analyze = Mock(return_value=mock_results)

        threshold = 0.65
        decorator = apply_confidence_threshold(threshold)
        decorated_recognizer = decorator(mock_recognizer)

        nlp_artifacts = Mock(spec=NlpArtifacts)
        results = decorated_recognizer.analyze("test text", ["TEST_ENTITY"], nlp_artifacts)

        # All results should be above threshold
        assert len(results) == 3
        assert all(r.score >= threshold for r in results)

    def test_returns_empty_list_when_no_results_pass_threshold(self, mock_recognizer):
        """Test that empty list is returned when no results pass threshold"""
        mock_results = [
            RecognizerResult(entity_type="TEST_ENTITY", start=0, end=5, score=0.3),
            RecognizerResult(entity_type="TEST_ENTITY", start=10, end=15, score=0.2),
        ]

        mock_recognizer.analyze = Mock(return_value=mock_results)

        threshold = 0.5
        decorator = apply_confidence_threshold(threshold)
        decorated_recognizer = decorator(mock_recognizer)

        nlp_artifacts = Mock(spec=NlpArtifacts)
        results = decorated_recognizer.analyze("test text", ["TEST_ENTITY"], nlp_artifacts)

        assert len(results) == 0

    def test_threshold_of_zero_returns_all_results(self, mock_recognizer):
        """Test that threshold of 0 returns all results"""
        mock_results = [
            RecognizerResult(entity_type="TEST_ENTITY", start=0, end=5, score=0.1),
            RecognizerResult(entity_type="TEST_ENTITY", start=10, end=15, score=0.01),
            RecognizerResult(entity_type="TEST_ENTITY", start=20, end=25, score=0.001),
        ]

        mock_recognizer.analyze = Mock(return_value=mock_results)

        threshold = 0.0
        decorator = apply_confidence_threshold(threshold)
        decorated_recognizer = decorator(mock_recognizer)

        nlp_artifacts = Mock(spec=NlpArtifacts)
        results = decorated_recognizer.analyze("test text", ["TEST_ENTITY"], nlp_artifacts)

        assert len(results) == 3


@patch("metadata.pii.algorithms.presidio_utils._load_spacy_model")
@patch("metadata.pii.algorithms.presidio_utils.SpacyNlpEngine")
class TestLoadNlpEngine:
    @staticmethod
    def setup_method():
        """Clear the cache before each test"""
        load_nlp_engine.cache_clear()

    @staticmethod
    def teardown_method():
        """Clear the cache after each test"""
        load_nlp_engine.cache_clear()

    def test_returns_same_instance_for_same_parameters(self, mock_spacy_engine_class, mock_load_spacy):
        """Test that calling load_nlp_engine with same parameters returns same instance"""
        mock_engine = Mock()
        mock_spacy_engine_class.return_value = mock_engine

        engine1 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")
        engine2 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")

        assert engine1 is engine2
        assert mock_spacy_engine_class.call_count == 1
        assert mock_load_spacy.call_count == 1

    def test_returns_different_instances_for_different_model_names(self, mock_spacy_engine_class, mock_load_spacy):
        """Test that different model names result in different instances"""
        mock_engine1 = Mock()
        mock_engine2 = Mock()
        mock_spacy_engine_class.side_effect = [mock_engine1, mock_engine2]

        engine1 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")
        engine2 = load_nlp_engine(model_name="en_core_web_md", supported_language="en")

        assert engine1 is not engine2
        assert mock_spacy_engine_class.call_count == 2
        assert mock_load_spacy.call_count == 2

    def test_returns_different_instances_for_different_languages(self, mock_spacy_engine_class, mock_load_spacy):
        """Test that different languages result in different instances"""
        mock_engine1 = Mock()
        mock_engine2 = Mock()
        mock_spacy_engine_class.side_effect = [mock_engine1, mock_engine2]

        engine1 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")
        engine2 = load_nlp_engine(model_name="en_core_web_sm", supported_language="fr")

        assert engine1 is not engine2
        assert mock_spacy_engine_class.call_count == 2

    def test_cache_persists_across_multiple_calls(self, mock_spacy_engine_class, mock_load_spacy):
        """Test that cache works correctly across multiple calls"""
        mock_engine = Mock()
        mock_spacy_engine_class.return_value = mock_engine

        engine1 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")
        engine2 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")
        engine3 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")

        assert engine1 is engine2 is engine3
        assert mock_spacy_engine_class.call_count == 1
        assert mock_load_spacy.call_count == 1

    def test_uses_default_parameters_when_not_provided(self, mock_spacy_engine_class, mock_load_spacy):
        """Test that default parameters work correctly with caching"""
        mock_engine = Mock()
        mock_spacy_engine_class.return_value = mock_engine

        engine1 = load_nlp_engine()
        engine2 = load_nlp_engine()

        assert engine1 is engine2
        assert mock_spacy_engine_class.call_count == 1


CVV_CONTEXT = ["cvv", "cvc", "security", "code", "verification", "card", "cvv2", "cid", "csc"]


class TestContextMatches:
    @pytest.mark.parametrize(
        "column_parts",
        [
            ["cvv"],
            ["security", "code"],
            ["card", "verification", "code"],
            ["scenario", "code"],
        ],
    )
    def test_whole_token_matches(self, column_parts):
        assert context_matches(CVV_CONTEXT, column_parts) is True

    @pytest.mark.parametrize(
        "column_parts",
        [
            ["acid", "level"],  # "cid" is a substring of "acid"
            ["incident", "count"],  # "cid" is a substring of "incident"
            ["decoder", "ring"],  # "code" is a substring of "decoder"
            ["discount", "pct"],
        ],
    )
    def test_substring_of_a_token_does_not_match(self, column_parts):
        assert context_matches(CVV_CONTEXT, column_parts) is False

    def test_multi_word_entries_keep_substring_semantics(self):
        assert context_matches(["indian passport", "passport number"], ["passport", "number"]) is True

    def test_no_recognizer_context_never_matches(self):
        assert context_matches([], ["cvv"]) is False

    def test_matching_is_case_insensitive(self):
        assert context_matches(["CVV"], ["Cvv", "Column"]) is True


class TestEnhanceUsingContext:
    @pytest.fixture
    def mock_recognizer(self):
        recognizer = Mock(spec=EntityRecognizer)
        recognizer.context = ["email", "address"]
        recognizer.MAX_SCORE = 1.0
        return recognizer

    @pytest.fixture
    def nlp_artifacts(self):
        return Mock(spec=NlpArtifacts)

    def test_returns_recognizer_with_wrapped_method(self, mock_recognizer):
        original_method = mock_recognizer.enhance_using_context
        result = enhance_using_context(mock_recognizer)

        assert result is mock_recognizer
        assert mock_recognizer.enhance_using_context is not original_method

    def test_no_context_on_recognizer_returns_results_unchanged(self, mock_recognizer, nlp_artifacts):
        mock_recognizer.context = []
        raw_results = [
            RecognizerResult(entity_type="EMAIL_ADDRESS", start=0, end=5, score=0.6),
        ]
        mock_recognizer.enhance_using_context = Mock(return_value=raw_results)

        enhance_using_context(mock_recognizer)

        results = mock_recognizer.enhance_using_context(
            "test@example.com",
            raw_results,
            [],
            nlp_artifacts,
            ["email"],
        )

        assert len(results) == 1
        assert results[0].score == 0.6

    def test_no_context_arg_returns_results_unchanged(self, mock_recognizer, nlp_artifacts):
        raw_results = [
            RecognizerResult(entity_type="EMAIL_ADDRESS", start=0, end=5, score=0.6),
        ]
        mock_recognizer.enhance_using_context = Mock(return_value=raw_results)

        enhance_using_context(mock_recognizer)

        results = mock_recognizer.enhance_using_context("test@example.com", raw_results, [], nlp_artifacts, None)

        assert len(results) == 1
        assert results[0].score == 0.6

    def test_context_match_boosts_score_to_max_and_sets_metadata_flag(self, mock_recognizer, nlp_artifacts):
        raw_results = [
            RecognizerResult(
                entity_type="EMAIL_ADDRESS",
                start=0,
                end=16,
                score=0.6,
                recognition_metadata={},
            ),
        ]
        mock_recognizer.enhance_using_context = Mock(return_value=raw_results)

        enhance_using_context(mock_recognizer)

        results = mock_recognizer.enhance_using_context(
            "test@example.com",
            raw_results,
            [],
            nlp_artifacts,
            ["email"],
        )

        assert len(results) == 1
        assert results[0].score == mock_recognizer.MAX_SCORE
        assert results[0].recognition_metadata[RecognizerResult.IS_SCORE_ENHANCED_BY_CONTEXT_KEY] is True

    def test_context_mismatch_does_not_boost_score(self, mock_recognizer, nlp_artifacts):
        raw_results = [
            RecognizerResult(
                entity_type="EMAIL_ADDRESS",
                start=0,
                end=16,
                score=0.6,
                recognition_metadata={},
            ),
        ]
        mock_recognizer.enhance_using_context = Mock(return_value=raw_results)

        enhance_using_context(mock_recognizer)

        results = mock_recognizer.enhance_using_context(
            "test@example.com",
            raw_results,
            [],
            nlp_artifacts,
            ["correo_electronico"],
        )

        assert len(results) == 1
        assert results[0].score == 0.6
        assert RecognizerResult.IS_SCORE_ENHANCED_BY_CONTEXT_KEY not in results[0].recognition_metadata

    def test_context_word_that_is_only_a_substring_does_not_boost(self, mock_recognizer, nlp_artifacts):
        """`cid` must not boost a column named `acid_level` -- that turned the 0.5 CVV pattern into 1.0."""
        mock_recognizer.context = CVV_CONTEXT
        raw_results = [
            RecognizerResult(
                entity_type="CREDIT_CARD",
                start=0,
                end=3,
                score=0.5,
                recognition_metadata={},
            ),
        ]
        mock_recognizer.enhance_using_context = Mock(return_value=raw_results)

        enhance_using_context(mock_recognizer)

        results = mock_recognizer.enhance_using_context("107", raw_results, [], nlp_artifacts, ["acid", "level"])

        assert len(results) == 1
        assert results[0].score == 0.5
        assert RecognizerResult.IS_SCORE_ENHANCED_BY_CONTEXT_KEY not in results[0].recognition_metadata

    def test_score_below_minimum_is_not_boosted(self, mock_recognizer, nlp_artifacts):
        """Weak patterns (US/IN passport score 0.05-0.1) stay weak even on an exact context hit."""
        raw_results = [
            RecognizerResult(
                entity_type="EMAIL_ADDRESS",
                start=0,
                end=16,
                score=MIN_SCORE_FOR_ENHANCEMENT - 0.01,
                recognition_metadata={},
            ),
        ]
        mock_recognizer.enhance_using_context = Mock(return_value=raw_results)

        enhance_using_context(mock_recognizer)

        results = mock_recognizer.enhance_using_context(
            "test@example.com",
            raw_results,
            [],
            nlp_artifacts,
            ["email"],
        )

        assert len(results) == 1
        assert results[0].score == MIN_SCORE_FOR_ENHANCEMENT - 0.01
        assert RecognizerResult.IS_SCORE_ENHANCED_BY_CONTEXT_KEY not in results[0].recognition_metadata

    def test_already_enhanced_results_are_not_boosted_again(self, mock_recognizer, nlp_artifacts):
        already_enhanced_result = RecognizerResult(
            entity_type="EMAIL_ADDRESS",
            start=0,
            end=16,
            score=0.85,
            recognition_metadata={RecognizerResult.IS_SCORE_ENHANCED_BY_CONTEXT_KEY: True},
        )
        raw_results = [already_enhanced_result]
        mock_recognizer.enhance_using_context = Mock(return_value=raw_results)

        enhance_using_context(mock_recognizer)

        results = mock_recognizer.enhance_using_context(
            "test@example.com",
            raw_results,
            [],
            nlp_artifacts,
            ["email"],
        )

        assert len(results) == 1
        assert results[0].score == 0.85

    def test_calls_old_enhancing_function_with_correct_arguments(self, mock_recognizer, nlp_artifacts):
        raw_results = [
            RecognizerResult(
                entity_type="EMAIL_ADDRESS",
                start=0,
                end=16,
                score=0.6,
                recognition_metadata={},
            ),
        ]
        other_results: list = []
        context = ["email"]
        text = "test@example.com"

        original_enhance = Mock(return_value=raw_results)
        mock_recognizer.enhance_using_context = original_enhance

        enhance_using_context(mock_recognizer)

        mock_recognizer.enhance_using_context(text, raw_results, other_results, nlp_artifacts, context)

        assert original_enhance.call_count == 1
        call_args = original_enhance.call_args
        assert call_args.args[0] == text
        assert call_args.args[1] is raw_results
        assert call_args.args[2] is other_results
        assert call_args.args[3] is nlp_artifacts
        assert call_args.args[4] == context


class TestDecorateRecognizer:
    @pytest.fixture
    def mock_recognizer(self):
        recognizer = Mock(spec=EntityRecognizer)
        recognizer.name = "base_recognizer"
        return recognizer

    def test_with_no_decorators_returns_recognizer_unchanged(self, mock_recognizer):
        composed = decorate_recognizer()
        result = composed(mock_recognizer)

        assert result is mock_recognizer

    def test_with_single_decorator_applies_it(self, mock_recognizer):
        decorated_recognizer = Mock(spec=EntityRecognizer)
        single_decorator = Mock(return_value=decorated_recognizer)

        composed = decorate_recognizer(single_decorator)
        result = composed(mock_recognizer)

        single_decorator.assert_called_once_with(mock_recognizer)
        assert result is decorated_recognizer

    def test_with_multiple_decorators_applies_them_in_order(self, mock_recognizer):
        call_order = []

        intermediate = Mock(spec=EntityRecognizer)
        final = Mock(spec=EntityRecognizer)

        def first_decorator(rec: EntityRecognizer) -> EntityRecognizer:
            call_order.append("first")
            assert rec is mock_recognizer
            return intermediate

        def second_decorator(rec: EntityRecognizer) -> EntityRecognizer:
            call_order.append("second")
            assert rec is intermediate
            return final

        composed = decorate_recognizer(first_decorator, second_decorator)
        result = composed(mock_recognizer)

        assert call_order == ["first", "second"]
        assert result is final

    def test_returns_a_callable(self, mock_recognizer):
        composed = decorate_recognizer()

        assert callable(composed)


# NRIC/FIN values, including F2601815M, are synthetic checksum fixtures, not issued identities.
def configured(name: Name, language: ClassificationLanguage, context: list[str] | None = None):
    recognizer = PresidioRecognizerFactory.create_recognizer(
        Recognizer(
            name=f"test_{name.value}",
            recognizerConfig=RecognizerConfig(
                root=PredefinedRecognizer(
                    type="predefined",
                    name=name,
                    supportedLanguage=language,
                    context=context,
                )
            ),
        )
    )
    assert recognizer is not None
    return recognizer


@pytest.mark.parametrize("value", ["S1234567D", "T1234567J", "F2601815M", "G1234567X", "m7654321j"])
def test_valid_fin_checksum_keeps_pattern_score_without_context(value):
    recognizer = configured(Name.SgFinRecognizer, ClassificationLanguage.en, context=["nric"])
    text = f"sku: {value}; done"
    results = recognizer.analyze(text, recognizer.supported_entities)
    assert [(result.entity_type, result.score, text[result.start : result.end]) for result in results] == [
        ("SG_NRIC_FIN", 0.5, value)
    ]


@pytest.mark.parametrize(
    "name,language,value",
    [
        (Name.IbanRecognizer, ClassificationLanguage.en, "GB82 WEST 1234 5698 7654 32"),
        (Name.EsNifRecognizer, ClassificationLanguage.es, "12345678Z"),
        (Name.EsNieRecognizer, ClassificationLanguage.es, "X1234567L"),
        (Name.SgUenRecognizer, ClassificationLanguage.en, "T15LP0010D"),
        (Name.AuAbnRecognizer, ClassificationLanguage.en, "51 824 753 556"),
        (Name.AuAcnRecognizer, ClassificationLanguage.en, "004 085 616"),
        (Name.SgFinRecognizer, ClassificationLanguage.en, "T1234567J"),
        (Name.SgFinRecognizer, ClassificationLanguage.en, "F1234567N"),
        (Name.SgFinRecognizer, ClassificationLanguage.en, "G1234567X"),
        (Name.SgFinRecognizer, ClassificationLanguage.en, "M1234567K"),
    ],
)
def test_canonical_and_other_prefixes(name, language, value):
    recognizer = configured(name, language)
    assert [
        value[result.start : result.end] for result in recognizer.analyze(value, recognizer.supported_entities)
    ] == [value]


@pytest.mark.parametrize(
    "prefix,valid,wrong", [("S", "D", "E"), ("T", "J", "Z"), ("F", "N", "M"), ("G", "X", "W"), ("M", "K", "X")]
)
def test_nric_prefix_specific_checksum(prefix, valid, wrong):
    recognizer = configured(Name.SgFinRecognizer, ClassificationLanguage.en)
    assert len(recognizer.analyze(f"{prefix}1234567{valid}", recognizer.supported_entities)) == 1
    assert recognizer.analyze(f"{prefix}1234567{wrong}", recognizer.supported_entities) == []


@pytest.mark.parametrize(
    "digits,check_letter",
    [
        ("0000000", "J"),
        ("0000001", "I"),
        ("0000002", "G"),
        ("0000003", "E"),
        ("0000004", "C"),
        ("0000005", "A"),
        ("0000006", "Z"),
        ("0000007", "H"),
        ("0000008", "F"),
        ("0000009", "D"),
        ("0000027", "B"),
    ],
)
def test_nric_s_series_all_checksum_remainders(digits, check_letter):
    recognizer = configured(Name.SgFinRecognizer, ClassificationLanguage.en)
    value = f"S{digits}{check_letter}"
    assert len(recognizer.analyze(value, recognizer.supported_entities)) == 1
    assert recognizer.analyze(f"S{digits}X", recognizer.supported_entities) == []


def test_repeated_identifiers_return_distinct_original_spans():
    recognizer = configured(Name.SgFinRecognizer, ClassificationLanguage.en)
    value = "S1234567D"
    text = f"{value}; {value}"
    assert [(result.start, result.end) for result in recognizer.analyze(text, recognizer.supported_entities)] == [
        (0, len(value)),
        (len(value) + 2, len(text)),
    ]


def test_iban_in_prose_preserves_complete_span_and_next_candidate():
    recognizer = configured(Name.IbanRecognizer, ClassificationLanguage.en)
    text = "Deposit GB82 WEST 1234 5698 7654 32 today; DE89370400440532013000 tomorrow."
    assert [text[result.start : result.end] for result in recognizer.analyze(text, recognizer.supported_entities)] == [
        "GB82 WEST 1234 5698 7654 32",
        "DE89370400440532013000",
    ]


@pytest.mark.parametrize(
    "value",
    [
        "GB 82 WEST 1234 5698 7654 32",
        "GB-82-WEST-1234-5698-7654-32",
    ],
)
def test_iban_existing_country_separator_forms(value):
    recognizer = configured(Name.IbanRecognizer, ClassificationLanguage.en)
    assert [
        value[result.start : result.end] for result in recognizer.analyze(value, recognizer.supported_entities)
    ] == [value]


@pytest.mark.parametrize(
    "name,expected_language",
    [
        (Name.EsNifRecognizer, "en"),
        (Name.EsNieRecognizer, "en"),
        (Name.ItVatCodeRecognizer, "en"),
        (Name.SgFinRecognizer, "en"),
    ],
)
def test_omitted_language_uses_schema_default(name, expected_language):
    recognizer = PresidioRecognizerFactory.create_recognizer(
        Recognizer(
            name=f"default_{name.value}",
            recognizerConfig=RecognizerConfig(root=PredefinedRecognizer(type="predefined", name=name)),
        )
    )
    assert recognizer is not None
    assert recognizer.supported_language == expected_language


def test_legacy_registry_uses_the_validated_fin_adapter():
    recognizer = next(rec for rec in _get_all_pattern_recognizers() if rec.name == "ValidatedSgFinRecognizer")
    assert recognizer.analyze("S1234567E", recognizer.supported_entities) == []
    assert len(recognizer.analyze("S1234567D", recognizer.supported_entities)) == 1


@pytest.mark.parametrize(
    "name,language,value,score",
    [
        (Name.IbanRecognizer, ClassificationLanguage.en, "gb82 west 1234 5698 7654 32", 0.5),
        (Name.EsNifRecognizer, ClassificationLanguage.es, "12345678z", 0.5),
        (Name.EsNieRecognizer, ClassificationLanguage.es, "x1234567l", 0.5),
        (Name.SgUenRecognizer, ClassificationLanguage.en, "t15lp0010d", 0.3),
        (Name.AuAbnRecognizer, ClassificationLanguage.en, "51-824-753-556", 0.3),
        (Name.AuAcnRecognizer, ClassificationLanguage.en, "004-085-616", 0.3),
        (Name.ItVatCodeRecognizer, ClassificationLanguage.it, "IT12345678903", 1.0),
    ],
)
def test_identifier_variants_preserve_span_and_require_context(name, language, value, score):
    recognizer = configured(name, language)
    text = f"value: {value}; done"
    results = recognizer.analyze(text, recognizer.supported_entities)
    assert [(text[result.start : result.end], result.score) for result in results] == [(value, score)]


@pytest.mark.parametrize(
    "name,value",
    [
        (Name.IbanRecognizer, "GB82 WEST 1234 5698 7654 32"),
        (Name.EsNifRecognizer, "12345678Z"),
        (Name.EsNieRecognizer, "X1234567L"),
        (Name.SgUenRecognizer, "T15LP0010D"),
        (Name.AuAbnRecognizer, "51 824 753 556"),
        (Name.AuAbnRecognizer, "51824753556"),
        (Name.AuAcnRecognizer, "004 085 616"),
        (Name.AuAcnRecognizer, "004085616"),
        (Name.ItVatCodeRecognizer, "12345678903"),
        (Name.ItVatCodeRecognizer, "IT 12345678903"),
    ],
)
def test_canonical_identifier_scores_and_spans_match_upstream(name, value):
    upstream = getattr(predefined_recognizers, name.value)()
    adapted = configured(name, ClassificationLanguage.en)
    expected = upstream.analyze(value, upstream.supported_entities)
    actual = adapted.analyze(value, adapted.supported_entities)
    assert [(r.start, r.end, r.score) for r in actual] == [(r.start, r.end, r.score) for r in expected]


@pytest.mark.parametrize(
    "name,value",
    [
        (Name.IbanRecognizer, "gb83 west 1234 5698 7654 32"),
        (Name.EsNifRecognizer, "12345678a"),
        (Name.EsNieRecognizer, "x1234567a"),
        (Name.SgUenRecognizer, "t15lp0010x"),
        (Name.AuAbnRecognizer, "51-824-753-557"),
        (Name.AuAcnRecognizer, "004-085-617"),
        (Name.ItVatCodeRecognizer, "IT12345678904"),
        (Name.ItVatCodeRecognizer, "IT00000000000"),
        (Name.SgFinRecognizer, "A1234567D"),
        (Name.SgFinRecognizer, "M7654321M"),
        (Name.EsNifRecognizer, "12345678\u017f"),
        (Name.EsNieRecognizer, "X1234567\u212a"),
        (Name.SgUenRecognizer, "\u017f15LP0010D"),
        (Name.SgFinRecognizer, "\u017f1234567D"),
        (Name.SgFinRecognizer, "S1234567\u212a"),
        (Name.ItVatCodeRecognizer, "İT12345678903"),
    ],
)
def test_invalid_identifier_checksums_and_unicode_lookalikes_are_rejected(name, value):
    recognizer = configured(name, ClassificationLanguage.en)
    assert recognizer.analyze(value, recognizer.supported_entities) == []


@pytest.mark.parametrize(
    "name,value",
    [(Name.AuAbnRecognizer, "51-824-753-556"), (Name.AuAcnRecognizer, "004-085-616")],
)
@pytest.mark.parametrize("enclosure", ["X{}", "{}9", "_{}", "{}-", "9 {}", "{} - 9", "9 _ {}", "{} 9"])
def test_new_hyphenated_forms_reject_larger_tokens_and_numeric_runs(name, value, enclosure):
    recognizer = configured(name, ClassificationLanguage.en)
    assert recognizer.analyze(enclosure.format(value), recognizer.supported_entities) == []


@pytest.mark.parametrize(
    "name,text,value",
    [
        (Name.AuAbnRecognizer, "ABN 51 824 753 556 - Acme Pty Ltd", "51 824 753 556"),
        (Name.AuAbnRecognizer, "ABN 51-824-753-556 - Acme Pty Ltd", "51-824-753-556"),
        (Name.AuAcnRecognizer, "ACN 004-085-616 _ Acme Pty Ltd", "004-085-616"),
        (Name.IbanRecognizer, "GB82 WEST 1234 5698 7654 32 - Barclays", "GB82 WEST 1234 5698 7654 32"),
        (Name.IbanRecognizer, "gb82 west 1234 5698 7654 32 - Barclays", "gb82 west 1234 5698 7654 32"),
        (Name.ItVatCodeRecognizer, "I paid it 12345678903", "12345678903"),
    ],
)
def test_identifier_in_prose_preserves_upstream_punctuation_handling(name, text, value):
    recognizer = configured(name, ClassificationLanguage.en)
    assert [text[r.start : r.end] for r in recognizer.analyze(text, recognizer.supported_entities)] == [value]


def test_identifier_factory_preserves_configured_language_and_context():
    recognizer = configured(Name.SgFinRecognizer, ClassificationLanguage.es, context=["custom_identifier"])
    assert recognizer.supported_language == "es"
    assert recognizer.context == ["custom_identifier"]
    assert recognizer.name == "ValidatedSgFinRecognizer"


def test_vat_validator_rejects_unicode_prefix_before_normalizing():
    assert PrefixedItVatRecognizer().validate_result("\u0130T12345678903") is False
