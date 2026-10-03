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

const LANGUAGES_DIR = join(__dirname, '../../../../locale/languages');

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

// The locale files are synced by a tool that only knows the older plural
// format: these read the counts through i18next itself, so a form the sync
// dropped, or a count that picks the wrong form, fails here.
describe('incident group plural counts', () => {
  it('should pick the Russian one, few and many forms', async () => {
    const t = await translatorFor('ru-RU');

    expect(t('label.group-count', { count: 1 })).toBe('<0>1</0> группа');
    expect(t('label.group-count', { count: 3 })).toBe('<0>3</0> группы');
    expect(t('label.group-count', { count: 5 })).toBe('<0>5</0> групп');
    expect(t('label.group-count', { count: 0 })).toBe('<0>0</0> групп');
    expect(t('label.table-count', { count: 22 })).toBe('22 таблицы');
  });

  it('should pick the Arabic dual form', async () => {
    const t = await translatorFor('ar-SA');

    expect(t('label.type-count', { count: 2 })).toBe('2 نوعان');
  });

  it('should read zero in the singular in French', async () => {
    const t = await translatorFor('fr-FR');

    expect(t('label.recurring-count', { count: 0 })).toBe('<0>0</0> récurrent');
    expect(t('label.table-count', { count: 2 })).toBe('2 tableaux');
  });

  it('should read English one and other', async () => {
    const t = await translatorFor('en-US');

    expect(t('label.group-count', { count: 1 })).toBe('<0>1</0> group');
    expect(t('label.group-count', { count: 0 })).toBe('<0>0</0> groups');
  });
});
