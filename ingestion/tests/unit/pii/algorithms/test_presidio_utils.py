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
import re
from unittest.mock import Mock, patch

import pytest
from presidio_analyzer import EntityRecognizer, RecognizerResult
from presidio_analyzer.nlp_engine import NlpArtifacts
from presidio_analyzer.predefined_recognizers import CreditCardRecognizer, IpRecognizer, PhoneRecognizer, UrlRecognizer

from metadata.pii.algorithms.presidio_utils import (
    MIN_SCORE_FOR_ENHANCEMENT,
    apply_confidence_threshold,
    build_analyzer_engine,
    context_matches,
    decorate_recognizer,
    enhance_using_context,
    load_nlp_engine,
    recognizer_factories,
    set_presidio_logger_level,
)
from metadata.pii.algorithms.tags import PIITag
from metadata.pii.scanners.ner_scanner import SUPPORTED_LANG


def _registered_recognizer(recognizer_class: type[EntityRecognizer]) -> EntityRecognizer:
    return recognizer_factories.get(recognizer_class, recognizer_class)()


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Card 4111111111111111 issued", "4111111111111111"),
        ("(4111-1111-1111-1111)", "4111-1111-1111-1111"),
        ("'4111 1111 1111 1111'", "4111 1111 1111 1111"),
        ("Card 4111111111111111 2025", "4111111111111111"),
        ("4111111111111111 2025", "4111111111111111"),
        ("4111111111111111" + " " * 2028 + "2025", "4111111111111111"),
        ("4322 7148 2639 4388 390", "4322 7148 2639 4388 390"),
        ("4111 1111 1111 1111 2025", "4111 1111 1111 1111"),
        ("3782 822463 10005", "3782 822463 10005"),
        ("6221 2600 0000 0000 001", "6221 2600 0000 0000 001"),
        ("4222222222222", "4222222222222"),
        ("4000000000000000006", "4000000000000000006"),
        ("4991123456788", "4991123456788"),
        ("4930123456786", "4930123456786"),
        ("4989123456782", "4989123456782"),
        ("é 4111111111111111 and 5555555555554444", "4111111111111111"),
    ],
)
def test_card_results_use_original_candidate_spans(text, expected):
    recognizer = _registered_recognizer(CreditCardRecognizer)
    results = recognizer.analyze(text, ["CREDIT_CARD"])

    assert any(text[result.start : result.end] == expected for result in results)
    assert all(result.score == 1.0 for result in results)
    assert all(
        result.recognition_metadata[RecognizerResult.RECOGNIZER_NAME_KEY] == recognizer.name for result in results
    )
    assert all(result.analysis_explanation.pattern_name == "Credit Card Number" for result in results)


@pytest.mark.parametrize("card", ["4939323083746", "4924867307503760", "4930582239178"])
def test_valid_card_is_not_vetoed_by_phone_overlap(card):
    recognizer = _registered_recognizer(CreditCardRecognizer)
    results = recognizer.analyze(f"Reference {card} recorded", ["CREDIT_CARD"])
    assert [(result.start, result.end, result.score) for result in results] == [(10, 10 + len(card), 1.0)]


def test_competing_phone_and_card_evidence_remain_independent():
    value = "4991123456788"
    card = _registered_recognizer(CreditCardRecognizer)
    phone = PhoneRecognizer()
    assert [(result.start, result.end, result.score) for result in card.analyze(value, ["CREDIT_CARD"])] == [
        (0, len(value), 1.0)
    ]
    assert any(result.start == 0 and result.end == len(value) for result in phone.analyze(value, ["PHONE_NUMBER"]))


@pytest.mark.parametrize(
    "text",
    [
        "4111 1111 1111 1111 123",
        "4322 7148 2639 4388 391",
    ],
)
def test_card_does_not_recover_prefix_from_plausible_complete_candidate(text):
    recognizer = _registered_recognizer(CreditCardRecognizer)
    assert recognizer.analyze(text, ["CREDIT_CARD"]) == []


