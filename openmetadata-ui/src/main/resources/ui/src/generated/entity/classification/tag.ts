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
 * A `Tag` entity is used for classification or categorization. It is a term defined under
 * `Classification` entity. Tags are used to label the entities and entity fields, such as
 * Tables, and Columns.
 */
export interface Tag {
    /**
     * Whether automatic classification is enabled for this tag
     */
    autoClassificationEnabled?: boolean;
    /**
     * Priority for conflict resolution when multiple tags match (higher number = higher
     * priority)
     */
    autoClassificationPriority?: number;
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * Children tags under this tag.
     */
    children?: EntityReference[];
    /**
     * Reference to the classification that this tag is part of.
     */
    classification?: EntityReference;
    /**
     * List of data products this entity is part of.
     */
    dataProducts?: EntityReference[];
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * If the tag is deprecated.
     */
    deprecated?: boolean;
    /**
     * Description of the tag.
     */
    description: string;
    /**
     * System tags can't be deleted. Use this flag to disable them.
     */
    disabled?: boolean;
    /**
     * Display Name that identifies this tag.
     */
    displayName?: string;
    /**
     * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
     * it belongs to.
     */
    domains?: EntityReference[];
    /**
     * Status of the tag.
     */
    entityStatus?: EntityStatus;
    /**
     * Unique name of the tag of format `Classification.tag1.tag2`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to the tag.
     */
    href?: string;
    /**
     * Unique identifier of this entity instance.
     */
    id: string;
    /**
     * Bot user that performed the action on behalf of the actual user.
     */
    impersonatedBy?: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Children tags under this group are mutually exclusive. When mutually exclusive is `true`
     * the tags from this group are used to **classify** an entity. An entity can only be in one
     * class - example, it can only be either `tier1` or `tier2` and not both. When mutually
     * exclusive is `false`, the tags from this group are used to **categorize** an entity. An
     * entity can be in multiple categories simultaneously - example a customer can be
     * `newCustomer` and `atRisk` simultaneously.
     */
    mutuallyExclusive?: boolean;
    /**
     * Name of the tag.
     */
    name: string;
    /**
     * Owners of this glossary term.
     */
    owners?: EntityReference[];
    /**
     * Reference to the parent tag. When null, the term is at the root of the Classification.
     */
    parent?:   EntityReference;
    provider?: ProviderType;
    /**
     * List of recognizers configured for automatic detection of this tag
     */
    recognizers?: Recognizer[];
    /**
     * User references of the reviewers for this tag.
     */
    reviewers?: EntityReference[];
    style?:     Style;
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    /**
     * Count of how many times this tag and children tags are used.
     */
    usageCount?: number;
    /**
     * Metadata version of the entity.
     */
    version?: number;
}

/**
 * Change that lead to this version of the entity.
 *
 * Description of the change.
 */
export interface ChangeDescription {
    changeSummary?: { [key: string]: ChangeSummary };
    /**
     * Names of fields added during the version changes.
     */
    fieldsAdded?: FieldChange[];
    /**
     * Fields deleted during the version changes with old value before deleted.
     */
    fieldsDeleted?: FieldChange[];
    /**
     * Fields modified during the version changes with old and new values.
     */
    fieldsUpdated?: FieldChange[];
    /**
     * When a change did not result in change, this could be same as the current version.
     */
    previousVersion?: number;
}

export interface ChangeSummary {
    changedAt?: number;
    /**
     * Name of the user or bot who made this change
     */
    changedBy?:    string;
    changeSource?: ChangeSource;
    [property: string]: any;
}

/**
 * The source of the change. This will change based on the context of the change (example:
 * manual vs programmatic)
 */
export enum ChangeSource {
    Automated = "Automated",
    Derived = "Derived",
    Ingested = "Ingested",
    Manual = "Manual",
    Propagated = "Propagated",
    Suggested = "Suggested",
}

export interface FieldChange {
    /**
     * Name of the entity field that changed.
     */
    name?: string;
    /**
     * New value of the field. Note that this is a JSON string and use the corresponding field
     * type to deserialize it.
     */
    newValue?: any;
    /**
     * Previous value of the field. Note that this is a JSON string and use the corresponding
     * field type to deserialize it.
     */
    oldValue?: any;
}

/**
 * Children tags under this tag.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Reference to the classification that this tag is part of.
 *
 * Reference to the parent tag. When null, the term is at the root of the Classification.
 *
 * User who added this exception
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}

/**
 * Status of the tag.
 *
 * Status of an entity. It is used for governance and is applied to all the entities in the
 * catalog.
 */
export enum EntityStatus {
    Approved = "Approved",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
    Rejected = "Rejected",
    Unprocessed = "Unprocessed",
}

/**
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled. Some apps such as AutoPilot create entities with
 * `automation` provider type. These entities can be deleted by the user.
 */
export enum ProviderType {
    Automation = "automation",
    System = "system",
    User = "user",
}

