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
"""Bounded candidate patterns with family-specific checksum normalization."""

import re
from typing import ClassVar

from presidio_analyzer import Pattern, PatternRecognizer, RecognizerResult
from presidio_analyzer.nlp_engine import NlpArtifacts
from presidio_analyzer.predefined_recognizers import (
    AuAbnRecognizer,
    AuAcnRecognizer,
    EsNieRecognizer,
    EsNifRecognizer,
    IbanRecognizer,
    ItVatCodeRecognizer,
    SgFinRecognizer,
    SgUenRecognizer,
)
from presidio_analyzer.predefined_recognizers.iban_patterns import regex_per_country

# Foreign markers stay uppercase so prose such as "de 12345678903" remains a bare VAT candidate.
_VAT_COUNTRY_PREFIX = re.compile(
    r"\b(?:(?i:IT)|(?:AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|GB|GR|HR|HU|IE|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK|XI))[ _-]+$"
)


class _IdentifierRecognizer:
    _predefined_name: str

    def __init__(
        self,
        *,
        supported_language: str | None = None,
        context: list[str] | None = None,
        supported_entities: list[str] | None = None,
    ) -> None:
        if supported_language is None:
            super().__init__(context=context)  # type: ignore[call-arg]
        else:
            super().__init__(supported_language=supported_language, context=context)  # type: ignore[call-arg]
        self.global_regex_flags = re.MULTILINE | re.DOTALL  # type: ignore[attr-defined]
        self.name = self._predefined_name  # type: ignore[attr-defined]
        if supported_entities:
            self.supported_entities = supported_entities  # type: ignore[attr-defined]


class _GroupedNumberRecognizer(_IdentifierRecognizer):
    def analyze(
        self,
        text: str,
        entities: list[str],
        nlp_artifacts: NlpArtifacts | None = None,
        regex_flags: int | None = None,
    ) -> list[RecognizerResult]:
        results = PatternRecognizer.analyze(
            self,  # pyright: ignore[reportArgumentType]
            text,
            entities,
            nlp_artifacts,
            regex_flags,
        )
        return [
            result
            for result in results
            if not re.search(r"[0-9][ -]+$", text[: result.start])
            and not re.match(r"[ -]+[0-9]| +-", text[result.end :])
        ]


class BoundedIbanRecognizer(_IdentifierRecognizer, IbanRecognizer):
    _predefined_name = "IbanRecognizer"
    PATTERNS: ClassVar[list[Pattern]] = [
        Pattern(
            "IBAN",
            r"(?<![\w-])[A-Za-z]{2}[ -]?[0-9]{2}(?:[ -]?[A-Za-z0-9]){11,30}",
            0.5,
        )
    ]

    def analyze(
        self,
        text: str,
        entities: list[str],
        nlp_artifacts: NlpArtifacts | None = None,
        regex_flags: int | None = None,
    ) -> list[RecognizerResult]:
        results: list[RecognizerResult] = []
        candidate_pattern = re.compile(self.patterns[0].regex, regex_flags or self.global_regex_flags)
        position = 0
        while candidate := candidate_pattern.search(text, position):
            start = candidate.start()
            for end in range(start + 15, candidate.end() + 1):
                if end < len(text) and (text[end].isalnum() or text[end] in "_-"):
                    continue
                if re.match(r" *[0-9_-]", text[end:]):
                    continue
                value = text[start:end]
                if not value.isascii():
                    continue
                normalized = value.replace(" ", "").replace("-", "").upper()
                country_pattern = regex_per_country.get(normalized[:2])
                if (
                    country_pattern
                    and re.fullmatch(country_pattern, normalized, re.IGNORECASE)
                    and self.validate_result(value)
                ):
                    found = PatternRecognizer.analyze(self, value, entities, nlp_artifacts, regex_flags)
                    for result in found:
                        result.start += start
                        result.end += start
                    results.extend(found)
                    position = end
                    break
            else:
                position = start + 1
        return results

    def validate_result(self, pattern_text: str) -> bool:
        return super().validate_result(pattern_text.upper()) is True


