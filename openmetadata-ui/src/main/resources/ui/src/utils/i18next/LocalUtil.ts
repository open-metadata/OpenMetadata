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

import i18n from 'i18next';
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

export default i18n;
