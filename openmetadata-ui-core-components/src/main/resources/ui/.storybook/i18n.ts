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

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { CORE_NS, initCoreI18n } from '../src/locale';

void i18n.use(initReactI18next).init({
  fallbackLng: 'en-US',
  lng: 'en-US',
  ns: [CORE_NS],
  defaultNS: CORE_NS,
  interpolation: { escapeValue: false },
});

// `initCoreI18n` eagerly registers every supported language, so no
// `languageChanged` lazy-load handler is needed here.
initCoreI18n(i18n);

// `label.brand-name` is owned by the host app's namespace, not the library's, so
// it isn't in the core bundles. Stand in the product default here (falling back
// to en-US covers every locale) so `DocumentTitle` renders "… | OpenMetadata"
// in Storybook.
i18n.addResourceBundle(
  'en-US',
  CORE_NS,
  { label: { 'brand-name': 'OpenMetadata' } },
  /* deep */ true,
  /* overwrite */ true
);

export default i18n;
