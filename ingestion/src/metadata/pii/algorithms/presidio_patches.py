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
Patch the Presidio recognizer results to make adapt them to specific use cases.
"""

from datetime import datetime
from typing import List, Protocol, Sequence  # noqa: UP035

from dateutil.parser import parse
from presidio_analyzer import RecognizerResult

from metadata.utils.logger import pii_logger

logger = pii_logger()

# Two probe defaults that differ in every component. `parse` fills whatever the text does not
# spell out from its default, so a component that changes between the two parses was never in
# the text to begin with.
_DATE_PROBE_DEFAULTS = (datetime(1900, 1, 1), datetime(2222, 7, 23))

# The spaCy-backed entities that name a person, a place or a nationality.
_NAMED_ENTITIES = frozenset({"PERSON", "LOCATION", "NRP"})


class PresidioRecognizerResultPatcher(Protocol):
    """
    A protocol for a function that takes a recognizer result and returns a modified result.
    Sometimes we need to patch the recognizer result to make it compatible with our use case.
    For instance, Presidio yields URL false positive with email address.
    """

    def __call__(self, recognizer_results: Sequence[RecognizerResult], text: str) -> Sequence[RecognizerResult]: ...


def combine_patchers(
    *patchers: PresidioRecognizerResultPatcher,
) -> PresidioRecognizerResultPatcher:
    """
    Combine multiple patchers into one.
    This allows us to apply multiple patches in sequence.
    """

    def combined_patcher(recognizer_results: Sequence[RecognizerResult], text: str) -> Sequence[RecognizerResult]:
        for patcher in patchers:
            recognizer_results = patcher(recognizer_results, text)
        return recognizer_results

    return combined_patcher


def url_patcher(recognizer_results: Sequence[RecognizerResult], text: str) -> Sequence[RecognizerResult]:
    """
    Patch the recognizer result to remove URL false positive with email address.
    """
    patched_result: List[RecognizerResult] = []  # noqa: UP006
    for result in recognizer_results:
        if result.entity_type == "URL":  # noqa: SIM102
            if text[: result.start].endswith("@"):
                # probably an email address, skip the URL
                continue
        patched_result.append(result)
    return patched_result


def named_entity_patcher(recognizer_results: Sequence[RecognizerResult], text: str) -> Sequence[RecognizerResult]:
    """
    Patch the recognizer result to remove name false positives with opaque identifiers.

    spaCy reads fragments of identifiers as names: a chunk of the UUID
    `b1e3a1c2-1111-4222-8333-444455556666` comes back as a PERSON. People, places and
    nationalities are not spelled with digits, so a span holding one is none of them.
    """
    return [
        result
        for result in recognizer_results
        if result.entity_type not in _NAMED_ENTITIES
        or not any(char.isdigit() for char in text[result.start : result.end])
    ]


def spells_out_a_date(text: str) -> bool:
    """
    Whether the text names a year, a month and a day rather than merely being parseable.

    spaCy labels bare numbers as DATE -- an order id `1001`, a year code `1999`, a price
    `29.99` -- and `parse` accepts every one of them by silently taking the missing
    components from its default. Parsing twice with different defaults exposes that: only a
    text that actually spells out the whole date lands on the same day both times.
    """
    default_a, default_b = _DATE_PROBE_DEFAULTS
    try:
        return parse(text, default=default_a).date() == parse(text, default=default_b).date()
    except (ValueError, OverflowError):
        return False
    except Exception as e:
        logger.info("Unexpected error while parsing date time: %s", e)
        return False


def date_time_patcher(recognizer_results: Sequence[RecognizerResult], text: str) -> Sequence[RecognizerResult]:
    """
    Patch the recognizer result to remove date time false positive with date.
    """
    patched_result: List[RecognizerResult] = []  # noqa: UP006
    for result in recognizer_results:
        if result.entity_type == "DATE_TIME" and not spells_out_a_date(text[result.start : result.end]):
            continue
        patched_result.append(result)
    return patched_result


class ResultCapturingPatcher:
    recognizer_results: List[RecognizerResult]  # noqa: UP006

    def __init__(self) -> None:
        self.recognizer_results = []

    def __call__(self, recognizer_results: Sequence[RecognizerResult], text: str) -> Sequence[RecognizerResult]:
        self.recognizer_results.extend(recognizer_results)
        return recognizer_results
