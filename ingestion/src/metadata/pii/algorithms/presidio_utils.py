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
Utilities for working with the Presidio Library.
"""

import inspect
import ipaddress
import logging
import re
import types
from collections.abc import Callable, Iterable
from copy import copy
from functools import cache, wraps
from itertools import groupby
from typing import ClassVar, cast
from urllib.parse import SplitResult, urlsplit

import spacy
from dateutil import parser
from presidio_analyzer import (
    AnalyzerEngine,
    EntityRecognizer,
    Pattern,
    PatternRecognizer,
    RecognizerRegistry,
    RecognizerResult,
    predefined_recognizers,
)
from presidio_analyzer.nlp_engine import NlpArtifacts, SpacyNlpEngine
from presidio_analyzer.predefined_recognizers import (
    AuTfnRecognizer,
    CreditCardRecognizer,
    DateRecognizer,
    InAadhaarRecognizer,
    NhsRecognizer,
    UsBankRecognizer,
    UsLicenseRecognizer,
)
from presidio_analyzer.predefined_recognizers import (
    IpRecognizer as PresidioIpRecognizer,
)
from presidio_analyzer.predefined_recognizers import (
    UrlRecognizer as PresidioUrlRecognizer,
)
from spacy.cli.download import download  # pyright: ignore[reportUnknownVariableType]

from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.pii.algorithms import patterns, presidio_constants
from metadata.pii.constants import (
    LANGUAGE_MODEL_MAPPING,
    PRESIDIO_LOGGER,
    SPACY_EN_MODEL,
    SUPPORTED_LANG,
)
from metadata.utils.dispatch import class_register
from metadata.utils.logger import pii_logger

logger = pii_logger()

MIN_SCORE_FOR_ENHANCEMENT = 0.3

_CONTEXT_TOKEN_SEPARATORS = re.compile(r"[^0-9a-z]+")
_MAX_CANDIDATE_LENGTH = 5000
_MAX_IP_ADDRESS_LENGTH = 45
_MAX_PORT = 65535
_CARD_CANDIDATES = re.compile(r"\d[\d -]*\d|\d")
_CARD_PARTS = re.compile(r"\S+")
_TRAILING_YEAR = re.compile(r"(?:19|20)\d{2}")
_IP_CANDIDATES = re.compile(r"[\w:.%-]+")
_IP_LABEL = re.compile(r"[a-zA-Z_]\w*")
_NON_HEX = re.compile(r"[^0-9a-fA-F]")
_CIDR_SUFFIX = re.compile(r"/(\d+)(?![\w.])")
_URI_AUTHORITY_PREFIX = re.compile(
    r"(?<![\w.+-])[a-zA-Z][a-zA-Z0-9+.-]*://"
    r"(?:(?:[a-zA-Z0-9._~!$&'()*+,;=:-]|%[0-9a-fA-F]{2})*@)?\[?$"
)


def context_matches(recognizer_context: Iterable[str], context: list[str]) -> bool:
    """
    Whether any of the recognizer's context words is present in the given context
    (the column name, split into its parts by `split_column_name`).

    Single-word context entries are matched against whole tokens, never as substrings.
    A plain `"cid" in "acid level"` test is true, which would boost the CVV recognizer on
    any column whose name merely contains the letters of a context word -- `acid_level`,
    `incident_count`, `decoder_ring` -- turning a 0.5 "3-4 digits" regex into a 1.0 match.
    Multi-word entries keep substring semantics; they have no single token to compare against.
    """
    context_lower = " ".join(context).lower()
    tokens = {token for token in _CONTEXT_TOKEN_SEPARATORS.split(context_lower) if token}

    for ctx_word in recognizer_context:
        word = ctx_word.lower()
        parts = [part for part in _CONTEXT_TOKEN_SEPARATORS.split(word) if part]
        if len(parts) == 1:
            if parts[0] in tokens:
                return True
        elif word in context_lower:
            return True

    return False


@cache
def load_nlp_engine(
    model_name: str | None = None,
    supported_language: str | None = None,
    classification_language: ClassificationLanguage | None = None,
) -> SpacyNlpEngine:
    if classification_language:
        model_name = get_model_for_language(classification_language)
        supported_language = classification_language.value
    else:
        model_name = model_name or SPACY_EN_MODEL
        supported_language = supported_language or SUPPORTED_LANG

    _load_spacy_model(model_name)
    model = {
        "lang_code": supported_language,
        "model_name": model_name,
    }
    return SpacyNlpEngine(models=[model])


def get_model_for_language(language: ClassificationLanguage) -> str:
    return LANGUAGE_MODEL_MAPPING[language]


def build_analyzer_engine(
    language: ClassificationLanguage = ClassificationLanguage.en,
) -> AnalyzerEngine:
    """
    Build a Presidio analyzer engine for the language and tailored to our use case.

    If the model is not found locally, it will be downloaded.
    """
    model_name = get_model_for_language(language)
    supported_language = language.value

    nlp_engine = load_nlp_engine(model_name=model_name, supported_language=supported_language)
    recognizer_registry = RecognizerRegistry(
        recognizers=list(_get_all_pattern_recognizers()),
        supported_languages=[supported_language],
    )
    return AnalyzerEngine(
        nlp_engine=nlp_engine,
        supported_languages=[supported_language],
        registry=recognizer_registry,
    )


def set_presidio_logger_level(log_level: int | str = logging.ERROR) -> None:
    """
    Set the presidio logger to talk less about internal entities unless we are debugging.
    """
    logging.getLogger(PRESIDIO_LOGGER).setLevel(log_level)


def _load_spacy_model(model_name: str) -> None:
    """
    Load the spaCy model for the given language.
    If the model is not found locally, it will be downloaded.
    """

    try:
        _ = spacy.load(model_name)
    except OSError:
        logger.warning(f"Downloading {model_name} language model for the spaCy")
        download(model_name)
        _ = spacy.load(model_name)


def _get_all_entity_recognizer_classes() -> Iterable[type[EntityRecognizer]]:
    """
    Iterate over all subclasses of the `EntityRecognizer` exposed
    in the predefined_recognizers module.
    """
    exported: list[str] = list(getattr(predefined_recognizers, "__all__", []))
    for name in exported:
        obj = getattr(predefined_recognizers, name, None)
        if inspect.isclass(obj) and issubclass(obj, EntityRecognizer):
            yield obj


recognizer_factories = class_register()


def _has_card_shape(candidate: str) -> bool:
    return any(pattern.fullmatch(candidate) for pattern in patterns.CARD_GROUPING_PATTERNS)


def _remap_result(result: RecognizerResult, start: int, end: int) -> RecognizerResult:
    mapped = copy(result)
    mapped.start, mapped.end = start, end
    return mapped


def _whole_candidate_results(
    analyze: Callable[..., list[RecognizerResult]],
    candidate: str,
    entities: list[str],
    start: int,
    end: int,
    regex_flags: int | None,
) -> list[RecognizerResult]:
    # Full-text NLP artifacts have incompatible offsets when analyzing a substring.
    return [
        _remap_result(result, start, end)
        for result in analyze(candidate, entities, nlp_artifacts=None, regex_flags=regex_flags)
        if result.start == 0 and result.end == len(candidate)
    ]


def _is_embedded_card_token(text: str, start: int, end: int) -> bool:
    if start and (text[start - 1].isalnum() or text[start - 1] in "_.-"):
        return True
    return end < len(text) and (
        text[end].isalnum() or text[end] in "_-" or (text[end] == "." and text[end + 1 : end + 2].isdigit())
    )


def _is_phone_prefixed(text: str, start: int) -> bool:
    preceding = start - 1
    while preceding >= 0 and text[preceding] in " \t":
        preceding -= 1
    return preceding >= 0 and text[preceding] == "+"


def _iter_card_candidates(text: str) -> Iterable[tuple[int, int]]:
    for match in _CARD_CANDIDATES.finditer(text):
        start, end = match.span()
        if (
            end - start <= _MAX_CANDIDATE_LENGTH
            and not _is_embedded_card_token(text, start, end)
            and not _is_phone_prefixed(text, start)
        ):
            yield start, end


def _card_prefix_before_year(candidate: str) -> str | None:
    # Recover a separate year only; shorter suffixes may complete a 19-digit card.
    prefix, separator, suffix = candidate.rpartition(" ")
    prefix = prefix.rstrip(" ")
    if separator and _TRAILING_YEAR.fullmatch(suffix) and _has_card_shape(prefix):
        return prefix
    return None


class SanitizedCreditCardRecognizer(CreditCardRecognizer):
    def _analyze_card_candidate(
        self, candidate: str, entities: list[str], start: int, end: int, regex_flags: int | None
    ) -> list[RecognizerResult]:
        normalized = self.sanitize_value(candidate, self.replacement_pairs)
        return _whole_candidate_results(super().analyze, normalized, entities, start, end, regex_flags)

    def analyze(
        self,
        text: str,
        entities: list[str],
        nlp_artifacts: NlpArtifacts | None = None,
        regex_flags: int | None = None,
    ) -> list[RecognizerResult]:
        results: list[RecognizerResult] = []
        for start, end in _iter_card_candidates(text):
            candidate = text[start:end]
            if _has_card_shape(candidate):
                whole_results = self._analyze_card_candidate(candidate, entities, start, end, regex_flags)
                if whole_results:
                    results.extend(whole_results)
                    continue
            parts = list(_CARD_PARTS.finditer(candidate))
            if len(parts) >= 2 and all(_has_card_shape(part.group()) for part in parts):
                for part in parts:
                    results.extend(
                        self._analyze_card_candidate(
                            part.group(), entities, start + part.start(), start + part.end(), regex_flags
                        )
                    )
            prefix = _card_prefix_before_year(candidate)
            if prefix is not None:
                results.extend(self._analyze_card_candidate(prefix, entities, start, start + len(prefix), regex_flags))
        return results


@recognizer_factories.add(  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
    CreditCardRecognizer
)
def credit_card_factory(
    *,
    supported_language: str = SUPPORTED_LANG,
    context: list[str] | None = None,
) -> SanitizedCreditCardRecognizer:
    return SanitizedCreditCardRecognizer(
        patterns=patterns.credit_cards,
        supported_language=supported_language,
        context=context,
    )


def _extend_to_url_end(text: str, start: int) -> int | None:
    end = start
    depth = 0
    while end < len(text) and text[end] not in " \t\r\n<>\"'":
        char = text[end]
        if char == "(":
            depth += 1
        elif char == ")":
            if depth == 0:
                break
            depth -= 1
        end += 1
    return None if depth else end


def _trim_url_prose_punctuation(text: str, start: int, end: int) -> int:
    if end == len(text) or text[end] not in ">\"'":
        while end > start and text[end - 1] in ".,":
            end -= 1
    return end


def _split_url(candidate: str) -> SplitResult | None:
    has_scheme = candidate.lower().startswith(("http://", "https://"))
    try:
        return urlsplit(candidate if has_scheme else f"//{candidate}")
    except ValueError:
        return None


def _parse_url_candidate(candidate: str) -> tuple[str, SplitResult] | None:
    parsed = _split_url(candidate)
    if parsed is None:
        return None
    if not parsed.path and not parsed.query and not parsed.fragment:
        trimmed = candidate.rstrip(".,!;")
        if trimmed != candidate:
            candidate = trimmed
            parsed = _split_url(candidate)
            if parsed is None:
                return None
    try:
        port = parsed.port
    except ValueError:
        return None
    if port is not None and not 1 <= port <= _MAX_PORT:
        return None
    return candidate, parsed


# Keep URL/IP class names: Presidio derives identity metadata from them and accepts no name override.
class UrlRecognizer(PresidioUrlRecognizer):
    def analyze(
        self,
        text: str,
        entities: list[str],
        nlp_artifacts: NlpArtifacts | None = None,
        regex_flags: int | None = None,
    ) -> list[RecognizerResult]:
        results: list[RecognizerResult] = []
        seen: set[tuple[int, int]] = set()
        for seed in super().analyze(text, entities, nlp_artifacts, regex_flags):
            # Presidio's quoted patterns can include the opening quote; other seeds start at the host.
            start = seed.start + (text[seed.start] in "\"'")
            if start and (text[start - 1].isalnum() or text[start - 1] in "@._-"):
                continue
            end = _extend_to_url_end(text, start)
            if end is None:
                continue
            end = _trim_url_prose_punctuation(text, start, end)
            candidate = text[start:end]
            if not candidate or len(candidate) > _MAX_CANDIDATE_LENGTH:
                continue
            parsed_candidate = _parse_url_candidate(candidate)
            if parsed_candidate is None:
                continue
            candidate, parsed = parsed_candidate
            # Keep Presidio's public-host policy, including its BASE_URL_REGEX suffix list.
            if (
                parsed.scheme not in ("", "http", "https")
                or not parsed.hostname
                or not re.fullmatch(self.BASE_URL_REGEX, parsed.hostname, flags=re.IGNORECASE)
            ):
                continue
            end = start + len(candidate)
            if (start, end) not in seen:
                results.append(_remap_result(seed, start, end))
                seen.add((start, end))
        return results


@recognizer_factories.add(  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
    PresidioUrlRecognizer
)
def url_factory(*, supported_language: str = SUPPORTED_LANG, context: list[str] | None = None) -> UrlRecognizer:
    return UrlRecognizer(supported_language=supported_language, context=context)


def _cidr_suffix_is_valid(prefix: str, max_prefixlen: int, trailing_char: str | None) -> bool:
    # Bound conversion too: Python rejects integer strings over its digit limit.
    return len(prefix) <= 3 and int(prefix) <= max_prefixlen and (trailing_char is None or trailing_char not in "/:%-")


def _skip_ip_label_prefix(token: str) -> int:
    """Skip word-key labels, but retain hex-only prefixes that may be malformed IPv6."""
    key, separator, _ = token.partition(":")
    if separator and _IP_LABEL.fullmatch(key) and _NON_HEX.search(key):
        return len(key) + 1
    return 0


def _is_uri_authority(text: str, start: int) -> bool:
    # Malformed identifier-prefixed schemes must not turn a CIDR into a URI path.
    return bool(_URI_AUTHORITY_PREFIX.search(text[max(0, start - _MAX_CANDIDATE_LENGTH) : start]))


class IpRecognizer(PresidioIpRecognizer):
    def __init__(self, *, supported_language: str = SUPPORTED_LANG, context: list[str] | None = None):
        # Anchored patterns retain Presidio's scores, invalidation and result metadata
        # after ipaddress validates the complete candidate, including mapped IPv6.
        super().__init__(
            patterns=[
                Pattern("IPv4", r"^[0-9.]+$", 0.6),
                Pattern("IPv6", r"^(?!::$)[0-9a-fA-F:.]+(?:%[a-zA-Z0-9]+)?$", 0.6),
                Pattern("IPv6", r"^::$", 0.1),
            ],
            supported_language=supported_language,
            context=context,
        )

    def analyze(
        self,
        text: str,
        entities: list[str],
        nlp_artifacts: NlpArtifacts | None = None,
        regex_flags: int | None = None,
    ) -> list[RecognizerResult]:
        results: list[RecognizerResult] = []
        for match in _IP_CANDIDATES.finditer(text):
            start, end = match.span()
            token_end = end
            start += _skip_ip_label_prefix(text[start:end])
            while end > start and text[end - 1] == ".":
                end -= 1
            candidate = text[start:end]
            if not any(char in candidate for char in ".:") or len(candidate) > _MAX_IP_ADDRESS_LENGTH:
                continue
            if candidate.count(":") == 1:
                address, _, port = candidate.rpartition(":")
                try:
                    ipaddress.IPv4Address(address)
                except ValueError:
                    pass
                else:
                    if not port.isdecimal() or not 1 <= int(port) <= _MAX_PORT:
                        continue
                    candidate = address
                    end = start + len(address)
            try:
                parsed_address = ipaddress.ip_address(candidate)
            except ValueError:
                continue
            if token_end < len(text) and text[token_end] == "/":
                suffix = _CIDR_SUFFIX.match(text[token_end:])
                if suffix is not None and not _is_uri_authority(text, start):
                    trailing_char = text[token_end + suffix.end() : token_end + suffix.end() + 1] or None
                    if token_end != end or not _cidr_suffix_is_valid(
                        suffix.group(1), parsed_address.max_prefixlen, trailing_char
                    ):
                        continue
            results.extend(_whole_candidate_results(super().analyze, candidate, entities, start, end, regex_flags))
        return results


@recognizer_factories.add(  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
    PresidioIpRecognizer
)
def ip_factory(*, supported_language: str = SUPPORTED_LANG, context: list[str] | None = None) -> IpRecognizer:
    return IpRecognizer(supported_language=supported_language, context=context)


@recognizer_factories.add(  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
    UsLicenseRecognizer
)
def us_license_factory(
    *,
    supported_language: str = SUPPORTED_LANG,
    context: list[str] | None = None,
) -> UsLicenseRecognizer:
    return UsLicenseRecognizer(
        patterns=patterns.us_driving_license,
        supported_language=supported_language,
        context=context,
    )


@recognizer_factories.add(  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
    AuTfnRecognizer
)
def au_tfn_factory(
    *,
    supported_language: str = SUPPORTED_LANG,
    context: list[str] | None = None,
) -> AuTfnRecognizer:
    return AuTfnRecognizer(
        patterns=patterns.au_tfn_number,
        supported_language=supported_language,
        context=context,
    )


@recognizer_factories.add(  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
    InAadhaarRecognizer
)
def in_aadhaar_factory(
    *,
    supported_language: str = SUPPORTED_LANG,
    context: list[str] | None = None,
) -> InAadhaarRecognizer:
    return InAadhaarRecognizer(
        patterns=[
            Pattern(
                "AADHAAR",
                r"(?<![0-9])(?<![0-9]{4}[- ])[0-9]{4}(?:[- ]?[0-9]{4}){2}(?![- ]?[0-9])",
                0.01,
            )
        ],
        supported_language=supported_language,
        context=context,
    )


class ContextAwareNhsRecognizer(NhsRecognizer):
    TIMESTAMP_KEYWORDS: ClassVar[set[str]] = {
        "time",
        "timestamp",
        "date",
        "created",
        "updated",
        "modified",
        "deleted",
        "at",
        "on",
        "when",
        "epoch",
        "unix",
        "millis",
        "seconds",
        "utc",
        "gmt",
        "datetime",
        "expired",
        "expires",
        "transaction",
        "logged",
        "recorded",
        "started",
        "ended",
        "finished",
    }

    def enhance_using_context(
        self,
        text: str,
        raw_recognizer_results: list[RecognizerResult],
        other_raw_recognizer_results: list[RecognizerResult],
        nlp_artifacts: NlpArtifacts,
        context: list[str] | None = None,
    ) -> list[RecognizerResult]:
        """Enhance confidence score using context of the entity.

        Filter out NHS number false positives when context suggests
        the column contains timestamp data.

        :param text: The actual text that was analyzed
        :param raw_recognizer_results: This recognizer's results, to be updated
        based on recognizer specific context.
        :param other_raw_recognizer_results: Other recognizer results matched in
        the given text to allow related entity context enhancement
        :param nlp_artifacts: The nlp artifacts contains elements
                              such as lemmatized tokens for better
                              accuracy of the context enhancement process
        :param context: list of context words
        """
        if context is None:
            return raw_recognizer_results

        if self._is_timestamp_context(context):
            return []

        return raw_recognizer_results

    def _is_timestamp_context(self, context: list[str]) -> bool:
        """Check if the context contains timestamp-related keywords."""
        context_lower = {word.lower() for word in context}
        return bool(context_lower & self.TIMESTAMP_KEYWORDS)


@recognizer_factories.add(  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
    NhsRecognizer
)
def nhs_recognizer(
    *,
    supported_language: str = SUPPORTED_LANG,
    context: list[str] | None = None,
) -> NhsRecognizer:
    return ContextAwareNhsRecognizer(
        supported_language=supported_language,
        context=context,
    )


class ValidatedDateRecognizer(DateRecognizer):
    def validate_result(self, pattern_text: str) -> bool | None:
        try:
            _ = parser.parse(pattern_text)
        except Exception as e:
            logger.debug(f"Failed to parse {pattern_text}: {e}")
            # Return None so score isn't modified, relying on Regex score
            return None

        # Return True so score is boosted to 1.0
        return True


@recognizer_factories.add(  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
    DateRecognizer
)
def date_recognizer(
    *,
    supported_language: str = SUPPORTED_LANG,
    context: list[str] | None = None,
) -> ValidatedDateRecognizer:
    return ValidatedDateRecognizer(
        supported_language=supported_language,
        context=context,
    )


class ContextAwareUsBankRecognizer(UsBankRecognizer):
    def enhance_using_context(
        self,
        text: str,
        raw_recognizer_results: list[RecognizerResult],
        other_raw_recognizer_results: list[RecognizerResult],
        nlp_artifacts: NlpArtifacts,
        context: list[str] | None = None,
    ) -> list[RecognizerResult]:
        """Enhance confidence score using context of the entity.

        Boosts the very low scores of the patterns

        :param text: The actual text that was analyzed
        :param raw_recognizer_results: This recognizer's results, to be updated
        based on recognizer specific context.
        :param other_raw_recognizer_results: Other recognizer results matched in
        the given text to allow related entity context enhancement
        :param nlp_artifacts: The nlp artifacts contains elements
                              such as lemmatized tokens for better
                              accuracy of the context enhancement process
        :param context: list of context words
        """
        # The match depends only on the recognizer and the column, not on the individual
        # result, so resolve it once instead of re-tokenizing the context for every result.
        if not context or not self.context or not context_matches(self.context, context):
            return raw_recognizer_results

        for result in raw_recognizer_results:
            # if previously enhanced, then ignore
            if result.recognition_metadata.get(  # pyright: ignore[reportUnknownMemberType]
                RecognizerResult.IS_SCORE_ENHANCED_BY_CONTEXT_KEY
            ):
                continue

            original_score = result.score
            result.score = self.MAX_SCORE

            result.recognition_metadata[  # pyright: ignore[reportUnknownMemberType]
                RecognizerResult.IS_SCORE_ENHANCED_BY_CONTEXT_KEY
            ] = True

            logger.debug(
                f"Enhanced {result.entity_type} score: {original_score:.2f} → {result.score:.2f} (context: {self.context})"
            )

        return raw_recognizer_results


@recognizer_factories.add(  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
    UsBankRecognizer
)
def eager_us_bank_recognizer(
    *,
    supported_language: str = SUPPORTED_LANG,
    context: list[str] | None = None,
) -> ContextAwareUsBankRecognizer:
    return ContextAwareUsBankRecognizer(
        supported_language=supported_language,
        context=context,
    )


def _get_all_pattern_recognizers() -> Iterable[EntityRecognizer]:
    for cls in _get_all_entity_recognizer_classes():
        if issubclass(cls, PatternRecognizer):
            try:
                # Try to instantiate the recognizer
                factory = cast(
                    "Callable[..., PatternRecognizer]",
                    recognizer_factories.get(  # pyright: ignore[reportUnknownMemberType]
                        cls, cls
                    ),
                )
                yield factory(supported_language=SUPPORTED_LANG)
            except Exception as e:
                logger.warning(e)
        elif cls == predefined_recognizers.PhoneRecognizer:
            # Not a pattern recognizer, but pretty much the same
            yield predefined_recognizers.PhoneRecognizer()
        elif issubclass(cls, predefined_recognizers.SpacyRecognizer):
            yield cls(supported_language=SUPPORTED_LANG)


def apply_confidence_threshold(
    threshold: float,
) -> Callable[[EntityRecognizer], EntityRecognizer]:
    def decorate_entity_recognizer(recognizer: EntityRecognizer) -> EntityRecognizer:
        original_analyze = recognizer.analyze

        def analyze(
            instance: EntityRecognizer,  # pyright: ignore[reportUnusedParameter]
            text: str,
            entities: list[str],
            nlp_artifacts: NlpArtifacts,
        ) -> list[RecognizerResult]:
            results = original_analyze(text, entities, nlp_artifacts)
            return [result for result in results if result.score >= threshold]

        recognizer.analyze = analyze.__get__(recognizer, type(recognizer))
        return recognizer

    return decorate_entity_recognizer


def enhance_using_context(recognizer: EntityRecognizer) -> EntityRecognizer:
    old_enhancing_function = recognizer.enhance_using_context

    @wraps(old_enhancing_function)
    def wrapped(
        rec: EntityRecognizer,
        text: str,
        raw_recognizer_results: list[RecognizerResult],
        other_raw_recognizer_results: list[RecognizerResult],
        nlp_artifacts: NlpArtifacts,
        context: list[str] | None = None,
    ) -> list[RecognizerResult]:
        results = old_enhancing_function(
            text,
            raw_recognizer_results,
            other_raw_recognizer_results,
            nlp_artifacts,
            context,
        )

        # The match depends only on the recognizer and the column, not on the individual
        # result, so resolve it once instead of re-tokenizing the context for every result.
        if not rec.context or not context or not context_matches(rec.context, context):
            # If no context is given, the recognizer does not support it, or none of its
            # context words match the column, then ignore this
            return results

        for result in results:
            # if previously enhanced, then ignore
            if result.recognition_metadata.get(  # pyright: ignore[reportUnknownMemberType]
                RecognizerResult.IS_SCORE_ENHANCED_BY_CONTEXT_KEY
            ):
                continue

            # Skip boosting scores that are too low
            if result.score < MIN_SCORE_FOR_ENHANCEMENT:
                continue

            original_score = result.score
            result.score = rec.MAX_SCORE

            result.recognition_metadata[  # pyright: ignore[reportUnknownMemberType]
                RecognizerResult.IS_SCORE_ENHANCED_BY_CONTEXT_KEY
            ] = True

            logger.debug(
                f"Enhanced {result.entity_type} score: {original_score:.2f} → {result.score:.2f} (context: {rec.context})"
            )

        return results

    recognizer.enhance_using_context = types.MethodType(wrapped, recognizer)

    return recognizer


def filter_enhanced_results_below_threshold(
    threshold: float,
) -> Callable[[EntityRecognizer], EntityRecognizer]:
    def decorate_entity_recognizer(recognizer: EntityRecognizer) -> EntityRecognizer:
        old_enhancing_function = recognizer.enhance_using_context

        @wraps(old_enhancing_function)
        def wrapped(
            rec: EntityRecognizer,  # pyright: ignore[reportUnusedParameter]
            text: str,
            raw_recognizer_results: list[RecognizerResult],
            other_raw_recognizer_results: list[RecognizerResult],
            nlp_artifacts: NlpArtifacts,
            context: list[str] | None = None,
        ) -> list[RecognizerResult]:
            results = old_enhancing_function(
                text,
                raw_recognizer_results,
                other_raw_recognizer_results,
                nlp_artifacts,
                context,
            )

            return [result for result in results if result.score >= threshold]

        recognizer.enhance_using_context = types.MethodType(wrapped, recognizer)
        return recognizer

    return decorate_entity_recognizer


def decorate_recognizer(
    *decorators: Callable[[EntityRecognizer], EntityRecognizer],
) -> Callable[[EntityRecognizer], EntityRecognizer]:
    def decorator(recognizer: EntityRecognizer) -> EntityRecognizer:
        decorated = recognizer
        for dec in decorators:
            decorated = dec(decorated)
        return decorated

    return decorator


def explain_recognition_results(results: list[RecognizerResult]) -> str:
    """Builds a verbose explanation of the recognition results taking into account multiple values"""

    def _get_getter(res: RecognizerResult) -> str:
        return cast("dict[str, str]", res.recognition_metadata).get(
            presidio_constants.RECOGNIZER_METADATA_IDENTIFIER,
            presidio_constants.DEFAULT_RECOGNIZER_IDENTIFIER,
        )

    grouped_results: groupby[str, RecognizerResult] = groupby(
        sorted(results, key=_get_getter),
        key=_get_getter,
    )

    textual_explanation = ""
    for recognizer_identifier, group in grouped_results:
        group_list = list(group)

        recognizer_name: str = cast("dict[str, str]", group_list[0].recognition_metadata).get(
            presidio_constants.RECOGNIZER_METADATA_NAME, recognizer_identifier
        )
        results_count = len(group_list)
        results_score = sum(r.score for r in group_list) / results_count
        maybe_plural_time = "time" if results_count == 1 else "times"

        textual_explanation += (
            presidio_constants.TEXTUAL_EXPLANATION_TEMPLATE.format(
                recognizer_name=recognizer_name,
                results_count=results_count,
                maybe_plural_time=maybe_plural_time,
                results_score=results_score,
            )
            + "\n"
        )

        patterns_matched: set[tuple[str, float]] = set()
        for result in group_list:
            if (
                result.analysis_explanation is None  # pyright: ignore[reportUnnecessaryComparison]
                or result.analysis_explanation.pattern is None  # pyright: ignore[reportUnnecessaryComparison]
            ):
                continue

            patterns_matched.add((result.analysis_explanation.pattern, result.analysis_explanation.score))

        if patterns_matched:
            textual_explanation += presidio_constants.TEXTUAL_EXPLANATION_PATTERN_HEADER_TEMPLATE + "\n"
            for pattern, score in sorted(patterns_matched, key=lambda o: o[1], reverse=True):
                textual_explanation += (
                    presidio_constants.TEXTUAL_EXPLANATION_PATTERN_ITEM_TEMPLATE.format(pattern=pattern, score=score)
                    + "\n"
                )

        textual_explanation += "\n"

    return textual_explanation
