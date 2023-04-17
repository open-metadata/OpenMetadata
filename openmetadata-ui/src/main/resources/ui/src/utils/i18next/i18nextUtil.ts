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

import { InitOptions } from 'i18next';
import { map, upperCase } from 'lodash';
import enUS from '../../locale/languages/en-us.json';
import frFR from '../../locale/languages/fr-fr.json';
import jaJP from '../../locale/languages/ja-jp.json';
import zhCN from '../../locale/languages/zh-cn.json';

export enum SupportedLocales {
  English = 'en-US',
  Français = 'fr-FR',
  简体中文 = 'zh-CN',
  日本語 = 'ja-JP',
}

export const languageSelectOptions = map(SupportedLocales, (value, key) => ({
  label: `${key} - ${upperCase(value.split('-')[0])}`,
  key: value,
}));

export const swapKeysAndValues = <T extends unknown>(
  obj: Record<string, T>
) => {
  const swapped = Object.entries<T>(obj).map(([key, value]) => [value, key]);

  return Object.fromEntries(swapped) as Record<SupportedLocales, string>;
};

/**
 * To reverse track local for local select label
 * {
 *  "en-US": "English"
 * }
 */
export const localeToLanguageMap =
  swapKeysAndValues<SupportedLocales>(SupportedLocales);

// Returns i18next options
export const getInitOptions = (): InitOptions => {
  return {
    supportedLngs: Object.values(SupportedLocales),
    resources: {
      'en-US': { translation: enUS },
      'fr-FR': { translation: frFR },
      'zh-CN': { translation: zhCN },
      'ja-JP': { translation: jaJP },
    },
    fallbackLng: ['en-US'],
    detection: {
      order: ['cookie'],
      caches: ['cookie'], // cache user language on
    },
    interpolation: {
      escapeValue: false, // XSS safety provided by React
    },
    missingKeyHandler: (_lngs, _ns, key) =>
      // eslint-disable-next-line no-console
      console.error(`i18next: key not found "${key}"`),
    saveMissing: true, // Required for missing key handler
  };
};
