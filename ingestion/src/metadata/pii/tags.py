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
import enum
from typing import Collection


@enum.unique
class PIITag(enum.Enum):
    """
    PII Tags (borrowed from Presidio https://microsoft.github.io/presidio/supported_entities/).
    """

    # Global
    CREDIT_CARD = "CREDIT_CARD"
    CRYPTO = "CRYPTO"  # Crypto Wallet Address
    DATE_TIME = "DATE_TIME"
    EMAIL_ADDRESS = "EMAIL_ADDRESS"
    IBAN_CODE = "IBAN_CODE"
    IP_ADDRESS = "IP_ADDRESS"
    NRP = "NRP"
    LOCATION = "LOCATION"
    PERSON = "PERSON"
    PHONE_NUMBER = "PHONE_NUMBER"
    MEDICAL_LICENSE = "MEDICAL_LICENSE"
    URL = "URL"

    # USA
    US_BANK_NUMBER = "US_BANK_NUMBER"
    US_DRIVER_LICENSE = "US_DRIVER_LICENSE"
    US_ITIN = "US_ITIN"
    US_PASSPORT = "US_PASSPORT"
    US_SSN = "US_SSN"

    # UK
    UK_NHS = "UK_NHS"

    # Spain
    ES_NIF = "ES_NIF"
    ES_NIE = "ES_NIE"

    # Italy
    IT_FISCAL_CODE = "IT_FISCAL_CODE"
    IT_DRIVER_LICENSE = "IT_DRIVER_LICENSE"
    IT_VAT_CODE = "IT_VAT_CODE"
    IT_PASSPORT = "IT_PASSPORT"
    IT_IDENTITY_CARD = "IT_IDENTITY_CARD"

    # Poland
    PL_PESEL = "PL_PESEL"

    # Singapore
    SG_NRIC_FIN = "SG_NRIC_FIN"
    SG_UEN = "SG_UEN"

    # Australia
    AU_ABN = "AU_ABN"
    AU_ACN = "AU_ACN"
    AU_TFN = "AU_TFN"
    AU_MEDICARE = "AU_MEDICARE"

    # India
    IN_PAN = "IN_PAN"
    IN_AADHAAR = "IN_AADHAAR"
    IN_VEHICLE_REGISTRATION = "IN_VEHICLE_REGISTRATION"
    IN_VOTER = "IN_VOTER"
    IN_PASSPORT = "IN_PASSPORT"

    # Finland
    FI_PERSONAL_IDENTITY_CODE = "FI_PERSONAL_IDENTITY_CODE"


class SensitivityLevel(enum.Enum):
    SENSITIVE = "Sensitive"
    NONSENSITIVE = "NonSensitive"


DEFAULT_NON_SENSITIVE_PII = (
    PIITag.DATE_TIME,
    PIITag.NRP,
    PIITag.LOCATION,
    PIITag.PHONE_NUMBER,
    PIITag.URL,
)


def pii_tag_to_sensitivity_level(
    tag: PIITag, non_sensitive_tags: Collection[PIITag] = DEFAULT_NON_SENSITIVE_PII
) -> SensitivityLevel:
    """
    Transform PII tag to a sensitivity level.

    This map is opinionated and can be changed in the future according to users' needs.
    """
    if tag in non_sensitive_tags:
        return SensitivityLevel.NONSENSITIVE
    return SensitivityLevel.SENSITIVE
