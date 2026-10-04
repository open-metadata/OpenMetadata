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
"""Checks candidate spans and checksums through configured recognizers.

NRIC fixtures are synthetic. The weights, offsets, and remainder tables were checked
against IonBazan/NRIC@90f60a8 and samliew/singapore-nric@275f8a6; SAP KBA 2572734
publishes the equivalent reverse-index rule, but its public page is preview-only.
Neither checksum validity nor these fixtures assert that an identifier was issued.
"""

import pytest

from metadata.generated.schema.type.classificationLanguages import ClassificationLanguage
from metadata.generated.schema.type.piiEntity import PIIEntity
from metadata.generated.schema.type.predefinedRecognizer import Name, PredefinedRecognizer
from metadata.generated.schema.type.recognizer import Recognizer, RecognizerConfig
from metadata.pii.algorithms.presidio_recognizer_factory import PresidioRecognizerFactory
from metadata.pii.algorithms.presidio_utils import _get_all_pattern_recognizers


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


@pytest.mark.parametrize(
    "name,language,value",
    [
        (Name.IbanRecognizer, ClassificationLanguage.en, "gb82 west 1234 5698 7654 32"),
        (Name.EsNifRecognizer, ClassificationLanguage.es, "12345678z"),
        (Name.EsNieRecognizer, ClassificationLanguage.es, "x1234567l"),
        (Name.SgUenRecognizer, ClassificationLanguage.en, "t15lp0010d"),
        (Name.AuAbnRecognizer, ClassificationLanguage.en, "51-824-753-556"),
        (Name.AuAcnRecognizer, ClassificationLanguage.en, "004-085-616"),
        (Name.ItVatCodeRecognizer, ClassificationLanguage.it, "IT12345678903"),
        (Name.ItVatCodeRecognizer, ClassificationLanguage.it, "IT 12345678903"),
        (Name.ItVatCodeRecognizer, ClassificationLanguage.it, "12345678903"),
        (Name.SgFinRecognizer, ClassificationLanguage.en, "S1234567D"),
        (Name.SgFinRecognizer, ClassificationLanguage.en, "m7654321j"),
    ],
)
def test_valid_identifiers_keep_exact_original_span(name, language, value):
    recognizer = configured(name, language)
    text = f"value: {value}; done"
    results = recognizer.analyze(text, recognizer.supported_entities)
    assert [(result.entity_type, text[result.start : result.end]) for result in results] == [
        (recognizer.supported_entities[0], value)
    ]


@pytest.mark.parametrize(
    "name,language,value",
    [
        (Name.EsNifRecognizer, ClassificationLanguage.es, "12345678A"),
        (Name.IbanRecognizer, ClassificationLanguage.en, "GB83 WEST 1234 5698 7654 32"),
        (Name.EsNieRecognizer, ClassificationLanguage.es, "X1234567A"),
        (Name.SgUenRecognizer, ClassificationLanguage.en, "T15LP0010X"),
        (Name.AuAbnRecognizer, ClassificationLanguage.en, "51-824-753-557"),
        (Name.AuAcnRecognizer, ClassificationLanguage.en, "004-085-617"),
        (Name.ItVatCodeRecognizer, ClassificationLanguage.it, "IT12345678904"),
        (Name.ItVatCodeRecognizer, ClassificationLanguage.it, "IT-12345678903"),
        (Name.ItVatCodeRecognizer, ClassificationLanguage.it, "IT  12345678903"),
        (Name.ItVatCodeRecognizer, ClassificationLanguage.it, "IT - 12345678903"),
        (Name.ItVatCodeRecognizer, ClassificationLanguage.it, "DE 12345678903"),
        (Name.SgFinRecognizer, ClassificationLanguage.en, "S1234567E"),
        (Name.SgFinRecognizer, ClassificationLanguage.en, "A1234567D"),
        (Name.SgFinRecognizer, ClassificationLanguage.en, "M7654321M"),
        (Name.AuAbnRecognizer, ClassificationLanguage.en, "51--824-753-556"),
        (Name.AuAcnRecognizer, ClassificationLanguage.en, "004-085--616"),
        (Name.IbanRecognizer, ClassificationLanguage.en, "GB82  WEST 1234 5698 7654 32"),
    ],
)
def test_invalid_identifier_has_no_evidence(name, language, value):
    recognizer = configured(name, language, context=["sg_nric"])
    assert recognizer.analyze(value, recognizer.supported_entities) == []


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


