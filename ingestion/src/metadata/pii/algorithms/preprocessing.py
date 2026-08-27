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
Preprocessing functions for the classification tasks.
"""

import datetime
from typing import Any, List, Mapping, Optional, Sequence, Union, cast  # noqa: UP035

from metadata.utils.logger import pii_logger

logger = pii_logger()

MAX_NLP_TEXT_LENGTH = 5_000


# pylint: disable=too-many-return-statements
def convert_to_str(value: Any) -> Optional[Union[List[str], str]]:  # noqa: UP006, UP007, UP045
    """
    Convert the given value to a string. This is a conversion
    tailored to our use case, not a generic one.
    """
    if isinstance(value, str):
        if len(value) > MAX_NLP_TEXT_LENGTH:
            logger.warning(
                "Truncating text field of length %d to %d characters for NLP processing",
                len(value),
                MAX_NLP_TEXT_LENGTH,
            )
            return value[:MAX_NLP_TEXT_LENGTH]
        return value
    if isinstance(value, (int, float, datetime.datetime, datetime.date)):
        # Values we want to convert to string out of the box
        return str(value)
    if isinstance(value, bytes):
        # Don't classify binary columns, which might contain misleading or outright invalid strings
        return None
    if isinstance(value, (Sequence, Mapping)):
        if isinstance(value, Mapping):
            value = list(value.values())
        converted = [convert_to_str(el) for el in cast(List[Any], value)]  # noqa: TC006, UP006
        return [
            item
            for sublist in converted
            for item in (sublist if isinstance(sublist, list) else [sublist])
            if item is not None
        ]
    if value is None:
        # We want to skip None values, not convert them to "None"
        return None
    return None


def _is_allcaps_alpha(s: str) -> bool:
    """Return True for ALL-CAPS strings that contain no digit characters.

    Digits disqualify structured identifiers such as IBANs
    ("GB82WEST12345698765432") or RAMQ codes ("ABCD12345678") that happen to
    satisfy str.isupper() but whose uppercase pattern matters for regex
    recognisers and must not be title-cased.
    """
    return bool(s) and s.isupper() and not any(c.isdigit() for c in s)


def preprocess_values(values: Sequence[Any]) -> List[str]:  # noqa: UP006
    """Convert sample column values to a flat list of strings for PII analysis.

    No case normalisation is applied here so that pattern-based recognisers
    (IBAN, CRYPTO, etc.) always receive the original casing.  Call
    :func:`ner_normalize_values` on the result when a second NER-friendly pass
    is needed.
    """
    result: List[str] = []  # noqa: UP006
    for value in values:
        converted_value = convert_to_str(value)
        if converted_value is None:
            # Skip None values
            continue

        if not isinstance(converted_value, list):
            converted_value = [converted_value]

        # skip empty strings
        converted_value = [el.strip() for el in converted_value if el.strip()]
        result.extend(converted_value)

    return result


def ner_normalize_values(values: List[str]) -> List[str]:  # noqa: UP006
    """Return a copy of *values* with purely alphabetic ALL-CAPS tokens title-cased.

    spaCy NER models are trained on mixed-case text and miss names like "SERGE"
    or "THÉODORE".  Tokens that contain digits are left untouched because they
    may be structured identifiers (IBANs, health card numbers, etc.) whose
    uppercase pattern is load-bearing for regex recognisers.

    Returns the input list unchanged when no ALL-CAPS alpha tokens are present,
    so callers can cheaply detect whether a second NER pass is worthwhile by
    comparing identity (``ner_values is values`` is never True, but
    ``ner_values == values`` is True when there is nothing to normalise).
    """
    return [el.title() if _is_allcaps_alpha(el) else el for el in values]
