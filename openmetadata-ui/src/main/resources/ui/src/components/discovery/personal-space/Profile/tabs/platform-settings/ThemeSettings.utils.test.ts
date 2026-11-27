/*
 *  Copyright 2023 Collate.
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

import {
  EMPTY_THEME_CONFIG,
  isHardToSeeOnDark,
  isValidUrl,
  toThemeConfig,
  toThemeFormValues,
} from './ThemeSettings.utils';

describe('ThemeSettings.utils', () => {
  it('round-trips a stored theme through the form values', () => {
    const stored = {
      customLogoConfig: {
        customLogoUrlPath: 'https://cdn.example.com/logo.svg',
        customLogoDarkUrlPath: 'https://cdn.example.com/logo-dark.svg',
        customMonogramUrlPath: '',
        customMonogramDarkUrlPath: '',
        customFaviconUrlPath: '',
      },
      customTheme: {
        primaryColor: '#1570ef',
        hoverColor: '#d1e9ff',
        selectedColor: '#175cd3',
        errorColor: '',
        successColor: '',
        warningColor: '',
        infoColor: '',
        panelBackgroundColor: '',
      },
    };

    expect(toThemeConfig(toThemeFormValues(stored))).toEqual(stored);
  });

  it('saves unset values as empty strings, which is also what Reset sends', () => {
    expect(EMPTY_THEME_CONFIG.customTheme.primaryColor).toBe('');
    expect(EMPTY_THEME_CONFIG.customLogoConfig.customLogoUrlPath).toBe('');
    expect(EMPTY_THEME_CONFIG.customLogoConfig.customLogoDarkUrlPath).toBe('');
    expect(EMPTY_THEME_CONFIG.customLogoConfig.customMonogramDarkUrlPath).toBe(
      ''
    );
    expect(Object.keys(EMPTY_THEME_CONFIG.customTheme)).toHaveLength(8);
  });

  it('accepts absolute URLs only', () => {
    expect(isValidUrl('https://cdn.example.com/logo.svg')).toBe(true);
    expect(isValidUrl('logo.svg')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
  });

  describe('isHardToSeeOnDark', () => {
    const pixels = (...rgba: number[][]) => new Uint8ClampedArray(rgba.flat());

    it('flags dark logos and passes light ones', () => {
      expect(isHardToSeeOnDark(pixels([17, 24, 39, 255]))).toBe(true);
      expect(isHardToSeeOnDark(pixels([255, 255, 255, 255]))).toBe(false);
      expect(isHardToSeeOnDark(pixels([247, 144, 9, 255]))).toBe(false);
    });

    it('ignores transparent pixels', () => {
      expect(
        isHardToSeeOnDark(pixels([0, 0, 0, 0], [255, 255, 255, 255]))
      ).toBe(false);
      expect(isHardToSeeOnDark(pixels([0, 0, 0, 0]))).toBe(false);
    });
  });
});
