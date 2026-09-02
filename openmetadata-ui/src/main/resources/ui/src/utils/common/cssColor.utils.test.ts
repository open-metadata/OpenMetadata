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

import { resolveCssColor } from './cssColor.utils';

const mockComputedStyle = (
  color: string,
  backgroundColor = color
): CSSStyleDeclaration =>
  ({
    backgroundColor,
    color,
    getPropertyValue: () => '',
  } as unknown as CSSStyleDeclaration);

describe('resolveCssColor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
  });

  it('returns the fallback when the document is unavailable', () => {
    jest
      .spyOn(globalThis, 'document', 'get')
      .mockReturnValue(undefined as unknown as Document);

    expect(resolveCssColor('var(--color-missing)', '#abcdef')).toBe('#abcdef');
  });

  it('returns concrete colors without touching the DOM', () => {
    const spy = jest.spyOn(window, 'getComputedStyle');

    expect(resolveCssColor('#123456', '#000000')).toBe('#123456');
    expect(resolveCssColor('rgb(1, 2, 3)', '#000000')).toBe('rgb(1, 2, 3)');
    expect(spy).not.toHaveBeenCalled();
  });

  it('caches a resolved token while the root visual state is unchanged', () => {
    const spy = jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValueOnce(mockComputedStyle('rgb(1, 2, 3)'))
      .mockReturnValue(mockComputedStyle('rgb(9, 9, 9)'));

    expect(resolveCssColor('var(--color-cache-probe)', '#000000')).toBe(
      'rgb(1, 2, 3)'
    );
    expect(resolveCssColor('var(--color-cache-probe)', '#000000')).toBe(
      'rgb(1, 2, 3)'
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('re-resolves a token after the root theme class changes', () => {
    const spy = jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValueOnce(mockComputedStyle('rgb(250, 250, 250)'))
      .mockReturnValueOnce(mockComputedStyle('rgb(24, 24, 27)'));

    expect(resolveCssColor('var(--color-theme-probe)', '#000000')).toBe(
      'rgb(250, 250, 250)'
    );

    document.documentElement.classList.add('dark-mode');

    expect(resolveCssColor('var(--color-theme-probe)', '#000000')).toBe(
      'rgb(24, 24, 27)'
    );
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('re-resolves a token after inline brand variables change', () => {
    const spy = jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValueOnce(mockComputedStyle('rgb(21, 112, 239)'))
      .mockReturnValueOnce(mockComputedStyle('rgb(127, 86, 217)'));

    expect(resolveCssColor('var(--color-brand-probe)', '#000000')).toBe(
      'rgb(21, 112, 239)'
    );

    document.documentElement.style.setProperty('--color-brand-500', '#7f56d9');

    expect(resolveCssColor('var(--color-brand-probe)', '#000000')).toBe(
      'rgb(127, 86, 217)'
    );
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('evicts the least recently used color when the cache reaches its limit', () => {
    let resolvedColor = 'rgb(1, 2, 3)';
    const spy = jest
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(() => mockComputedStyle(resolvedColor));

    expect(resolveCssColor('var(--color-lru-0)', '#000000')).toBe(
      'rgb(1, 2, 3)'
    );

    for (let index = 1; index <= 200; index++) {
      resolveCssColor(`var(--color-lru-${index})`, '#000000');
    }

    resolvedColor = 'rgb(9, 9, 9)';

    expect(resolveCssColor('var(--color-lru-0)', '#000000')).toBe(
      'rgb(9, 9, 9)'
    );
    expect(spy).toHaveBeenCalledTimes(202);
  });

  it('returns the fallback for transparent or non-color values', () => {
    jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue(mockComputedStyle('rgba(0, 0, 0, 0)'));

    expect(resolveCssColor('var(--color-unresolvable)', '#fedcba')).toBe(
      '#fedcba'
    );
  });

  it('does not treat an inherited text color as a resolved token', () => {
    jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValueOnce(
        mockComputedStyle('rgb(17, 24, 39)', 'rgba(0, 0, 0, 0)')
      )
      .mockReturnValueOnce(mockComputedStyle(''));

    expect(resolveCssColor('var(--color-invalid)', '#fedcba')).toBe('#fedcba');
  });
});
