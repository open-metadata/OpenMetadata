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
import { createInstance } from 'i18next';
import { useTranslation } from 'react-i18next';
import enUS from '../../locale/languages/en-us.json';

export const MISSING_TRANSLATION_MARKER = '[[missing translation:';

const i18n = createInstance();
void i18n.init({
  fallbackLng: false,
  initImmediate: false,
  interpolation: { escapeValue: false },
  lng: 'en-US',
  parseMissingKeyHandler: (key) => MISSING_TRANSLATION_MARKER + key + ']]',
  resources: { 'en-US': { translation: enUS } },
});

/**
 * Makes `useTranslation` resolve against the shipped en-us.json instead of
 * echoing keys, so a test can see text a user reads and spot keys the locale
 * does not define.
 */
export const useEnUsTranslations = () =>
  (useTranslation as jest.Mock).mockReturnValue({
    i18n: { language: 'en-US', dir: () => 'ltr' },
    t: i18n.t.bind(i18n),
  });

export const useKeyEchoTranslations = () =>
  (useTranslation as jest.Mock).mockReturnValue({
    i18n: { language: 'en-US', dir: () => 'ltr' },
    t: (key: string) => key,
  });
