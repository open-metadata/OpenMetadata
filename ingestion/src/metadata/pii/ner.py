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
NER Scanner based on Presidio.

Supported Entities https://microsoft.github.io/presidio/supported_entities/
"""

from enum import Enum

from metadata.pii.models import TagType
from metadata.utils.logger import pii_logger

logger = pii_logger()


class NEREntity(Enum):
    """
    PII Entities supported by Presidio https://microsoft.github.io/presidio/supported_entities/
    """

    # Global
    CREDIT_CARD = TagType.SENSITIVE.value
    CRYPTO = TagType.SENSITIVE.value  # noqa: PIE796
    DATE_TIME = TagType.NONSENSITIVE.value
    EMAIL_ADDRESS = TagType.SENSITIVE.value  # noqa: PIE796
    IBAN_CODE = TagType.SENSITIVE.value  # noqa: PIE796
    IP_ADDRESS = TagType.SENSITIVE.value  # noqa: PIE796
    NRP = TagType.NONSENSITIVE.value  # noqa: PIE796
    LOCATION = TagType.NONSENSITIVE.value  # noqa: PIE796
    PERSON = TagType.SENSITIVE.value  # noqa: PIE796
    PHONE_NUMBER = TagType.NONSENSITIVE.value  # noqa: PIE796
    MEDICAL_LICENSE = TagType.SENSITIVE.value  # noqa: PIE796
    URL = TagType.NONSENSITIVE.value  # noqa: PIE796

    # USA
    US_BANK_NUMBER = TagType.SENSITIVE.value  # noqa: PIE796
    US_DRIVER_LICENSE = TagType.SENSITIVE.value  # noqa: PIE796
    US_ITIN = TagType.SENSITIVE.value  # noqa: PIE796
    US_PASSPORT = TagType.SENSITIVE.value  # noqa: PIE796
    US_SSN = TagType.SENSITIVE.value  # noqa: PIE796

    # UK
    UK_NHS = TagType.SENSITIVE.value  # noqa: PIE796

    # Spain
    ES_NIF = TagType.SENSITIVE.value  # noqa: PIE796
    ES_NIE = TagType.SENSITIVE.value  # noqa: PIE796

    # Italy
    IT_FISCAL_CODE = TagType.SENSITIVE.value  # noqa: PIE796
    IT_DRIVER_LICENSE = TagType.SENSITIVE.value  # noqa: PIE796
    IT_VAT_CODE = TagType.SENSITIVE.value  # noqa: PIE796
    IT_PASSPORT = TagType.SENSITIVE.value  # noqa: PIE796
    IT_IDENTITY_CARD = TagType.SENSITIVE.value  # noqa: PIE796

    # Poland
    PL_PESEL = TagType.SENSITIVE.value  # noqa: PIE796

    # Singapore
    SG_NRIC_FIN = TagType.SENSITIVE.value  # noqa: PIE796
    SG_UEN = TagType.SENSITIVE.value  # noqa: PIE796

    # Australia
    AU_ABN = TagType.SENSITIVE.value  # noqa: PIE796
    AU_ACN = TagType.SENSITIVE.value  # noqa: PIE796
    AU_TFN = TagType.SENSITIVE.value  # noqa: PIE796
    AU_MEDICARE = TagType.SENSITIVE.value  # noqa: PIE796

    # India
    IN_PAN = TagType.SENSITIVE.value  # noqa: PIE796
    IN_AADHAAR = TagType.SENSITIVE.value  # noqa: PIE796
    IN_VEHICLE_REGISTRATION = TagType.SENSITIVE.value  # noqa: PIE796
    IN_VOTER = TagType.SENSITIVE.value  # noqa: PIE796
    IN_PASSPORT = TagType.SENSITIVE.value  # noqa: PIE796

    # Finland
    FI_PERSONAL_IDENTITY_CODE = TagType.SENSITIVE.value  # noqa: PIE796
