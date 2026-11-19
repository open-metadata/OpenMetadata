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
Definition of custom patterns for the PII detection.
Only patterns for column names are implemented here; for content,
we rely on the Presidio library.
"""

import re
from collections import defaultdict
from collections.abc import Mapping
from functools import lru_cache

from metadata.pii.algorithms.tags import PIITag


def _whole_tokens(fragment: str) -> str:
    """Match `fragment` as whole "_"-separated tokens anywhere in a normalized name."""
    return rf"^(?:.*_)?(?:{fragment})(?:_.*)?$"


def normalize_name(text: str) -> str:
    """Lower-case `text` and join its alphanumeric tokens with "_", splitting camelCase.

    "Birth.Date" -> "birth_date", "dateOfBirth" -> "date_of_birth",
    "date of birth: 1990-04-12" -> "date_of_birth_1990_04_12".
    """
    text = re.sub(r"([a-z])([A-Z])", r"\1_\2", text)
    return "_".join(re.findall(r"[^\W_]+", text.lower()))


# Regex patterns for PII detection in column names, not for content
_pii_column_name_regexes: Mapping[PIITag, str | list[str]] = {
    PIITag.US_SSN: "^.*(ssn|social).*$",
    PIITag.CREDIT_CARD: "^.*(credit).*(card).*$",
    PIITag.US_BANK_NUMBER: [
        r"\b(account|acct|acc)[_-]?(number|num|no)\b",  # account_number, account_num
        r"\bbank[_-]?(account|number|num|no)?\b",  # bank_account, bank_number
    ],
    PIITag.IBAN_CODE: [
        r"\b(account|acct|acc)[_-]?(number|num|no)\b",  # account_number, account_num
        r"\bbank[_-]?(account|number|num|no)?\b",  # bank_account, bank_number
        r"\biban(?:[_]?(number|code))?\b",  # iban, iban_number, iban_code
        r"\bbank[_]?iban\b",  # bank_iban
        r"\binternational[_]?(account|bank[_]?number)\b",  # international_account, international_bank_number
    ],
    PIITag.EMAIL_ADDRESS: "^(email|e-mail|mail)(.*address)?$",
    PIITag.PERSON: "^.*(user|client|person|first|last|maiden|nick).*(name).*$",
    # DATE_TIME content hits are only kept when there is personal-date evidence (see
    # classifiers.py and tag_analyzer.py).  Use an allowlist of personal-date names
    # rather than a broad "anything with 'date'" match, so operational timestamps
    # (event_timestamp, created_at, job_start_date) are never tagged as PII.
    # These patterns run against the normalized name (see `normalize_name`): lower-case
    # tokens joined by "_", so "Birth.Date", "date of birth" and "dateOfBirth" all match.
    # Each fragment must cover whole tokens, so "dob" does not match "adobe_timestamp".
    PIITag.DATE_TIME: [
        # Date of birth / death
        _whole_tokens(
            r"(?:date|day)_?of_?(?:birth|death)"
            r"|(?:birth|death)_?(?:date|day|dt|ts|time|timestamp|datetime)"
            r"|dob|dod"
        ),
        # Employment lifecycle dates; a bare "start_date" is too generic (job_start_date)
        _whole_tokens(
            r"hire_?(?:date|dt)|employment_?(?:start_?|end_?)?date|employee_?(?:start|end)_?date"
            r"|(?:termination|retirement|resignation)_?date"
        ),
        # Medical / patient dates
        _whole_tokens(r"(?:admission|discharge|appointment|diagnosis|treatment|medical_?test)_?date"),
        # User / account lifecycle dates (registration, onboarding, deletion)
        _whole_tokens(r"(?:registration|sign_?up|account|onboarding|deletion|deactivation)_?date"),
    ],
    PIITag.NRP: "^.*(gender|nationality).*$",
    PIITag.LOCATION: "^.*(address|city|state|county|country|zipcode|zip|postal|zone|borough).*$",
    PIITag.PHONE_NUMBER: "^.*(phone).*$",
}


@lru_cache
def get_pii_column_name_patterns() -> Mapping[PIITag, list[re.Pattern[str]]]:
    """
    Returns the regex patterns for PII detection in column names.
    The patterns are cached for performance.
    """
    patterns: defaultdict[PIITag, list[re.Pattern[str]]] = defaultdict(list)

    for pii_type, regexes in _pii_column_name_regexes.items():
        if isinstance(regexes, str):
            regexes = [regexes]  # noqa: PLW2901
        for regex in regexes:
            patterns[pii_type].append(re.compile(regex, re.IGNORECASE))

    return patterns


def is_personal_date_text(text: str) -> bool:
    """Whether a column name or sampled value names a personal date (birth, hire, ...)."""
    normalized = normalize_name(text)
    return any(p.match(normalized) for p in get_pii_column_name_patterns().get(PIITag.DATE_TIME, []))
