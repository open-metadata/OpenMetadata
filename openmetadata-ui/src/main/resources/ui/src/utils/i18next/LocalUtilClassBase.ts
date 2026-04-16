/*
 *  Copyright 2024 Collate.
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

import i18next from './LocalUtil';

class LocalUtilClassBase {
  private static _instance: LocalUtilClassBase;
  loadedLocales: Set<string> = new Set<string>(['en-US']);

  LOCALE_LOADERS: Record<
    string,
    () => Promise<{ default: Record<string, unknown> }>
  >;

  constructor() {
    this.loadedLocales = new Set<string>(['en-US']);
    this.LOCALE_LOADERS = {
      'en-US': () => import('../../locale/languages/en-us.json'),
      'ko-KR': () => import('../../locale/languages/ko-kr.json'),
      'fr-FR': () => import('../../locale/languages/fr-fr.json'),
      'zh-CN': () => import('../../locale/languages/zh-cn.json'),
      'zh-TW': () => import('../../locale/languages/zh-tw.json'),
      'ja-JP': () => import('../../locale/languages/ja-jp.json'),
      'pt-BR': () => import('../../locale/languages/pt-br.json'),
      'pt-PT': () => import('../../locale/languages/pt-pt.json'),
      'es-ES': () => import('../../locale/languages/es-es.json'),
      'gl-ES': () => import('../../locale/languages/gl-es.json'),
      'ru-RU': () => import('../../locale/languages/ru-ru.json'),
      'de-DE': () => import('../../locale/languages/de-de.json'),
      'he-HE': () => import('../../locale/languages/he-he.json'),
      'nl-NL': () => import('../../locale/languages/nl-nl.json'),
      'pr-PR': () => import('../../locale/languages/pr-pr.json'),
      'th-TH': () => import('../../locale/languages/th-th.json'),
      'mr-IN': () => import('../../locale/languages/mr-in.json'),
      'tr-TR': () => import('../../locale/languages/tr-tr.json'),
      'ar-SA': () => import('../../locale/languages/ar-sa.json'),
    };

    i18next.on('languageChanged', async (lng) => {
      await this.loadLocales(lng);
    });
  }

  async loadLocales(locale: string): Promise<void> {
    if (this.loadedLocales.has(locale)) {
      return;
    }

    const loader = this.LOCALE_LOADERS[locale];
    if (!loader) {
      return;
    }

    const translations = await loader();
    i18next.addResourceBundle(
      locale,
      'translation',
      translations.default,
      true
    );
    this.loadedLocales.add(locale);
  }

  getI18nInstance() {
    return i18next;
  }

  static getInstance(): LocalUtilClassBase {
    if (!LocalUtilClassBase._instance) {
      LocalUtilClassBase._instance = new LocalUtilClassBase();
    }

    return LocalUtilClassBase._instance;
  }
}

const localUtilClassBase = LocalUtilClassBase.getInstance();

export { LocalUtilClassBase };

export default localUtilClassBase;
