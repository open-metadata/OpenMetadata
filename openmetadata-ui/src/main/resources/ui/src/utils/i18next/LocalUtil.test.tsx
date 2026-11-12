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
import i18n from './LocalUtil';
import { SupportedLocales } from './LocalUtil.interface';

jest.unmock('./LocalUtil');
jest.unmock('react-i18next');

const waitForInit = () =>
  new Promise<void>((resolve) => {
    if (i18n.isInitialized) {
      resolve();

      return;
    }
    i18n.on('initialized', () => resolve());
  });

describe('LocalUtil', () => {
  beforeAll(waitForInit);

  afterEach(async () => {
    await i18n.changeLanguage(SupportedLocales.English);
  });

  it('applies the selected language and direction to the document root', async () => {
    await i18n.changeLanguage(SupportedLocales.العربية);

    expect(document.documentElement).toHaveAttribute('lang', 'ar-SA');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');

    await i18n.changeLanguage(SupportedLocales.English);

    expect(document.documentElement).toHaveAttribute('lang', 'en-US');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });
});
