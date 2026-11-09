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
"""Exercise identifier matching and attribution with the shipped configuration."""

import copy
import json
from pathlib import Path
from uuid import uuid4

import pytest
import spacy
from presidio_analyzer.nlp_engine import SpacyNlpEngine

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.type.classificationLanguages import ClassificationLanguage
from metadata.pii.algorithms.tag_scoring import TagScorer
from metadata.pii.tag_analyzer import TagAnalyzer


@pytest.fixture(scope="module")
def sensitive_tag():
    seed = (
        Path(__file__).resolve().parents[5]
        / "openmetadata-service/src/main/resources/json/data/tags/piiTagsWithRecognizers.json"
    )
    config = json.loads(seed.read_text())
    return next(tag for tag in config["createTags"] if tag["name"] == "Sensitive")


@pytest.fixture(scope="module")
def nlp_engine():
    """Pattern matching needs tokenization, not downloaded statistical NER models."""
    engine = SpacyNlpEngine()
    engine.nlp = {language: spacy.blank("en") for language in ("en", "pl", "it", "fi")}
    return engine


def _analyzer(sensitive_tag, nlp_engine, name, language, column_name, *, all_recognizers=False):
    config = copy.deepcopy(sensitive_tag)
    config.update(id=str(uuid4()), fullyQualifiedName="PII.Sensitive")
    if not all_recognizers:
        config["recognizers"] = [rec for rec in config["recognizers"] if rec["recognizerConfig"].get("name") == name]
    for recognizer in config["recognizers"]:
        recognizer["id"] = str(uuid4())
    return TagAnalyzer(
        tag=Tag.model_validate(config),
        column=Column(name=column_name, dataType="STRING", fullyQualifiedName=f"test.table.{column_name}"),
        nlp_engine=nlp_engine,
        language=ClassificationLanguage(language),
    )


@pytest.mark.parametrize(
    "name,language,column_name,entity,value,matched_text",
    [
        ("PlPeselRecognizer", "pl", "pesel", "PL_PESEL", "44051401458", "44051401458"),
        ("PlPeselRecognizer", "pl", "pesel", "PL_PESEL", "prefix 44051401458 suffix", "44051401458"),
        ("PlPeselRecognizer", "pl", "pesel_test", "PL_PESEL", "44051401452", None),
        ("PlPeselRecognizer", "pl", "pesel", "PL_PESEL", "4893252880957013", None),
        ("PlPeselRecognizer", "pl", "pesel", "PL_PESEL", "144051401458", None),
        ("PlPeselRecognizer", "pl", "pesel", "PL_PESEL", "440514014581", None),
        ("PlPeselRecognizer", "pl", "pesel", "PL_PESEL", "00222912349", "00222912349"),
        ("PlPeselRecognizer", "pl", "pesel", "PL_PESEL", "00410112340", "00410112340"),
        ("PlPeselRecognizer", "pl", "pesel", "PL_PESEL", "00610112346", "00610112346"),
        ("PlPeselRecognizer", "pl", "pesel", "PL_PESEL", "00810112342", "00810112342"),
        ("ItFiscalCodeRecognizer", "it", "codice_fiscale", "IT_FISCAL_CODE", "RSSMRA85T10A562S", "RSSMRA85T10A562S"),
        ("ItFiscalCodeRecognizer", "it", "codice_fiscale", "IT_FISCAL_CODE", "RSSMRA85T10A56NH", "RSSMRA85T10A56NH"),
        ("ItFiscalCodeRecognizer", "it", "codice_fiscale_test", "IT_FISCAL_CODE", "RSSMRA85T10A562A", None),
        ("AuAcnRecognizer", "en", "acn", "AU_ACN", "000 250 000", "000 250 000"),
        ("AuAcnRecognizer", "en", "acn", "AU_ACN", "004 085 616", "004 085 616"),
        ("AuAcnRecognizer", "en", "acn", "AU_ACN", "000-250-000", "000-250-000"),
        ("AuAcnRecognizer", "en", "value", "AU_ACN", "000-250-000", None),
        ("AuAcnRecognizer", "en", "acn", "AU_ACN", "000 250 001", None),
        ("FiPersonalIdentityCodeRecognizer", "fi", "hetu", "FI_PERSONAL_IDENTITY_CODE", "010101-002S", "010101-002S"),
        ("FiPersonalIdentityCodeRecognizer", "fi", "hetu", "FI_PERSONAL_IDENTITY_CODE", "010101-002s", "010101-002s"),
        ("FiPersonalIdentityCodeRecognizer", "fi", "hetu", "FI_PERSONAL_IDENTITY_CODE", "010101-002\u017f", None),
        ("FiPersonalIdentityCodeRecognizer", "fi", "hetu", "FI_PERSONAL_IDENTITY_CODE", "290200A1239", "290200A1239"),
        ("FiPersonalIdentityCodeRecognizer", "fi", "hetu_test", "FI_PERSONAL_IDENTITY_CODE", "290200-1239", None),
        ("FiPersonalIdentityCodeRecognizer", "fi", "hetu", "FI_PERSONAL_IDENTITY_CODE", "290200U1239", None),
        ("FiPersonalIdentityCodeRecognizer", "fi", "hetu", "FI_PERSONAL_IDENTITY_CODE", "010101+123N", "010101+123N"),
    ],
)
def test_shipped_identifier_matching(
    sensitive_tag, nlp_engine, name, language, column_name, entity, value, matched_text
):
    analyzer = _analyzer(sensitive_tag, nlp_engine, name, language, column_name)
    results = [result for result in analyzer.analyze([value]).recognizer_results if result.entity_type == entity]

    if matched_text is None:
        assert results == []
    else:
        start = value.index(matched_text)
        assert [(result.start, result.end) for result in results] == [(start, start + len(matched_text))]
        assert value[results[0].start : results[0].end] == matched_text


@pytest.mark.parametrize(
    "name,language,column_name,value",
    [
        ("PlPeselRecognizer", "pl", "pesel", "44051401458"),
        ("ItFiscalCodeRecognizer", "it", "codice_fiscale", "RSSMRA85T10A56NH"),
        ("AuAcnRecognizer", "en", "acn", "000 250 000"),
        ("FiPersonalIdentityCodeRecognizer", "fi", "hetu", "010101-002S"),
    ],
)
def test_shipped_identifier_scorer_attribution(sensitive_tag, nlp_engine, name, language, column_name, value):
    analyzer = _analyzer(sensitive_tag, nlp_engine, name, language, column_name)
    [score] = TagScorer(tag_analyzers=[analyzer]).predict_scores([value])

    assert score.recognizer_metadata is not None
    assert score.recognizer_metadata.recognizerName == name
    assert score.recognizer_metadata.recognizerId == analyzer.tag.recognizers[0].id


@pytest.mark.parametrize("value,expected", [("44051401458", True), ("4893252880957013", False)])
def test_pesel_with_all_shipped_recognizers(sensitive_tag, nlp_engine, value, expected):
    analyzer = _analyzer(sensitive_tag, nlp_engine, "PlPeselRecognizer", "pl", "pesel", all_recognizers=True)
    results = analyzer.analyze([value]).recognizer_results
    assert any(result.entity_type == "PL_PESEL" for result in results) is expected