@pytest.mark.parametrize("length", [2049, 4999, 5000])
def test_compact_card_followed_by_distant_year_within_preprocessing_limit(length):
    card = "4111111111111111"
    text = card + " " * (length - len(card) - len("2025")) + "2025"
    recognizer = _registered_recognizer(CreditCardRecognizer)
    results = recognizer.analyze(text, ["CREDIT_CARD"])
    assert [(result.start, result.end, text[result.start : result.end]) for result in results] == [(0, 16, card)]


@pytest.mark.parametrize(
    "text",
    [
        "4111111111111112",
        "4111-1111-1111-1112",
        "x4111111111111111",
        "41111111111111111",
        "4111--1111--1111--1111",
        "1234 4111111111111111",
        "4111111111111111.25",
        "0.4111111111111111",
        "4111111111111111e2",
        "4111111111111111_suffix",
        "+49 1512 3456787",
        "Call me on +49 1512 3456787 tomorrow",
        "+ 49 1512 3456787",
        "+ 4111111111111111",
        ("+" + " " * 20 + "4111111111111111"),
        "Scores 41 12 34 56 78 90 12 38 final",
        "Batch 5 312 34567 8901233 done",
        "4111-1111 1111-1111",
        "4111 1111 1111 1111 123 45",
    ],
)
def test_card_rejects_invalid_enclosing_candidate(text):
    recognizer = _registered_recognizer(CreditCardRecognizer)
    assert recognizer.analyze(text, ["CREDIT_CARD"]) == []


