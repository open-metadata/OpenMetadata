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
    # DATE_TIME content hits are suppressed entirely (see classifiers.py).  The only
    # way a column gets a DATE_TIME PII tag is when its name explicitly signals a
    # personal date.  Use an allowlist of known personal-date name fragments rather
    # than a broad "anything with 'date'" match, so operational timestamps
    # (event_timestamp, created_at, updated_at) are never tagged as PII.
    PIITag.DATE_TIME: [
        # Date of birth / age / death
        r"^.*(date[_-]?of[_-]?birth|birth[_-]?date|dob|birthday|date[_-]?of[_-]?death|dod).*$",
        # Employment lifecycle dates
        r"^.*(hire[_-]?date|employment[_-]?date|start[_-]?date|termination[_-]?date|retirement[_-]?date|resignation[_-]?date).*$",
        # Medical / patient dates
        r"^.*(admission[_-]?date|discharge[_-]?date|appointment[_-]?date|diagnosis[_-]?date|treatment[_-]?date|medical[_-]?test[_-]?date).*$",
        # User / account lifecycle dates (registration, onboarding, deletion)
        r"^.*(registration[_-]?date|signup[_-]?date|sign[_-]?up[_-]?date|account[_-]?date|onboarding[_-]?date|deletion[_-]?date|deactivation[_-]?date).*$",
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
