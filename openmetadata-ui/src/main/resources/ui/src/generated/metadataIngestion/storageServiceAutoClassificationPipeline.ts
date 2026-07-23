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
 * StorageService AutoClassification Pipeline Configuration.
 */
export interface StorageServiceAutoClassificationPipeline {
    /**
     * Regex to only fetch buckets (top-level containers) that match the pattern.
     */
    bucketFilterPattern?: FilterPattern;
    /**
     * Regex to only compute metrics for containers that matches the given tag, tiers, glossary
     * pattern.
     */
    classificationFilterPattern?: FilterPattern;
    /**
     * Language to use for auto classification recognizers. Use 'any' to run all recognizers
     * regardless of their configured language. For specific languages, only recognizers that
     * support that language will be used.
     */
    classificationLanguage?: ClassificationLanguage;
    /**
     * Set the Confidence value for which you want the column to be tagged as PII. Confidence
     * value ranges from 0 to 100. A higher number will yield less false positives but more
     * false negatives. A lower number will yield more false positives but less false negatives.
     */
    confidence?: number;
    /**
     * Regex to only fetch containers that matches the pattern.
     */
    containerFilterPattern?: FilterPattern;
    /**
     * Optional configuration to automatically tag columns that might contain sensitive
     * information
     */
    enableAutoClassification?: boolean;
    /**
     * Number of sample rows to ingest when 'Generate Sample Data' is enabled
     */
    sampleDataCount?: number;
    /**
     * Option to turn on/off storing sample data. If enabled, we will ingest sample data for
     * each structured container.
     */
    storeSampleData?: boolean;
    /**
     * Pipeline type
     */
    type?: AutoClassificationConfigType;
    /**
     * Regex will be applied on fully qualified name (e.g service_name.container_name) instead
     * of raw name (e.g. container_name)
     */
    useFqnForFiltering?: boolean;
}

/**
 * Regex to only fetch buckets (top-level containers) that match the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only compute metrics for containers that matches the given tag, tiers, glossary
 * pattern.
 *
 * Regex to only fetch containers that matches the pattern.
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
 * Language to use for auto classification recognizers. Use 'any' to run all recognizers
 * regardless of their configured language. For specific languages, only recognizers that
 * support that language will be used.
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
 * Storage Service Auto Classification Pipeline type
 */
export enum AutoClassificationConfigType {
    AutoClassification = "AutoClassification",
}
