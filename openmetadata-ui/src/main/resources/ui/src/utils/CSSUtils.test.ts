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

import { clearCSSVarCache, getCSSVar } from './CSSUtils';

const mockGetPropertyValue = jest.fn();

beforeEach(() => {
  clearCSSVarCache();
  mockGetPropertyValue.mockReset();
  jest.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: mockGetPropertyValue,
  } as unknown as CSSStyleDeclaration);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getCSSVar', () => {
  it('returns trimmed value from computed style', () => {
    mockGetPropertyValue.mockReturnValue('  #ff0000  ');

    expect(getCSSVar('--color-primary')).toBe('#ff0000');
  });

  it('returns empty string when variable is not set', () => {
    mockGetPropertyValue.mockReturnValue('');

    expect(getCSSVar('--non-existent')).toBe('');
  });

  it('caches the value and only calls getComputedStyle once per variable', () => {
    mockGetPropertyValue.mockReturnValue('blue');

    getCSSVar('--color-brand');
    getCSSVar('--color-brand');
    getCSSVar('--color-brand');

    expect(window.getComputedStyle).toHaveBeenCalledTimes(1);
    expect(mockGetPropertyValue).toHaveBeenCalledTimes(1);
  });

  it('caches independently per variable name', () => {
    mockGetPropertyValue
      .mockReturnValueOnce('red')
      .mockReturnValueOnce('blue');

    expect(getCSSVar('--color-a')).toBe('red');
    expect(getCSSVar('--color-b')).toBe('blue');
    expect(window.getComputedStyle).toHaveBeenCalledTimes(2);
  });

  it('returns cached value without re-querying the DOM after first call', () => {
    mockGetPropertyValue.mockReturnValueOnce('green');

    const first = getCSSVar('--color-cached');

    mockGetPropertyValue.mockReturnValueOnce('changed');
    const second = getCSSVar('--color-cached');

    expect(first).toBe('green');
    expect(second).toBe('green');
    expect(window.getComputedStyle).toHaveBeenCalledTimes(1);
  });
});

describe('clearCSSVarCache', () => {
  it('forces re-read from DOM after cache is cleared', () => {
    mockGetPropertyValue
      .mockReturnValueOnce('initial')
      .mockReturnValueOnce('updated');

    expect(getCSSVar('--color-x')).toBe('initial');

    clearCSSVarCache();

    expect(getCSSVar('--color-x')).toBe('updated');
    expect(window.getComputedStyle).toHaveBeenCalledTimes(2);
  });
});