@pytest.mark.parametrize(
    ("recognizer_class", "entity", "text", "expected", "score"),
    [
        (UrlRecognizer, "URL", "Visit https://example.com/a.b?x=1&y=2.", "https://example.com/a.b?x=1&y=2", 0.6),
        (UrlRecognizer, "URL", "https://example.com/a?value=wow!", "https://example.com/a?value=wow!", 0.6),
        (UrlRecognizer, "URL", "https://example.com/v1;", "https://example.com/v1;", 0.6),
        (UrlRecognizer, "URL", "https://example.com#section!", "https://example.com#section!", 0.6),
        (UrlRecognizer, "URL", "https://example.company/path", "https://example.company/path", 0.6),
        (UrlRecognizer, "URL", "https://example.community/path", "https://example.community/path", 0.6),
        (UrlRecognizer, "URL", "https://example.international/path", "https://example.international/path", 0.6),
        (UrlRecognizer, "URL", "https://example.com:8443/path", "https://example.com:8443/path", 0.6),
        (UrlRecognizer, "URL", "Visit https://example.org!", "https://example.org", 0.6),
        (UrlRecognizer, "URL", "https://example.org/a://b", "https://example.org/a://b", 0.6),
        (UrlRecognizer, "URL", "HTTPS://example.com/path", "HTTPS://example.com/path", 0.6),
        (UrlRecognizer, "URL", "('http://example.org/a(b)c')", "http://example.org/a(b)c", 0.6),
        (UrlRecognizer, "URL", "<https://example.com/path.>", "https://example.com/path.", 0.6),
        (UrlRecognizer, "URL", "<https://example.com/path,>", "https://example.com/path,", 0.6),
        (UrlRecognizer, "URL", "'https://example.com/path,'", "https://example.com/path,", 0.6),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.5:8080/health", "10.0.0.5", 0.6),
        (IpRecognizer, "IP_ADDRESS", "192.168.1.1/index.html", "192.168.1.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "ftp://10.0.0.1/file", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "smb://10.0.0.1/share", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "src_ip:10.0.0.1", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "client_ip:10.0.0.1", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "dead_key:10.0.0.1:65535/health", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.0/abc", "10.0.0.0", 0.6),
        (IpRecognizer, "IP_ADDRESS", "10.1.2.3:51234/abc", "10.1.2.3", 0.6),
        (UrlRecognizer, "URL", 'He said "visit https://example.com."', "https://example.com", 0.6),
        (UrlRecognizer, "URL", "'example.com,'", "example.com", 0.5),
        (UrlRecognizer, "URL", "<https://example.com.>", "https://example.com", 0.6),
        (UrlRecognizer, "URL", '"https://example.com/?x=1."', "https://example.com/?x=1.", 0.6),
        (UrlRecognizer, "URL", "<https://example.com#part,>", "https://example.com#part,", 0.6),
        (IpRecognizer, "IP_ADDRESS", "ftp://10.0.0.1/123", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "ftp://user@10.0.0.1/123", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "ftp://@10.0.0.1/123", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "smb://@10.0.0.1:8080/123", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "ftp://" + "u" * 1000 + "@10.0.0.1/123", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "smb://user:pass@10.0.0.1:8080/123", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "ftp://user%40name@10.0.0.1/123", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "smb://10.0.0.1/123", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.1/24foo", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.1/2025.json", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.1/8.1", "10.0.0.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "IP 2001:db8::1 recorded", "2001:db8::1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "é 192.168.1.1 and 2001:db8::1", "192.168.1.1", 0.6),
        (
            IpRecognizer,
            "IP_ADDRESS",
            "2001:0db8:0000:0000:0000:0000:0000:0001",
            "2001:0db8:0000:0000:0000:0000:0000:0001",
            0.6,
        ),
        (IpRecognizer, "IP_ADDRESS", "fe80::1%eth0", "fe80::1%eth0", 0.6),
        (IpRecognizer, "IP_ADDRESS", "::ffff:192.0.2.128", "::ffff:192.0.2.128", 0.6),
        (IpRecognizer, "IP_ADDRESS", "http://192.168.1.1/123", "192.168.1.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "http://192.168.1.1:8080/path", "192.168.1.1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "10.1.2.3:51234", "10.1.2.3", 0.6),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.0/8", "10.0.0.0", 0.6),
        (IpRecognizer, "IP_ADDRESS", "2001:db8::1/64", "2001:db8::1", 0.6),
        (IpRecognizer, "IP_ADDRESS", "::", "::", 0.1),
    ],
    ids=[
        "url-prose-dot",
        "url-query-exclamation",
        "url-path-semicolon",
        "url-fragment-exclamation",
        "url-company-suffix",
        "url-community-suffix",
        "url-international-suffix",
        "url-port",
        "url-host-exclamation",
        "url-scheme-in-path",
        "url-uppercase-scheme",
        "url-balanced-parentheses",
        "url-delimited-path-dot",
        "url-delimited-path-comma",
        "url-quoted-path-comma",
        "ipv4-port-health-path",
        "ipv4-html-path",
        "ftp-ipv4-path",
        "smb-ipv4-path",
        "ipv4-src-label",
        "ipv4-client-label",
        "ipv4-label-port-path",
        "ipv4-nonnumeric-path",
        "ipv4-port-nonnumeric-path",
        "url-quoted-prose-bare-host-dot",
        "url-quoted-bare-host-comma",
        "url-delimited-bare-host-dot",
        "url-quoted-query-dot",
        "url-delimited-fragment-comma",
        "ftp-ipv4-numeric-path",
        "ftp-user-ipv4-numeric-path",
        "ftp-empty-user-ipv4-numeric-path",
        "smb-empty-user-ipv4-port-numeric-path",
        "ftp-long-user-ipv4-numeric-path",
        "smb-password-ipv4-port-numeric-path",
        "ftp-encoded-user-ipv4-numeric-path",
        "smb-ipv4-numeric-path",
        "ipv4-numeric-word-path",
        "ipv4-cidr-looking-json-path",
        "ipv4-decimal-path",
        "ipv6-prose",
        "ipv4-unicode-offset",
        "ipv6-expanded",
        "ipv6-zone",
        "ipv6-mapped",
        "http-ipv4-numeric-path",
        "http-ipv4-port-path",
        "ipv4-port",
        "ipv4-cidr",
        "ipv6-cidr",
        "ipv6-unspecified",
    ],
)
def test_network_results_use_complete_original_candidate(recognizer_class, entity, text, expected, score):
    recognizer = _registered_recognizer(recognizer_class)
    results = recognizer.analyze(text, [entity])

    assert any(text[result.start : result.end] == expected and result.score == score for result in results)
    assert all(
        result.recognition_metadata[RecognizerResult.RECOGNIZER_NAME_KEY] == recognizer.name for result in results
    )
    assert all(result.analysis_explanation.pattern_name for result in results)


@pytest.mark.parametrize("length", [2049, 4999, 5000])
def test_url_candidate_within_preprocessing_limit_keeps_full_span(length):
    url = "https://example.com/" + "a" * (length - len("https://example.com/"))
    recognizer = _registered_recognizer(UrlRecognizer)
    results = recognizer.analyze(url, ["URL"])
    assert [(result.start, result.end, url[result.start : result.end]) for result in results] == [(0, length, url)]


def test_url_candidate_above_preprocessing_limit_is_bounded():
    url = "https://example.com/" + "a" * (5001 - len("https://example.com/"))
    recognizer = _registered_recognizer(UrlRecognizer)
    assert recognizer.analyze(url, ["URL"]) == []


@pytest.mark.parametrize(
    ("recognizer_class", "entity", "text"),
    [
        (UrlRecognizer, "URL", "http://app.internal.local/path"),
        (UrlRecognizer, "URL", "https://example.com.invalid/path"),
        (UrlRecognizer, "URL", "user@example.com"),
        (UrlRecognizer, "URL", "https://example.org:abc/path"),
        (IpRecognizer, "IP_ADDRESS", "2001:db8::1g"),
        (IpRecognizer, "IP_ADDRESS", "192.168.1.999"),
        (IpRecognizer, "IP_ADDRESS", "x192.168.1.1"),
        (IpRecognizer, "IP_ADDRESS", "192.168.1.1-invalid"),
        (IpRecognizer, "IP_ADDRESS", "fe80::1%bad-scope"),
        (IpRecognizer, "IP_ADDRESS", "10.1.2.3:65536"),
        (IpRecognizer, "IP_ADDRESS", "10.1.2.3:abc"),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.0/33"),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.0/8/24"),
        (IpRecognizer, "IP_ADDRESS", "10.1.2.3:51234/8"),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.1/99999"),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.1/24:80"),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.1/24/path"),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.1/" + "9" * 5000),
        (IpRecognizer, "IP_ADDRESS", "abc:10.0.0.1"),
        (IpRecognizer, "IP_ADDRESS", "::ffff:999.10.0.0.1"),
        (IpRecognizer, "IP_ADDRESS", "bad_key:::ffff:999.10.0.0.1"),
        (IpRecognizer, "IP_ADDRESS", "dead_key:2001:db8::1g"),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.1/123"),
        (IpRecognizer, "IP_ADDRESS", "1ftp://user@10.0.0.1/123"),
        (IpRecognizer, "IP_ADDRESS", "not_ftp://user@10.0.0.1/123"),
        (IpRecognizer, "IP_ADDRESS", "ftp:/user@10.0.0.1/123"),
        (IpRecognizer, "IP_ADDRESS", "ftp://user/path@10.0.0.1/123"),
        (IpRecognizer, "IP_ADDRESS", "ftp://user?name@10.0.0.1/123"),
        (IpRecognizer, "IP_ADDRESS", "ftp://user#name@10.0.0.1/123"),
        (IpRecognizer, "IP_ADDRESS", "ftp://user@@10.0.0.1/123"),
        (IpRecognizer, "IP_ADDRESS", "ftp://user%ZZ@10.0.0.1/123"),
        (IpRecognizer, "IP_ADDRESS", "10.0.0.1/8:12"),
        (IpRecognizer, "IP_ADDRESS", "2001:db8::10.0.0.1g"),
        (IpRecognizer, "IP_ADDRESS", "2001:db8::1/129"),
    ],
)
def test_network_rejects_invalid_longer_candidate(recognizer_class, entity, text):
    recognizer = _registered_recognizer(recognizer_class)
    assert recognizer.analyze(text, [entity]) == []


