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
import enUS from './languages/en-us.json';

export const CORE_NS = 'core';

// Filename → i18next locale code map. Kept next to the loaders so a new
// language is one line: add the file + add the entry here.
//
// Each loaded JSON module is one namespace's flat key→string bundle (i18next's
// `ResourceKey`), not a full multi-language `Resource` tree — that's the shape
// `addResourceBundle(lng, ns, resources)` itself expects for `resources`.
const CORE_LOCALE_LOADERS: Record<
  string,
  () => Promise<{ default: ResourceKey }>
> = {
  'ar-SA': () => import('./languages/ar-sa.json'),
  'de-DE': () => import('./languages/de-de.json'),
  'es-ES': () => import('./languages/es-es.json'),
  'fr-FR': () => import('./languages/fr-fr.json'),
  'gl-ES': () => import('./languages/gl-es.json'),
  'he-HE': () => import('./languages/he-he.json'),
  'ja-JP': () => import('./languages/ja-jp.json'),
  'ko-KR': () => import('./languages/ko-kr.json'),
  'mr-IN': () => import('./languages/mr-in.json'),
  'nl-NL': () => import('./languages/nl-nl.json'),
  'pr-PR': () => import('./languages/pr-pr.json'),
  'pt-BR': () => import('./languages/pt-br.json'),
  'pt-PT': () => import('./languages/pt-pt.json'),
  'ru-RU': () => import('./languages/ru-ru.json'),
  'sv-SE': () => import('./languages/sv-se.json'),
  'th-TH': () => import('./languages/th-th.json'),
  'tr-TR': () => import('./languages/tr-tr.json'),
  'zh-CN': () => import('./languages/zh-cn.json'),
  'zh-TW': () => import('./languages/zh-tw.json'),
};

/**
 * Register the library's `core` namespace on the host i18next instance.
 * Eagerly loads only `en-US` (small); other locales are lazy via `loadCoreLocale`.
 * Safe to call multiple times — resource-bundle registration is idempotent when
 * `overwrite=false`.
 */
export function initCoreI18n(i18n: I18n): void {
  if (i18n.hasResourceBundle('en-US', CORE_NS)) {
    return;
  }
  i18n.addResourceBundle(
    'en-US',
    CORE_NS,
    enUS,
    /* deep */ true,
    /* overwrite */ false
  );
}

/**
 * Lazy-load the `core` namespace for one non-en-US locale. Host apps should
 * call this from their existing `languageChanged` handler.
 */
export async function loadCoreLocale(i18n: I18n, lng: string): Promise<void> {
  if (i18n.hasResourceBundle(lng, CORE_NS)) {
    return;
  }
  const loader = CORE_LOCALE_LOADERS[lng];
  if (!loader) {
    return;
  }
  const mod = await loader();
  i18n.addResourceBundle(
    lng,
    CORE_NS,
    mod.default,
    /* deep */ true,
    /* overwrite */ false
  );
}

// Storybook / eager-mode consumers use this.
export const CORE_LOCALES: readonly string[] = [
  'en-US',
  ...Object.keys(CORE_LOCALE_LOADERS),
];
