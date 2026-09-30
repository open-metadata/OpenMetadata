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
import { afterEach, describe, expect, it } from 'vitest';
import { resolveCssVarColors } from './css-vars';

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('resolveCssVarColors', () => {
  it('replaces var() strings with the computed value, deeply', () => {
    document.documentElement.style.setProperty('--ok', '#17b26a');
    const formatter = () => 'x';
    const option = {
      series: [
        {
          data: [{ itemStyle: { color: 'var(--ok)' } }],
          label: { formatter },
        },
      ],
      color: ['var(--ok)', '#000000'],
    };

    expect(resolveCssVarColors(option, document.documentElement)).toEqual({
      series: [
        {
          data: [{ itemStyle: { color: '#17b26a' } }],
          label: { formatter },
        },
      ],
      color: ['#17b26a', '#000000'],
    });
  });

  it('uses the fallback when the variable is not set', () => {
    expect(
      resolveCssVarColors({ c: 'var(--missing, #ffffff)' }, document.body)
    ).toEqual({ c: '#ffffff' });
  });

  it('keeps the string when the variable is unset and has no fallback', () => {
    expect(resolveCssVarColors({ c: 'var(--missing)' }, document.body)).toEqual(
      { c: 'var(--missing)' }
    );
  });

  it('reads variables scoped to the element', () => {
    const scoped = document.createElement('div');
    scoped.style.setProperty('--ok', '#000001');
    document.body.appendChild(scoped);

    expect(resolveCssVarColors({ c: 'var(--ok)' }, scoped)).toEqual({
      c: '#000001',
    });
    scoped.remove();
  });

  it('returns the same object when nothing needs resolving', () => {
    const option = { series: [{ color: '#123456' }] };

    expect(resolveCssVarColors(option, document.body)).toBe(option);
  });
});
