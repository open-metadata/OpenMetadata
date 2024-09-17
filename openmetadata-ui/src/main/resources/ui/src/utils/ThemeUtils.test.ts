/*
 *  Copyright 2024 Collate.
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
import { DEFAULT_THEME } from '../constants/Appearance.constants';
import { getThemeConfig } from './ThemeUtils';

describe('ThemeUtils', () => {
  it('getThemeConfig should return default theme when no custom theme is provided', () => {
    const themeConfig = getThemeConfig();

    expect(themeConfig.primaryColor).toBe(DEFAULT_THEME.primaryColor);
    expect(themeConfig.errorColor).toBe(DEFAULT_THEME.errorColor);
    expect(themeConfig.successColor).toBe(DEFAULT_THEME.successColor);
    expect(themeConfig.warningColor).toBe(DEFAULT_THEME.warningColor);
    expect(themeConfig.infoColor).toBe(DEFAULT_THEME.infoColor);
  });

  it('getThemeConfig should return custom theme when provided', () => {
    const customTheme = {
      primaryColor: '#000000',
      errorColor: '#ff0000',
      successColor: '#00ff00',
      warningColor: '#ffff00',
      infoColor: '#0000ff',
    };

    const themeConfig = getThemeConfig(customTheme);

    expect(themeConfig.primaryColor).toBe(customTheme.primaryColor);
    expect(themeConfig.errorColor).toBe(customTheme.errorColor);
    expect(themeConfig.successColor).toBe(customTheme.successColor);
    expect(themeConfig.warningColor).toBe(customTheme.warningColor);
    expect(themeConfig.infoColor).toBe(customTheme.infoColor);
  });
});
