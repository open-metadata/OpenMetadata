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
import { getInitOptions } from './i18nextUtil';
import { SupportedLocales } from './LocalUtil.interface';

// Function to detect browser language
export const detectBrowserLanguage = (): SupportedLocales => {
  const browserLang = navigator.language;
  const browserLangs = navigator.languages || [browserLang];
  let browserLanguage = undefined;
  for (const lang of browserLangs) {
    const langCode = lang.split('-')[0];
    // Map common language codes to supported locales
    const languageMap: Record<string, SupportedLocales> = {
      mr: SupportedLocales.मराठी, // Marathi
      en: SupportedLocales.English,
      ko: SupportedLocales.한국어,
      fr: SupportedLocales.Français,
      zh: SupportedLocales.简体中文,
      ja: SupportedLocales.日本語,
      pt: SupportedLocales['Português (Brasil)'], // Default to Brazilian Portuguese
      es: SupportedLocales.Español,
      gl: SupportedLocales.Galego,
      ru: SupportedLocales.Русский,
      de: SupportedLocales.Deutsch,
      he: SupportedLocales.Hebrew,
      nl: SupportedLocales.Nederlands,
      pr: SupportedLocales.Persian,
      th: SupportedLocales.Thai,
      tr: SupportedLocales.Türkçe,
    };

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

export default i18n;
