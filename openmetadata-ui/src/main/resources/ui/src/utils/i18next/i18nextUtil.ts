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

import i18next, { InitOptions } from 'i18next';
import { map, upperCase } from 'lodash';
import deDe from '../../locale/languages/de-de.json';
import enUS from '../../locale/languages/en-us.json';
import esES from '../../locale/languages/es-es.json';
import frFR from '../../locale/languages/fr-fr.json';
import glES from '../../locale/languages/gl-es.json';
import heHE from '../../locale/languages/he-he.json';
import jaJP from '../../locale/languages/ja-jp.json';
import koKR from '../../locale/languages/ko-kr.json';
import mrIN from '../../locale/languages/mr-in.json';
import nlNL from '../../locale/languages/nl-nl.json';
import prPR from '../../locale/languages/pr-pr.json';
import ptBR from '../../locale/languages/pt-br.json';
import ptPT from '../../locale/languages/pt-pt.json';
import ruRU from '../../locale/languages/ru-ru.json';
import thTH from '../../locale/languages/th-th.json';
import trTR from '../../locale/languages/tr-tr.json';
import zhCN from '../../locale/languages/zh-cn.json';
import { SupportedLocales } from './LocalUtil.interface';

export const languageSelectOptions = map(SupportedLocales, (value, key) => ({
  label: `${key} - ${upperCase(value.split('-')[0])}`,
  key: value,
}));

// Returns i18next options
export const getInitOptions = (): InitOptions => {
  return {
    supportedLngs: Object.values(SupportedLocales),
    resources: {
      'en-US': { translation: enUS },
      'ko-KR': { translation: koKR },
      'fr-FR': { translation: frFR },
      'zh-CN': { translation: zhCN },
      'ja-JP': { translation: jaJP },
      'pt-BR': { translation: ptBR },
      'pt-PT': { translation: ptPT },
      'es-ES': { translation: esES },
      'gl-ES': { translation: glES },
      'ru-RU': { translation: ruRU },
      'de-DE': { translation: deDe },
      'he-HE': { translation: heHE },
      'nl-NL': { translation: nlNL },
      'pr-PR': { translation: prPR },
      'th-TH': { translation: thTH },
      'mr-IN': { translation: mrIN },
      'tr-TR': { translation: trTR },
    },
    fallbackLng: ['en-US'],
    detection: {
      order: ['querystring', 'cookie', 'navigator'],
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

// Returns the current locale to use in cronstrue
export const getCurrentLocaleForConstrue = () => {
  // For cronstrue, we need to pass the locale in the format 'pt_BR' and not 'pt-BR'
  // for some selected languages
  if (
    [
      SupportedLocales['Português (Brasil)'],
      SupportedLocales['Português (Portugal)'],
      SupportedLocales.简体中文,
    ].includes(i18next.resolvedLanguage as SupportedLocales)
  ) {
    return i18next.resolvedLanguage.replaceAll('-', '_');
  }

  return i18next.resolvedLanguage.split('-')[0];
};

// Map common language codes to supported locales
export const languageMap: Record<string, SupportedLocales> = {
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