@pytest.mark.parametrize(
    ("recognizer_class", "entity", "text", "expected"),
    [
        (
            CreditCardRecognizer,
            "CREDIT_CARD",
            "é 4111111111111111 5555555555554444",
            [(2, 18, "4111111111111111"), (19, 35, "5555555555554444")],
        ),
        (
            IpRecognizer,
            "IP_ADDRESS",
            "é 192.168.1.1 2001:db8::1",
            [(2, 13, "192.168.1.1"), (14, 25, "2001:db8::1")],
        ),
        (
            UrlRecognizer,
            "URL",
            "https://example.com/x https://example.org/y",
            [(0, 21, "https://example.com/x"), (22, 43, "https://example.org/y")],
        ),
    ],
)
def test_multiple_candidates_have_exact_independent_spans(recognizer_class, entity, text, expected):
    recognizer = _registered_recognizer(recognizer_class)
    results = recognizer.analyze(text, [entity])
    assert [(result.start, result.end, text[result.start : result.end]) for result in results] == expected


@pytest.mark.parametrize(
    ("recognizer_class", "entity", "text"),
    [
        (CreditCardRecognizer, "CREDIT_CARD", "4" * 10000),
        (IpRecognizer, "IP_ADDRESS", "f:" * 5000),
        (UrlRecognizer, "URL", "https://example.com/" + "a" * 5000),
    ],
)
def test_pathological_candidate_runs_are_bounded(recognizer_class, entity, text):
    recognizer = _registered_recognizer(recognizer_class)
    assert recognizer.analyze(text, [entity]) == []


