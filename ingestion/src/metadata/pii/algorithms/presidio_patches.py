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
from typing import List, Protocol, Sequence

from dateutil.parser import parse
from presidio_analyzer import RecognizerResult

from metadata.utils.logger import pii_logger

logger = pii_logger()


class PresidioRecognizerResultPatcher(Protocol):
    """
    A protocol for a function that takes a recognizer result and returns a modified result.
    Sometimes we need to patch the recognizer result to make it compatible with our use case.
    For instance, Presidio yields URL false positive with email address.
    """

    def __call__(
        self, recognizer_results: Sequence[RecognizerResult], text: str
    ) -> Sequence[RecognizerResult]:
        ...


def combine_patchers(
    *patchers: PresidioRecognizerResultPatcher,
) -> PresidioRecognizerResultPatcher:
    """
    Combine multiple patchers into one.
    This allows us to apply multiple patches in sequence.
    """

    def combined_patcher(
        recognizer_results: Sequence[RecognizerResult], text: str
    ) -> Sequence[RecognizerResult]:
        for patcher in patchers:
            recognizer_results = patcher(recognizer_results, text)
        return recognizer_results

    return combined_patcher


def url_patcher(
    recognizer_results: Sequence[RecognizerResult], text: str
) -> Sequence[RecognizerResult]:
    """
    Patch the recognizer result to remove URL false positive with email address.
    """
    patched_result: List[RecognizerResult] = []
    for result in recognizer_results:
        if result.entity_type == "URL":
            if text[: result.start].endswith("@"):
                # probably an email address, skip the URL
                continue
        patched_result.append(result)
    return patched_result


def date_time_patcher(
    recognizer_results: Sequence[RecognizerResult], text: str
) -> Sequence[RecognizerResult]:
    """
    Patch the recognizer result to remove date time false positive with date.
    """
    patched_result: List[RecognizerResult] = []
    for result in recognizer_results:
        if result.entity_type == "DATE_TIME":
            # try to parse using dateutils, if it fails, skip the result
            try:
                _ = parse(text[result.start : result.end])
            except (ValueError, OverflowError):
                # if parsing fails, skip the result
                continue
            except Exception as e:
                logger.info("Unexpected error while parsing date time: %s", e)
                continue
        patched_result.append(result)
    return patched_result
