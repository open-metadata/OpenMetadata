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

import { LogoConfiguration } from '../../../../../../generated/configuration/logoConfiguration';
import { UIThemePreference } from '../../../../../../generated/configuration/uiThemePreference';

export type ThemeColorKey = keyof NonNullable<UIThemePreference['customTheme']>;
export type LogoUrlKey = keyof LogoConfiguration;
export type ThemeFormValues = Record<ThemeColorKey | LogoUrlKey, string>;

/** Order and labels match the classic Theme page. */
export const THEME_COLOR_FIELDS: { name: ThemeColorKey; labelKey: string }[] = [
  { name: 'primaryColor', labelKey: 'label.primary-color' },
  { name: 'selectedColor', labelKey: 'label.selected-color' },
  { name: 'hoverColor', labelKey: 'label.hover-color' },
  { name: 'panelBackgroundColor', labelKey: 'label.panel-background-color' },
  { name: 'errorColor', labelKey: 'label.error-color' },
  { name: 'successColor', labelKey: 'label.success-color' },
  { name: 'warningColor', labelKey: 'label.warning-color' },
  { name: 'infoColor', labelKey: 'label.info-color' },
];

export const LOGO_URL_FIELDS: {
  name: LogoUrlKey;
  labelKey: string;
  isMonogram: boolean;
}[] = [
  { name: 'customLogoUrlPath', labelKey: 'label.logo-url', isMonogram: false },
  {
    name: 'customMonogramUrlPath',
    labelKey: 'label.monogram-url',
    isMonogram: true,
  },
  {
    name: 'customFaviconUrlPath',
    labelKey: 'label.favicon-url',
    isMonogram: true,
  },
];

export const toThemeFormValues = (
  config?: Pick<UIThemePreference, 'customLogoConfig' | 'customTheme'>
): ThemeFormValues => {
  const values = {} as ThemeFormValues;
  LOGO_URL_FIELDS.forEach(({ name }) => {
    values[name] = config?.customLogoConfig?.[name] ?? '';
  });
  THEME_COLOR_FIELDS.forEach(({ name }) => {
    values[name] = config?.customTheme?.[name] ?? '';
  });

  return values;
};

const pickValues = <K extends ThemeColorKey | LogoUrlKey>(
  keys: K[],
  values: ThemeFormValues
) =>
  Object.fromEntries(keys.map((key) => [key, values[key] ?? ''])) as Record<
    K,
    string
  >;

/** Unset fields are saved as '' (not omitted), matching the classic page and its Reset. */
export const toThemeConfig = (values: ThemeFormValues) => ({
  customLogoConfig: pickValues(
    LOGO_URL_FIELDS.map(({ name }) => name),
    values
  ),
  customTheme: pickValues(
    THEME_COLOR_FIELDS.map(({ name }) => name),
    values
  ),
});

export const EMPTY_THEME_CONFIG = toThemeConfig(toThemeFormValues());

export const isValidUrl = (value: string) => {
  try {
    new URL(value);

    return true;
  } catch {
    return false;
  }
};
