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
 * MessagingService AutoClassification Pipeline Configuration.
 */
export interface MessagingServiceAutoClassificationPipeline {
    /**
     * Regex to only compute metrics for entities that match the pattern
     */
    classificationFilterPattern?: FilterPattern;
    /**
     * Language used for classification. Supported languages include: en (English).
     */
    classificationLanguage?: ClassificationLanguage;
    /**
     * Set the Confidence value for which you want the column to be tagged as PII. Confidence
     * value ranges from 0 to 100. A higher number will tag less columns as PII, whereas a lower
     * number will tag more columns as PII.
     */
    confidence?: number;
    /**
     * Optional configuration to automatically tag columns that might contain sensitive
     * information.
     */
    enableAutoClassification?: boolean;
    /**
     * No. of messages to fetch during sample data ingestion.
     */
    sampleDataCount?: number;
    /**
     * Option to turn on/off storing sample data. If enabled, we will ingest sample data for
     * each topic.
     */
    storeSampleData?: boolean;
    /**
     * Regex to only fetch topics that matches the pattern.
     */
    topicFilterPattern?: FilterPattern;
    /**
     * Pipeline type
     */
    type?: AutoClassificationConfigType;
    /**
     * Regex will be applied on fully qualified name (e.g
     * service_name.db_name.schema_name.table_name) instead of on the short name (e.g.
     * table_name). Short name is used as default.
     */
    useFqnForFiltering?: boolean;
}

/**
 * Regex to only compute metrics for entities that match the pattern
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only fetch topics that matches the pattern.
 */
export interface FilterPattern {
    /**
     * List of strings/regex patterns to match and exclude only database entities that match.
     */
    excludes?: string[];
    /**
     * List of strings/regex patterns to match and include only database entities that match.
     */
    includes?: string[];
}

/**
 * Language used for classification. Supported languages include: en (English).
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
 * Pipeline type
 *
 * Messaging Service Auto Classification Pipeline type
 */
export enum AutoClassificationConfigType {
    AutoClassification = "AutoClassification",
}
