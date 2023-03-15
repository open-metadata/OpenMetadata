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

import { ServiceType } from 'generated/entity/services/serviceType';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { isEmpty } from 'lodash';
import { initReactI18next } from 'react-i18next';
import { getInitOptions, SupportedLocales } from './i18nextUtil';

// Initialize i18next (language)
i18n
  .use(LanguageDetector) // Detects system language
  .use(initReactI18next)
  .init(getInitOptions());

/**
 *
 * @param language fetch resource for the language
 * @param nameSpace fetch resource for nameSpace in the language
 * @returns translation records
 */
const fetchTranslation = async (
  language: string,
  nameSpace: string,
  serviceType: ServiceType
) => {
  try {
    const translation = await import(
      `../../locale/${language}/${serviceType}/${nameSpace}.json`
    );

    return translation.default ?? {};
  } catch (error) {
    // handle error
    return {};
  }
};

/**
 *
 * @param language add resource for the language
 * @param nameSpace add resource for the nameSpace in language
 * @param translation records key value pairs
 */
const addTranslationsToI18n = (
  language: string,
  nameSpace: string,
  translation: Record<string, unknown>
) => {
  if (!isEmpty(translation)) {
    i18n.addResourceBundle(language, nameSpace, translation);
  }
};

/**
 * Add resource for nameSpace in current language with fallback mechanism
 * @param nameSpace add resource for the nameSpace in language
 */
export const addLocalResource = async (
  nameSpace: string,
  serviceType: ServiceType
) => {
  const isEnglishLanguage = i18n.language === SupportedLocales.English;

  const [translation, fallbackTranslation] = await Promise.allSettled([
    fetchTranslation(i18n.language, nameSpace, serviceType),
    isEnglishLanguage
      ? Promise.resolve({})
      : fetchTranslation(SupportedLocales.English, nameSpace, serviceType),
  ]);

  if (translation.status === 'fulfilled') {
    addTranslationsToI18n(i18n.language, nameSpace, translation.value);
  }

  if (!isEnglishLanguage && fallbackTranslation.status === 'fulfilled') {
    addTranslationsToI18n(
      SupportedLocales.English,
      nameSpace,
      fallbackTranslation.value
    );
  }
};

export default i18n;
