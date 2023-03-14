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
import { getInitOptions } from './i18nextUtil';

// Initialize i18next (language)
i18n
  .use(LanguageDetector) // Detects system language
  .use(initReactI18next)
  .init(getInitOptions());

export const addLocalResource = async (nameSpace: string) => {
  const hasLocalResource = i18n.hasResourceBundle(i18n.language, nameSpace);

  if (!hasLocalResource) {
    try {
      const translation = await import(
        `../../locale/${i18n.language}/${nameSpace}.json`
      );

      i18n.addResourceBundle(
        i18n.language,
        nameSpace,
        translation?.default ?? {}
      );
    } catch (error) {
      // handle error
    }
  }
};

export default i18n;