def test_legacy_analyzer_uses_complete_candidate_spans():
    analyzer = build_analyzer_engine()
    text = "Card 4111-1111-1111-1111, https://example.company/a and 2001:db8::1"
    results = analyzer.analyze(text, language="en", entities=["CREDIT_CARD", "URL", "IP_ADDRESS"])
    assert {(result.entity_type, text[result.start : result.end]) for result in results} == {
        ("CREDIT_CARD", "4111-1111-1111-1111"),
        ("URL", "https://example.company/a"),
        ("IP_ADDRESS", "2001:db8::1"),
    }


@pytest.mark.parametrize(
    ("recognizer_class", "entity", "text", "candidate"),
    [
        (CreditCardRecognizer, "CREDIT_CARD", "é 4111-1111-1111-1111", "4111111111111111"),
        (IpRecognizer, "IP_ADDRESS", "é 2001:db8::1/64", "2001:db8::1"),
    ],
    ids=["normalized-card", "ipv6-with-cidr"],
)
def test_candidate_analysis_preserves_upstream_results_and_artifact_coordinates(
    monkeypatch, recognizer_class, entity, text, candidate
):
    upstream_analyze = recognizer_class.analyze
    upstream_results = []
    coordinates = []
    candidate_artifacts = []

    def capture(self, text, entities, nlp_artifacts=None, regex_flags=None):
        candidate_artifacts.append(nlp_artifacts)
        assert text == candidate
        results = upstream_analyze(self, text, entities, nlp_artifacts, regex_flags)
        upstream_results.extend(results)
        coordinates.extend((result.start, result.end) for result in results)
        return results

    monkeypatch.setattr(recognizer_class, "analyze", capture)
    recognizer = _registered_recognizer(recognizer_class)
    engine = load_nlp_engine()
    engine.load()
    artifacts = engine.process_text(text, "en")
    results = recognizer.analyze(text, [entity], artifacts)

    assert candidate_artifacts == [None]
    assert [(result.start, result.end) for result in upstream_results] == coordinates == [(0, len(candidate))]
    assert len(results) == 1
    assert results[0] is not upstream_results[0]
    assert (results[0].start, results[0].end) == (2, 21 if entity == "CREDIT_CARD" else 13)
    assert results[0].score == upstream_results[0].score
    assert results[0].recognition_metadata == upstream_results[0].recognition_metadata
    assert results[0].analysis_explanation == upstream_results[0].analysis_explanation


