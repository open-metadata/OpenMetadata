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
 * Exact terms recognizer that matches against a list of specific values
 */
export interface ExactTermsRecognizer {
    /**
     * List of values to match against
     */
    exactTerms: string[];
    regexFlags: RegexFlags;
    /**
     * The entity type this recognizer detects
     */
    supportedEntity: PIIEntity;
    /**
     * Language supported by this recognizer
     */
    supportedLanguage: ClassificationLanguage;
    type:              any;
}

/**
 * Regex flags used for PatternRecognizers
 */
export interface RegexFlags {
    /**
     * DOTALL flag - `.` matches newlines
     */
    dotAll?: boolean;
    /**
     * IGNORECASE flag - case insensitive matching
     */
    ignoreCase?: boolean;
    /**
     * MULTILINE flag - `^` and `$` match line boundaries
     */
    multiline?: boolean;
}

/**
 * The entity type this recognizer detects
 *
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

/**
 * Language supported by this recognizer
 *
 * Supported languages for auto classification recognizers (ISO 639-1 codes)
 */
export enum ClassificationLanguage {
    AF = "af",
    Am = "am",
    Ar = "ar",
    Az = "az",
    Be = "be",
    Bg = "bg",
    Bn = "bn",
    Bs = "bs",
    CA = "ca",
    CS = "cs",
    Cy = "cy",
    Da = "da",
    De = "de",
    El = "el",
    En = "en",
    Es = "es",
    Et = "et",
    Eu = "eu",
    Fa = "fa",
    Fi = "fi",
    Fr = "fr",
    Ga = "ga",
    Gl = "gl",
    Gu = "gu",
    HT = "ht",
    He = "he",
    Hi = "hi",
    Hr = "hr",
    Hu = "hu",
    Hy = "hy",
    ID = "id",
    Is = "is",
    It = "it",
    Ja = "ja",
    KM = "km",
    Ka = "ka",
    Kk = "kk",
    Kn = "kn",
    Ko = "ko",
    Ku = "ku",
    Ky = "ky",
    LV = "lv",
    Lo = "lo",
    Lt = "lt",
    MS = "ms",
    MT = "mt",
    Mi = "mi",
    Mk = "mk",
    Ml = "ml",
    Mn = "mn",
    Mr = "mr",
    My = "my",
    Ne = "ne",
    Nl = "nl",
    No = "no",
    PS = "ps",
    Pa = "pa",
    Pl = "pl",
    Pt = "pt",
    Ro = "ro",
    Ru = "ru",
    Si = "si",
    Sk = "sk",
    Sl = "sl",
    So = "so",
    Sq = "sq",
    Sr = "sr",
    Sv = "sv",
    Sw = "sw",
    Ta = "ta",
    Te = "te",
    Th = "th",
    Tl = "tl",
    Tr = "tr",
    Uk = "uk",
    Ur = "ur",
    Uz = "uz",
    Vi = "vi",
    Yi = "yi",
    Zh = "zh",
    Zu = "zu",
}
