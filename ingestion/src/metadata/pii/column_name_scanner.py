#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Regex scanner for column names
"""
import re
from enum import Enum, auto
from typing import Optional

from metadata.pii.models import TagAndConfidence, TagType


class PiiTypes(Enum):
    """
    PiiTypes enumerates the different types of PII data
    """

    NONE = auto()
    UNSUPPORTED = auto()
    PHONE = auto()
    EMAIL = auto()
    CREDIT_CARD = auto()
    ADDRESS = auto()
    ADDRESS_LOCATION = auto()
    PERSON = auto()
    LOCATION = auto()
    BIRTH_DATE = auto()
    GENDER = auto()
    NATIONALITY = auto()
    IP_ADDRESS = auto()
    SSN = auto()
    USER_NAME = auto()
    PASSWORD = auto()
    ETHNICITY = auto()
    TAX_ID = auto()
    KEY = auto()
    BANKACC = auto()


class ColumnNameScanner:
    """
    Column Name Scanner to scan column name
    """

    sensitive_regex = {
        PiiTypes.PASSWORD: re.compile("^.*password.*$", re.IGNORECASE),
        PiiTypes.SSN: re.compile("^.*(ssn|social).*$", re.IGNORECASE),
        PiiTypes.CREDIT_CARD: re.compile("^.*(credit).*(card).*$", re.IGNORECASE),
        PiiTypes.BANKACC: re.compile("^.*bank.*(acc|num).*$", re.IGNORECASE),
        PiiTypes.EMAIL: re.compile("^.*(email|e-mail|mail).*$", re.IGNORECASE),
        PiiTypes.USER_NAME: re.compile(
            "^.*(user|client|person).*(name).*$", re.IGNORECASE
        ),
        PiiTypes.PERSON: re.compile(
            "^.*(firstname|lastname|fullname|maidenname|nickname|name_suffix).*$",
            re.IGNORECASE,
        ),
    }
    non_sensitive_regex = {
        PiiTypes.BIRTH_DATE: re.compile(
            "^.*(date_of_birth|dateofbirth|dob|"
            "birthday|date_of_death|dateofdeath).*$",
            re.IGNORECASE,
        ),
        PiiTypes.GENDER: re.compile("^.*(gender).*$", re.IGNORECASE),
        PiiTypes.NATIONALITY: re.compile("^.*(nationality).*$", re.IGNORECASE),
        PiiTypes.ADDRESS: re.compile(
            "^.*(address|city|state|county|country|"
            "zipcode|zip|postal|zone|borough).*$",
            re.IGNORECASE,
        ),
        PiiTypes.PHONE: re.compile("^.*(phone).*$", re.IGNORECASE),
    }

    @classmethod
    def scan(cls, column_name: str) -> Optional[TagAndConfidence]:
        for pii_type_pattern in cls.sensitive_regex.values():
            if pii_type_pattern.match(column_name) is not None:
                return TagAndConfidence(
                    tag=TagType.SENSITIVE,
                    confidence=1,
                )

        for pii_type_pattern in cls.non_sensitive_regex.values():
            if pii_type_pattern.match(column_name) is not None:
                return TagAndConfidence(
                    tag=TagType.NONSENSITIVE,
                    confidence=1,
                )

        return None