def test_url_expansion_does_not_mutate_upstream_seed_offsets(monkeypatch):
    upstream_analyze = UrlRecognizer.analyze
    seeds = []
    coordinates = []

    def capture(self, text, entities, nlp_artifacts=None, regex_flags=None):
        results = upstream_analyze(self, text, entities, nlp_artifacts, regex_flags)
        seeds.extend(results)
        coordinates.extend((result.start, result.end) for result in results)
        return results

    monkeypatch.setattr(UrlRecognizer, "analyze", capture)
    text = '"https://example.com/a"'
    results = _registered_recognizer(UrlRecognizer).analyze(text, ["URL"])
    assert [(seed.start, seed.end) for seed in seeds] == coordinates == [(0, len(text))]
    assert [(result.start, result.end) for result in results] == [(1, len(text) - 1)]
    assert results[0] is not seeds[0]
    assert results[0].score == seeds[0].score
    assert results[0].recognition_metadata == seeds[0].recognition_metadata
    assert results[0].analysis_explanation == seeds[0].analysis_explanation


def test_url_seed_and_public_host_rules_remain_compatible_with_presidio():
    upstream = UrlRecognizer()
    value = '"https://example.com/a"'
    seeds = upstream.analyze(value, ["URL"])
    assert len(seeds) == 1
    assert value[seeds[0].start] == '"'
    assert seeds[0].analysis_explanation.pattern_name == "Quoted URL"
    assert re.fullmatch(upstream.BASE_URL_REGEX, "example.company", re.IGNORECASE)
    assert not re.fullmatch(upstream.BASE_URL_REGEX, "app.internal.local", re.IGNORECASE)
    recognizer = _registered_recognizer(UrlRecognizer)
    results = recognizer.analyze(value, ["URL"])
    assert [(value[result.start : result.end], result.score) for result in results] == [
        ("https://example.com/a", seeds[0].score)
    ]


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


def test_keyed_network_candidates_keep_unicode_offsets_and_metadata():
    text = "é src_ip:10.0.0.1/path; client_ip:192.168.1.1:8080/health"
    recognizer = _registered_recognizer(IpRecognizer)
    results = recognizer.analyze(text, ["IP_ADDRESS"])
    assert [(result.start, result.end) for result in results] == [(9, 17), (34, 45)]
    assert [text[result.start : result.end] for result in results] == ["10.0.0.1", "192.168.1.1"]
    assert all(
        result.recognition_metadata[RecognizerResult.RECOGNIZER_NAME_KEY] == recognizer.name for result in results
    )
    assert all(
        result.recognition_metadata[RecognizerResult.RECOGNIZER_IDENTIFIER_KEY] == recognizer.id for result in results
    )


def test_delimited_bare_urls_keep_independent_unicode_spans():
    text = 'é "https://example.com." and <https://example.org,>'
    recognizer = _registered_recognizer(UrlRecognizer)
    results = recognizer.analyze(text, ["URL"])
    assert [(result.start, result.end) for result in results] == [(3, 22), (30, 49)]
    assert [text[result.start : result.end] for result in results] == ["https://example.com", "https://example.org"]
    assert all(
        result.recognition_metadata[RecognizerResult.RECOGNIZER_NAME_KEY] == recognizer.name for result in results
    )
    assert all(
        result.recognition_metadata[RecognizerResult.RECOGNIZER_IDENTIFIER_KEY] == recognizer.id for result in results
    )
