/*
 *  Copyright 2022 Collate.
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

import i18n, { t as i18nextT } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { getInitOptions, languageMap } from './i18nextUtil';
import { SupportedLocales } from './LocalUtil.interface';

// Function to detect browser language
export const detectBrowserLanguage = (): SupportedLocales => {
  const browserLang = navigator.language;
  const browserLangs = navigator.languages || [browserLang];
  let browserLanguage = undefined;
  for (const lang of browserLangs) {
    const langCode = lang.split('-')[0];

    if (languageMap[langCode]) {
      browserLanguage = languageMap[langCode];

      return browserLanguage;
    }
  }

  // English is the default language when we don't support browser language
  return browserLanguage ?? SupportedLocales.English;
};

// Initialize i18next (language)
i18n
  .use(LanguageDetector) // Detects system language
  .use(initReactI18next)
  .init(getInitOptions());

export const t = (key: string, options?: Record<string, unknown>): string => {
  const translation = i18nextT(key, options);

  return String(translation);
};

/**
 * Translates a label with support for nested translation parameters.
 * If parameters contain translation keys (strings), they will be translated first.
 *
 * @param label - The translation key to translate
 * @param params - Optional parameters where string values will be treated as translation keys
 * @returns The translated string with all nested translations resolved
 *
 * @example
 * translateWithNestedKeys('label.entity-type-plural', { entity: 'label.table' })
 * // Translates 'label.table' first, then uses it as parameter for 'label.entity-type-plural'
 */
export const translateWithNestedKeys = (
  label: string,
  params?: Record<string, string | number | boolean>
): string => {
  if (!params) {
    return t(label);
  }

  const translatedParams = Object.entries(params).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: typeof value === 'string' ? t(value) : value,
    }),
    {}
  );

  return t(label, translatedParams);
};

export default i18n;
