/*
 *  Copyright 2025 Collate.
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
 * Container for multi-language translations of entity fields
 */
export interface Translations {
    /**
     * List of translations for different locales
     */
    translations?: Translation[];
}

/**
 * Translation for a specific locale
 */
export interface Translation {
    /**
     * Translated description
     */
    description?: string;
    /**
     * Translated display name
     */
    displayName?: string;
    /**
     * Locale code (e.g., 'en', 'es', 'fr', 'zh-CN')
     */
    locale: string;
}
