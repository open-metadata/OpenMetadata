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
import { InternalAxiosRequestConfig } from 'axios';
import i18next from 'i18next';
import { LANGUAGE_HEADER, withLanguageHeader } from './withLanguageHeader';

jest.mock('i18next', () => ({
  __esModule: true,
  default: { language: '', resolvedLanguage: '' },
}));

describe('withLanguageHeader', () => {
  const mockI18next = i18next as unknown as {
    language: string;
    resolvedLanguage: string;
  };

  beforeEach(() => {
    mockI18next.language = '';
    mockI18next.resolvedLanguage = '';
  });

  const createMockConfig = (): InternalAxiosRequestConfig =>
    ({ headers: {} } as InternalAxiosRequestConfig);

  it('sets the language header to the active UI language', () => {
    // resolvedLanguage may sit at the fallback while language holds the real selection — the header
    // must use language.
    mockI18next.resolvedLanguage = 'en-US';
    mockI18next.language = 'fr-FR';
    const config = createMockConfig();

    const result = withLanguageHeader(config);

    expect(result).toBe(config);
    expect(result.headers[LANGUAGE_HEADER]).toBe('fr-FR');
  });

  it('leaves the config unchanged when no language is set', () => {
    const config = createMockConfig();

    const result = withLanguageHeader(config);

    expect(result).toBe(config);
    expect(result.headers[LANGUAGE_HEADER]).toBeUndefined();
  });
});