@pytest.mark.parametrize(
    "name,language,value",
    [
        (Name.IbanRecognizer, ClassificationLanguage.en, "GB82 WEST 1234 5698 7654 32"),
        (Name.EsNifRecognizer, ClassificationLanguage.es, "12345678Z"),
        (Name.EsNieRecognizer, ClassificationLanguage.es, "X1234567L"),
        (Name.SgUenRecognizer, ClassificationLanguage.en, "T15LP0010D"),
        (Name.AuAbnRecognizer, ClassificationLanguage.en, "51-824-753-556"),
        (Name.AuAcnRecognizer, ClassificationLanguage.en, "004-085-616"),
        (Name.ItVatCodeRecognizer, ClassificationLanguage.it, "IT12345678903"),
        (Name.SgFinRecognizer, ClassificationLanguage.en, "S1234567D"),
    ],
)
@pytest.mark.parametrize("enclosure", ["X{}", "{}9", "é{}", "{}é", "_{}", "{}-"])
def test_identifiers_do_not_match_inside_larger_tokens(name, language, value, enclosure):
    recognizer = configured(name, language)
    assert recognizer.analyze(enclosure.format(value), recognizer.supported_entities) == []


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
    "value",
    [
        "GB82 WEST 1234 5698 7654 32 99",
        "GB82 WEST 1234 5698 7654 32 -",
        "GB82 WEST 1234 5698 7654 32 --foo",
        "GB82 WEST 1234 5698 7654 32 9",
    ],
)
def test_iban_rejects_malformed_numeric_or_separator_continuation(value):
    recognizer = configured(Name.IbanRecognizer, ClassificationLanguage.en)
    assert recognizer.analyze(value, recognizer.supported_entities) == []


@pytest.mark.parametrize(
    "name,expected_language",
    [
        (Name.EsNifRecognizer, "en"),
        (Name.EsNieRecognizer, "en"),
        (Name.ItVatCodeRecognizer, "en"),
        (Name.SgFinRecognizer, "en"),
    ],
)
def test_omitted_language_uses_predefined_family_default(name, expected_language):
    recognizer = PresidioRecognizerFactory.create_recognizer(
        Recognizer(
            name=f"default_{name.value}",
            recognizerConfig=RecognizerConfig(root=PredefinedRecognizer(type="predefined", name=name)),
        )
    )
    assert recognizer is not None
    assert recognizer.supported_language == expected_language


def test_configured_entity_language_and_context_survive_adapter():
    recognizer = PresidioRecognizerFactory.create_recognizer(
        Recognizer(
            name="configured_fin",
            confidenceThreshold=0.8,
            recognizerConfig=RecognizerConfig(
                root=PredefinedRecognizer(
                    type="predefined",
                    name=Name.SgFinRecognizer,
                    supportedLanguage=ClassificationLanguage.es,
                    supportedEntities=[PIIEntity.SG_NRIC_FIN],
                    context=["sg_nric"],
                )
            ),
        )
    )
    assert recognizer is not None
    assert recognizer.supported_language == "es"
    assert recognizer.context == ["sg_nric"]
    assert [result.entity_type for result in recognizer.analyze("S1234567D", recognizer.supported_entities)] == [
        "SG_NRIC_FIN"
    ]
    assert recognizer.analyze("S1234567E", recognizer.supported_entities) == []


def test_legacy_registry_uses_the_validated_fin_adapter():
    recognizer = next(rec for rec in _get_all_pattern_recognizers() if rec.name == "SgFinRecognizer")
    assert recognizer.analyze("S1234567E", recognizer.supported_entities) == []
    assert len(recognizer.analyze("S1234567D", recognizer.supported_entities)) == 1


@pytest.mark.parametrize("lookalike", ["\u017f1234567D", "S1234567\u212a", "\u0130T12345678903", "12345678\u017f"])
def test_unicode_casefold_lookalikes_are_rejected(lookalike):
    name = (
        Name.ItVatCodeRecognizer
        if "12345678903" in lookalike
        else Name.EsNifRecognizer
        if "12345678" in lookalike
        else Name.SgFinRecognizer
    )
    language = (
        ClassificationLanguage.it
        if name is Name.ItVatCodeRecognizer
        else ClassificationLanguage.es
        if name is Name.EsNifRecognizer
        else ClassificationLanguage.en
    )
    recognizer = configured(name, language)
    assert recognizer.analyze(lookalike, recognizer.supported_entities) == []


def test_bare_vat_follows_ordinary_prose():
    recognizer = configured(Name.ItVatCodeRecognizer, ClassificationLanguage.it)
    text = "Invoice value 12345678903 is registered"
    assert [text[result.start : result.end] for result in recognizer.analyze(text, recognizer.supported_entities)] == [
        "12345678903"
    ]