/**
 * Configuration for automatic entity recognition and classification, supporting both
 * pattern-based and context-aware detection methods.
 */
export interface Recognizer {
    /**
     * Minimum confidence score required for detection
     */
    confidenceThreshold?: number;
    /**
     * Description of what this recognizer detects
     */
    description?: string;
    /**
     * Display name for the recognizer
     */
    displayName?: string;
    /**
     * Whether this recognizer is enabled
     */
    enabled?: boolean;
    /**
     * Entity links where this recognizer should NOT run (based on user feedback)
     */
    exceptionList?: RecognizerException[];
    /**
     * Unique identifier of the recognizer
     */
    id?: string;
    /**
     * Whether this is a system default recognizer
     */
    isSystemDefault?: boolean;
    /**
     * Name of the recognizer
     */
    name:             string;
    recognizerConfig: RecognizerConfig;
    /**
     * What the recognizer will analyze for classification. `column_name` means it classifies
     * based on the column's name, `content` uses sample data from the column instead.
     */
    target?: Target;
    /**
     * Last update time in Unix epoch time milliseconds
     */
    updatedAt?: number;
    /**
     * User who made the update
     */
    updatedBy?: string;
    /**
     * Version of the recognizer configuration
     */
    version?: number;
}

/**
 * Exception entry for entities where recognizer should not run
 */
export interface RecognizerException {
    addedAt?: number;
    /**
     * User who added this exception
     */
    addedBy?: EntityReference;
    /**
     * Entity link to exclude from recognition
     */
    entityLink: string;
    /**
     * ID of the feedback that triggered this exception
     */
    feedbackId?: string;
    /**
     * Reason for exclusion
     */
    reason?: string;
}

/**
 * Complete recognizer configuration
 *
 * Pattern-based recognizer using regular expressions
 *
 * Exact terms recognizer that matches against a list of specific values
 *
 * Context-aware recognizer using surrounding text
 *
 * Custom recognizer with user-defined logic
 *
 * Built-in recognizer definition. See
 * https://github.com/microsoft/presidio/tree/04920aafbb2958b7359183bf5a72af627cdb2808/presidio-analyzer/presidio_analyzer/predefined_recognizers
 */
export interface RecognizerConfig {
    /**
     * List of context words that can help boost confidence score
     */
    context?: string[];
    /**
     * List of patterns
     */
    patterns?:   Pattern[];
    regexFlags?: RegexFlags;
    /**
     * Language supported by this recognizer
     */
    supportedLanguage?: ClassificationLanguage;
    type:               any;
    /**
     * List of values to match against
     */
    exactTerms?: string[];
    /**
     * Words that indicate the presence of the entity
     */
    contextWords?: string[];
    /**
     * Factor to increase score based on entity length
     */
    increaseFactorByCharLength?: number;
    /**
     * Maximum confidence score
     */
    maxScore?: number;
    /**
     * Minimum confidence score
     */
    minScore?: number;
    /**
     * Custom configuration parameters
     */
    config?: { [key: string]: any };
    /**
     * Optional custom validation function (Python code)
     */
    validatorFunction?: string;
    /**
     * Name of the recognizer (defaults to class name if not provided)
     */
    name?: Name;
    /**
     * PII (Personally Identifiable Information) tags for classification and detection of
     * sensitive data
     */
    supportedEntities?: PIIEntity[];
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
 * Pattern objects used for PatternRecognizers
 */
export interface Pattern {
    /**
     * Name of the pattern
     */
    name: string;
    /**
     * Regular expression pattern
     */
    regex: string;
    /**
     * Confidence score for this pattern (0.0 to 1.0)
     */
    score?: number;
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
 * Supported languages for auto classification recognizers (ISO 639-1 codes). Use 'any' to
 * apply all recognizers regardless of their configured language.
 */
export enum ClassificationLanguage {
    AF = "af",
    Am = "am",
    Any = "any",
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

/**
 * What the recognizer will analyze for classification. `column_name` means it classifies
 * based on the column's name, `content` uses sample data from the column instead.
 */
export enum Target {
    ColumnName = "column_name",
    Content = "content",
}

/**
 * UI Style is used to associate a color code and/or icon to entity to customize the look of
 * that entity in UI.
 */
export interface Style {
    /**
     * Hex Color Code to mark an entity such as GlossaryTerm, Tag, Domain or Data Product.
     */
    color?: string;
    /**
     * Cover image configuration for the entity.
     */
    coverImage?: CoverImage;
    /**
     * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
     */
    iconURL?: string;
}

/**
 * Cover image configuration for the entity.
 *
 * Cover image configuration for an entity. This is used to display a banner or header image
 * for entities like Domain, Glossary, Data Product, etc.
 */
export interface CoverImage {
    /**
     * Position of the cover image in CSS background-position format. Supports keywords (top,
     * center, bottom) or pixel values (e.g., '20px 30px').
     */
    position?: string;
    /**
     * URL of the cover image.
     */
    url?: string;
}
