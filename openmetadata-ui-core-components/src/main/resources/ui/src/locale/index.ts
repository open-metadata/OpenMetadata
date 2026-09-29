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

import type { i18n as I18n, ResourceKey } from 'i18next';
import arSA from './languages/ar-sa.json';
import deDE from './languages/de-de.json';
import enUS from './languages/en-us.json';
import esES from './languages/es-es.json';
import frFR from './languages/fr-fr.json';
import glES from './languages/gl-es.json';
import heHE from './languages/he-he.json';
import jaJP from './languages/ja-jp.json';
import koKR from './languages/ko-kr.json';
import mrIN from './languages/mr-in.json';
import nlNL from './languages/nl-nl.json';
import prPR from './languages/pr-pr.json';
import ptBR from './languages/pt-br.json';
import ptPT from './languages/pt-pt.json';
import ruRU from './languages/ru-ru.json';
import svSE from './languages/sv-se.json';
import thTH from './languages/th-th.json';
import trTR from './languages/tr-tr.json';
import zhCN from './languages/zh-cn.json';
import zhTW from './languages/zh-tw.json';

export const CORE_NS = 'core';

// Eager bundles. The library's total translation payload is small enough
// (~a few tens of KB across 20 languages) that loading all up-front is cheaper
// than the alternative — a lazy import inside `languageChanged` races React's
// re-render and causes migrated strings to flash their key on the first paint
// after a language switch. Add one entry per language JSON.
const CORE_BUNDLES: Record<string, ResourceKey> = {
  'en-US': enUS,
  'ar-SA': arSA,
  'de-DE': deDE,
  'es-ES': esES,
  'fr-FR': frFR,
  'gl-ES': glES,
  'he-HE': heHE,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'mr-IN': mrIN,
  'nl-NL': nlNL,
  'pr-PR': prPR,
  'pt-BR': ptBR,
  'pt-PT': ptPT,
  'ru-RU': ruRU,
  'sv-SE': svSE,
  'th-TH': thTH,
  'tr-TR': trTR,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
};

/**
 * Register the library's `core` namespace on the host i18next instance for
 * every supported language. Safe to call multiple times — resource-bundle
 * registration is idempotent when `overwrite=false`. Call once after the
 * host's own `i18next.init(...)` resolves.
 */
export function initCoreI18n(i18n: I18n): void {
  for (const [lng, bundle] of Object.entries(CORE_BUNDLES)) {
    if (i18n.hasResourceBundle(lng, CORE_NS)) {
      continue;
    }
    i18n.addResourceBundle(
      lng,
      CORE_NS,
      bundle,
      /* deep */ true,
      /* overwrite */ false
    );
  }
}

export const CORE_LOCALES: readonly string[] = Object.keys(CORE_BUNDLES);
