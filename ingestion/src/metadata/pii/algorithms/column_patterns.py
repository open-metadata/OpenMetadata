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
from functools import lru_cache
from typing import DefaultDict, List, Mapping, Union

from metadata.pii.algorithms.tags import PIITag

# Regex patterns for PII detection in column names, not for content
_pii_column_name_regexes: Mapping[PIITag, Union[str, List[str]]] = {
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
    PIITag.DATE_TIME: "^.*(date|time|dob|birthday|dod).*$",
    PIITag.NRP: "^.*(gender|nationality).*$",
    PIITag.LOCATION: "^.*(address|city|state|county|country|zipcode|zip|postal|zone|borough).*$",
    PIITag.PHONE_NUMBER: "^.*(phone).*$",
}


@lru_cache
def get_pii_column_name_patterns() -> Mapping[PIITag, List[re.Pattern[str]]]:
    """
    Returns the regex patterns for PII detection in column names.
    The patterns are cached for performance.
    """
    patterns: DefaultDict[PIITag, List[re.Pattern[str]]] = defaultdict(list)

    for pii_type, regexes in _pii_column_name_regexes.items():
        if isinstance(regexes, str):
            regexes = [regexes]
        for regex in regexes:
            patterns[pii_type].append(re.compile(regex, re.IGNORECASE))

    return patterns
