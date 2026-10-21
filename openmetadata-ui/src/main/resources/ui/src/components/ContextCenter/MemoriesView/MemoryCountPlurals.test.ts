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
import { readFileSync } from 'fs';
import i18next from 'i18next';
import { join } from 'path';

const LANGUAGES_DIR = join(__dirname, '../../../locale/languages');

const translatorFor = async (locale: string) => {
  const instance = i18next.createInstance();
  await instance.init({
    lng: locale,
    resources: {
      [locale]: {
        translation: JSON.parse(
          readFileSync(
            join(LANGUAGES_DIR, `${locale.toLowerCase()}.json`),
            'utf8'
          )
        ),
      },
    },
  });

  return instance.t;
};

// The memory counts keep the plural on the base key, which Russian reads for
// "many"; these read them through i18next so 2-4 must find their own form.
describe('memory count plurals', () => {
  it('should pick the Russian one, few and many forms', async () => {
    const t = await translatorFor('ru-RU');

    expect(t('label.cited-n-times', { count: 1 })).toBe('Упоминается 1 раз');
    expect(t('label.cited-n-times', { count: 3 })).toBe('Упоминается 3 раза');
    expect(t('label.cited-n-times', { count: 5 })).toBe('Упоминается 5 раз');
    expect(t('label.cited-n-times', { count: 22 })).toBe('Упоминается 22 раза');
    expect(t('label.corrected-n-times', { count: 2 })).toBe(
      'Исправлено 2 раза'
    );
    expect(t('label.n-times', { count: 4 })).toBe('4 раза');
    expect(t('label.n-times', { count: 12 })).toBe('12 раз');
  });

  it('should read English one and other', async () => {
    const t = await translatorFor('en-US');

    expect(t('label.cited-n-times', { count: 1 })).toBe('Cited 1 time');
    expect(t('label.cited-n-times', { count: 3 })).toBe('Cited 3 times');
    expect(t('label.n-times', { count: 2 })).toBe('2 times');
  });
});
