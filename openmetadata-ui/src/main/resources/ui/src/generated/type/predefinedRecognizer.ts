/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
/**
 * Built-in recognizer definition. See
 * https://github.com/microsoft/presidio/tree/04920aafbb2958b7359183bf5a72af627cdb2808/presidio-analyzer/presidio_analyzer/predefined_recognizers
 */
export interface PredefinedRecognizer {
    /**
     * List of context words that can help boost confidence score
     */
    context?: string[];
    /**
     * Name of the recognizer (defaults to class name if not provided)
     */
    name: Name;
    /**
     * PII (Personally Identifiable Information) tags for classification and detection of
     * sensitive data
     */
    supportedEntities?: PIIEntity[];
    /**
     * Language supported by this recognizer (ISO 639-1 code)
     */
    supportedLanguage?: string;
    type:               any;
}

/**
 * Name of the recognizer (defaults to class name if not provided)
 */
export enum Name {
    AbaRoutingRecognizer = "AbaRoutingRecognizer",
    AuAbnRecognizer = "AuAbnRecognizer",
    AuAcnRecognizer = "AuAcnRecognizer",
    AuMedicareRecognizer = "AuMedicareRecognizer",
    AuTfnRecognizer = "AuTfnRecognizer",
    AzureAILanguageRecognizer = "AzureAILanguageRecognizer",
    CreditCardRecognizer = "CreditCardRecognizer",
    CryptoRecognizer = "CryptoRecognizer",
    DateRecognizer = "DateRecognizer",
    EmailRecognizer = "EmailRecognizer",
    EsNieRecognizer = "EsNieRecognizer",
    EsNifRecognizer = "EsNifRecognizer",
    FiPersonalIdentityCodeRecognizer = "FiPersonalIdentityCodeRecognizer",
    GLiNERRecognizer = "GLiNERRecognizer",
    IPRecognizer = "IpRecognizer",
    IbanRecognizer = "IbanRecognizer",
    InAadhaarRecognizer = "InAadhaarRecognizer",
    InPanRecognizer = "InPanRecognizer",
    InPassportRecognizer = "InPassportRecognizer",
    InVehicleRegistrationRecognizer = "InVehicleRegistrationRecognizer",
    InVoterRecognizer = "InVoterRecognizer",
    ItDriverLicenseRecognizer = "ItDriverLicenseRecognizer",
    ItFiscalCodeRecognizer = "ItFiscalCodeRecognizer",
    ItIdentityCardRecognizer = "ItIdentityCardRecognizer",
    ItPassportRecognizer = "ItPassportRecognizer",
    ItVatCodeRecognizer = "ItVatCodeRecognizer",
    MedicalLicenseRecognizer = "MedicalLicenseRecognizer",
    NhsRecognizer = "NhsRecognizer",
    PhoneRecognizer = "PhoneRecognizer",
    PlPeselRecognizer = "PlPeselRecognizer",
    SgFinRecognizer = "SgFinRecognizer",
    SgUenRecognizer = "SgUenRecognizer",
    SpacyRecognizer = "SpacyRecognizer",
    StanzaRecognizer = "StanzaRecognizer",
    TransformersRecognizer = "TransformersRecognizer",
    URLRecognizer = "UrlRecognizer",
    UkNinoRecognizer = "UkNinoRecognizer",
    UsBankRecognizer = "UsBankRecognizer",
    UsItinRecognizer = "UsItinRecognizer",
    UsLicenseRecognizer = "UsLicenseRecognizer",
    UsPassportRecognizer = "UsPassportRecognizer",
    UsSsnRecognizer = "UsSsnRecognizer",
}

/**
 * Enum of PII (Personally Identifiable Information) tags for classification and detection
 * of sensitive data. Based on Presidio supported entities
 * (https://microsoft.github.io/presidio/supported_entities/).
 */
export enum PIIEntity {
    AuAbn = "AU_ABN",
    AuAcn = "AU_ACN",
    AuMedicare = "AU_MEDICARE",
    AuTfn = "AU_TFN",
    CreditCard = "CREDIT_CARD",
    Crypto = "CRYPTO",
    DateTime = "DATE_TIME",
    EmailAddress = "EMAIL_ADDRESS",
    EsNie = "ES_NIE",
    EsNif = "ES_NIF",
    FiPersonalIdentityCode = "FI_PERSONAL_IDENTITY_CODE",
    IPAddress = "IP_ADDRESS",
    IbanCode = "IBAN_CODE",
    InAadhaar = "IN_AADHAAR",
    InPan = "IN_PAN",
    InPassport = "IN_PASSPORT",
    InVehicleRegistration = "IN_VEHICLE_REGISTRATION",
    InVoter = "IN_VOTER",
    ItDriverLicense = "IT_DRIVER_LICENSE",
    ItFiscalCode = "IT_FISCAL_CODE",
    ItIdentityCard = "IT_IDENTITY_CARD",
    ItPassport = "IT_PASSPORT",
    ItVatCode = "IT_VAT_CODE",
    Location = "LOCATION",
    MedicalLicense = "MEDICAL_LICENSE",
    Nrp = "NRP",
    Person = "PERSON",
    PhoneNumber = "PHONE_NUMBER",
    PlPesel = "PL_PESEL",
    SgNricFin = "SG_NRIC_FIN",
    SgUen = "SG_UEN",
    URL = "URL",
    UkNhs = "UK_NHS",
    UsBankNumber = "US_BANK_NUMBER",
    UsDriverLicense = "US_DRIVER_LICENSE",
    UsItin = "US_ITIN",
    UsPassport = "US_PASSPORT",
    UsSsn = "US_SSN",
}
