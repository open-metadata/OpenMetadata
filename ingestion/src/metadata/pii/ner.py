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
    CRYPTO = TagType.SENSITIVE.value
    DATE_TIME = TagType.NONSENSITIVE.value
    EMAIL_ADDRESS = TagType.SENSITIVE.value
    IBAN_CODE = TagType.SENSITIVE.value
    IP_ADDRESS = TagType.SENSITIVE.value
    NRP = TagType.NONSENSITIVE.value
    LOCATION = TagType.NONSENSITIVE.value
    PERSON = TagType.SENSITIVE.value
    PHONE_NUMBER = TagType.NONSENSITIVE.value
    MEDICAL_LICENSE = TagType.SENSITIVE.value
    URL = TagType.NONSENSITIVE.value

    # USA
    US_BANK_NUMBER = TagType.SENSITIVE.value
    US_DRIVER_LICENSE = TagType.SENSITIVE.value
    US_ITIN = TagType.SENSITIVE.value
    US_PASSPORT = TagType.SENSITIVE.value
    US_SSN = TagType.SENSITIVE.value

    # UK
    UK_NHS = TagType.SENSITIVE.value

    # Spain
    ES_NIF = TagType.SENSITIVE.value
    ES_NIE = TagType.SENSITIVE.value

    # Italy
    IT_FISCAL_CODE = TagType.SENSITIVE.value
    IT_DRIVER_LICENSE = TagType.SENSITIVE.value
    IT_VAT_CODE = TagType.SENSITIVE.value
    IT_PASSPORT = TagType.SENSITIVE.value
    IT_IDENTITY_CARD = TagType.SENSITIVE.value

    # Poland
    PL_PESEL = TagType.SENSITIVE.value

    # Singapore
    SG_NRIC_FIN = TagType.SENSITIVE.value
    SG_UEN = TagType.SENSITIVE.value

    # Australia
    AU_ABN = TagType.SENSITIVE.value
    AU_ACN = TagType.SENSITIVE.value
    AU_TFN = TagType.SENSITIVE.value
    AU_MEDICARE = TagType.SENSITIVE.value

    # India
    IN_PAN = TagType.SENSITIVE.value
    IN_AADHAAR = TagType.SENSITIVE.value
    IN_VEHICLE_REGISTRATION = TagType.SENSITIVE.value
    IN_VOTER = TagType.SENSITIVE.value
    IN_PASSPORT = TagType.SENSITIVE.value

    # Finland
    FI_PERSONAL_IDENTITY_CODE = TagType.SENSITIVE.value
