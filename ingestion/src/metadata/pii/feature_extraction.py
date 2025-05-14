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
import logging
import re
from collections import defaultdict
from typing import List, Mapping, Optional, Sequence, Set

from presidio_analyzer import AnalyzerEngine

from metadata.pii.scanners.ner_scanner import SUPPORTED_LANG
from metadata.pii.tags import PIITag
from metadata.utils.logger import pii_logger

logger = pii_logger()


def extract_pii_tags(
    analyzer: AnalyzerEngine,
    texts: Sequence[str],
    context: Optional[List[str]] = None,
) -> Mapping[PIITag, float]:
    """
    Extract PII entities from a batch of texts.

    The results are averaged over the batch. In general, the larger the batch,
    the better the results as some single texts might be noisy or detected by
    different recognizers.
    """
    entity_scores = defaultdict(float)

    if SUPPORTED_LANG not in analyzer.supported_languages:
        raise ValueError(
            f"The analyzer does not support {SUPPORTED_LANG}, which is required for this function."
        )

    for text in texts:
        results = analyzer.analyze(
            text, language=SUPPORTED_LANG, context=context, entities=PIITag.values()
        )
        for result in results:
            try:
                # This is a priori safe because the analyzer only considers the entities that we passed
                pii_entity = PIITag[result.entity_type]
                entity_scores[pii_entity] += result.score
            except KeyError:
                logging.error(f"Unrecognized PII entity type: {result.entity_type}.")

    # normalize the scores if the batch is not empty
    if len(texts):
        for entity in entity_scores:
            entity_scores[entity] /= len(texts)

    return entity_scores


def extract_pii_from_column_names(
    patterns: Mapping[PIITag, Set[re.Pattern]], text: str
) -> Set[PIITag]:
    """
    Extract PII entities from a text using regex patterns.
    This is similar to Presidio `PatternRecognizer`, but without
    assigning scores. This is intended to be used for column names
    as a hint that the column might contain PII.
    """
    results = set()
    for pii_type, patterns in patterns.items():
        for pattern in patterns:
            if pattern.match(text) is not None:
                results.add(pii_type)
    return results


def pii_column_name_patterns() -> Mapping[PIITag, Set[re.Pattern]]:
    """
    Analyzes column names for PII patterns.
    A match is considered as a potential PII, but not a guarantee.
    Think of it as a hint that the column might contain PII.
    """
    raw_patterns = [
        (PIITag.US_SSN, "^.*(ssn|social).*$"),
        (PIITag.CREDIT_CARD, "^.*(credit).*(card).*$"),
        (
            PIITag.US_BANK_NUMBER,
            [
                r"\b(account|acct|acc)[_-]?(number|num|no)\b",  # account_number, account_num
                r"\bbank[_-]?(account|number|num|no)?\b",  # bank_account, bank_number
            ],
        ),
        (
            PIITag.IBAN_CODE,
            [
                r"\b(account|acct|acc)[_-]?(number|num|no)\b",  # account_number, account_num
                r"\bbank[_-]?(account|number|num|no)?\b",  # bank_account, bank_number
                r"\biban(?:[_]?(number|code))?\b",  # iban, iban_number, iban_code
                r"\bbank[_]?iban\b",  # bank_iban
                r"\binternational[_]?(account|bank[_]?number)\b",  # international_account, international_bank_number
            ],
        ),
        (PIITag.EMAIL_ADDRESS, "^(email|e-mail|mail)(.*address)?$"),
        (PIITag.PERSON, "^.*(user|client|person|first|last|maiden|nick).*(name).*$"),
        (PIITag.DATE_TIME, "^.*(date|time|dob|birthday|dod).*$"),
        (PIITag.NRP, "^.*(gender|nationality).*$"),
        (
            PIITag.LOCATION,
            "^.*(address|city|state|county|country|zipcode|zip|postal|zone|borough).*$",
        ),
        (PIITag.PHONE_NUMBER, "^.*(phone).*$"),
    ]

    compiled_patterns = defaultdict(set)

    for pii_type, patterns in raw_patterns:
        if isinstance(patterns, str):
            patterns = [patterns]
        for pattern in patterns:
            compiled_patterns[pii_type].add(re.compile(pattern, re.IGNORECASE))

    return compiled_patterns