class BoundedEsNifRecognizer(_IdentifierRecognizer, EsNifRecognizer):
    _predefined_name = "EsNifRecognizer"
    PATTERNS: ClassVar[list[Pattern]] = [Pattern("NIF", r"(?<![\w-])[0-9]{7,8}-?[A-Za-z](?![\w-])", 0.5)]

    def validate_result(self, pattern_text: str) -> bool:
        return super().validate_result(pattern_text.upper())


class BoundedEsNieRecognizer(_IdentifierRecognizer, EsNieRecognizer):
    _predefined_name = "EsNieRecognizer"
    PATTERNS: ClassVar[list[Pattern]] = [Pattern("NIE", r"(?<![\w-])[XxYyZz][0-9]{7}-?[A-Za-z](?![\w-])", 0.5)]

    def validate_result(self, pattern_text: str) -> bool:
        return super().validate_result(pattern_text.upper())


class BoundedSgUenRecognizer(_IdentifierRecognizer, SgUenRecognizer):
    _predefined_name = "SgUenRecognizer"
    PATTERNS: ClassVar[list[Pattern]] = [
        Pattern(
            "UEN",
            r"(?<![\w-])(?:[0-9]{8,9}[A-Za-z]|[TtSs][0-9]{2}[A-Za-z]{2}[0-9]{4}[A-Za-z])(?![\w-])",
            0.3,
        )
    ]

    def validate_result(self, pattern_text: str) -> bool:
        return super().validate_result(pattern_text.upper()) is True


class BoundedAuAbnRecognizer(_GroupedNumberRecognizer, AuAbnRecognizer):
    _predefined_name = "AuAbnRecognizer"
    PATTERNS: ClassVar[list[Pattern]] = [Pattern("ABN", r"(?<![\w-])[0-9]{2}(?:[- ]?[0-9]{3}){3}(?![\w-])", 0.1)]


class BoundedAuAcnRecognizer(_GroupedNumberRecognizer, AuAcnRecognizer):
    _predefined_name = "AuAcnRecognizer"
    PATTERNS: ClassVar[list[Pattern]] = [Pattern("ACN", r"(?<![\w-])[0-9]{3}(?:[- ]?[0-9]{3}){2}(?![\w-])", 0.1)]


class BoundedItVatRecognizer(_GroupedNumberRecognizer, ItVatCodeRecognizer):
    _predefined_name = "ItVatCodeRecognizer"
    PATTERNS: ClassVar[list[Pattern]] = [
        Pattern("IT VAT", r"(?<![\w-])(?:[Ii][Tt] ?)?(?:[0-9][ _]?){10}[0-9](?![\w-])", 0.1)
    ]

    def analyze(
        self,
        text: str,
        entities: list[str],
        nlp_artifacts: NlpArtifacts | None = None,
        regex_flags: int | None = None,
    ) -> list[RecognizerResult]:
        results = super().analyze(text, entities, nlp_artifacts, regex_flags)
        return [
            result
            for result in results
            if text[result.start : result.end].upper().startswith("IT")
            or not _VAT_COUNTRY_PREFIX.search(text[: result.start])
        ]

    def validate_result(self, pattern_text: str) -> bool:
        digits = re.sub(r"[ _]", "", pattern_text.upper().removeprefix("IT"))
        return super().validate_result(digits)


class ValidatedSgFinRecognizer(_IdentifierRecognizer, SgFinRecognizer):
    _predefined_name = "SgFinRecognizer"
    PATTERNS: ClassVar[list[Pattern]] = [Pattern("NRIC/FIN", r"(?<![\w-])[SsTtFfGgMm][0-9]{7}[A-Za-z](?![\w-])", 0.5)]

    def validate_result(self, pattern_text: str) -> bool:
        value = pattern_text.upper()
        if not re.fullmatch(r"[STFGM][0-9]{7}[A-Z]", value):
            return False

        weighted_sum = sum(int(digit) * weight for digit, weight in zip(value[1:8], (2, 7, 6, 5, 4, 3, 2), strict=True))
        offset = {"S": 0, "T": 4, "F": 0, "G": 4, "M": 3}[value[0]]
        table = {
            "S": "JZIHGFEDCBA",
            "T": "JZIHGFEDCBA",
            "F": "XWUTRQPNMLK",
            "G": "XWUTRQPNMLK",
            "M": "XWUTRQPNJLK",
        }[value[0]]
        return value[-1] == table[(weighted_sum + offset) % 11]
