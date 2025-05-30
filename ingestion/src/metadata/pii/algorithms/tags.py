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
Definition of tags for the PII algorithms.
These tags currently belong to the layer logic of the algorithms.
"""
import enum
from typing import List


class PIISensitivityTag(enum.Enum):
    SENSITIVE = "Sensitive"
    NONSENSITIVE = "NonSensitive"


@enum.unique
class PIITag(enum.Enum):
    """
    PII Tags (borrowed from Presidio https://microsoft.github.io/presidio/supported_entities/).
    The values of these tags are valid Presidio entity names, changing them
    will break the integration with Presidio.
    A better name for this enum would have been `PredidionPII`.
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

    @classmethod
    def values(cls) -> List[str]:
        """
        Get all the values of the enum as a set of strings.
        """
        return [tag.value for tag in cls]


@enum.unique
class PIICategoryTag(enum.Enum):
    """
    PII Category Tags.
    These tags are used to categorize the PII tags into broader categories,
    for instance, to show the PII tags in the UI.
    """

    PASSWORD = "Password"
    BANK_NUMBER = "BankNumber"
    PERSON = "Person"
    BIRTH_DATE = "BirthDate"
    GENDER = "Gender"
    NRP = "NRP"
    ADDRESS = "Address"
    CREDIT_CARD = "CreditCardNumber"
    CRYPTO = "Crypto"
    DATE_TIME = "DateTime"
    EMAIL_ADDRESS = "Email"
    IBAN_CODE = "IBANCode"
    IP_ADDRESS = "IPAddress"
    LOCATION = "Location"
    PHONE_NUMBER = "PhoneNumber"
    MEDICAL_LICENSE = "MedicalLicense"
    URL = "URL"
    DRIVER_LICENSE = "DriverLicense"
    NATIONAL_ID = "NationalID"
    PASSPORT = "Passport"
    VAT_CODE = "VATCode"
