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
import enUS from '../../locale/languages/en-us.json';
import frFR from '../../locale/languages/fr-fr.json';

// Returns i18next options
export const getInitOptions = (): InitOptions => {
  return {
    supportedLngs: ['en-US', 'fr-FR'],
    resources: {
      'en-US': { translation: enUS },
      'fr-FR': { translation: frFR },
    },
    fallbackLng: ['en-US'],
    interpolation: {
      escapeValue: false, // XSS safety provided by React
    },
    missingKeyHandler: (_lngs, _ns, key) =>
      // eslint-disable-next-line no-console
      console.error(`i18next: key not found "${key}"`),
    saveMissing: true, // Required for missing key handler
  };
};
