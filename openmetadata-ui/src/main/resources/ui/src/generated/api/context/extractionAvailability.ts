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
 * Whether memories can be extracted from Context Center documents and articles now, and why
 * not when they cannot.
 */
export interface ExtractionAvailability {
    /**
     * True when memories can be extracted now.
     */
    available: boolean;
    /**
     * Why memories cannot be extracted, present only when available is false.
     * ExtractionDisabled: the LLM or memory extraction is turned off. ProviderDisabled: the AI
     * provider that extracts memories is turned off. ProviderUnavailable: the AI provider that
     * extracts memories is unavailable.
     */
    reason?: Reason;
}

/**
 * Why memories cannot be extracted, present only when available is false.
 * ExtractionDisabled: the LLM or memory extraction is turned off. ProviderDisabled: the AI
 * provider that extracts memories is turned off. ProviderUnavailable: the AI provider that
 * extracts memories is unavailable.
 */
export enum Reason {
    ExtractionDisabled = "ExtractionDisabled",
    ProviderDisabled = "ProviderDisabled",
    ProviderUnavailable = "ProviderUnavailable",
}
