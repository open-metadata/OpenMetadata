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

export interface LogoUrlField {
  name: LogoUrlKey;
  labelKey: string;
  placeholder: string;
  isMonogram: boolean;
  /** Optional dark-theme variant; BrandImage falls back to `name` when unset. */
  dark?: { name: LogoUrlKey; labelKey: string; placeholder: string };
}

export const LOGO_URL_FIELDS: LogoUrlField[] = [
  {
    name: 'customLogoUrlPath',
    labelKey: 'label.logo-url',
    placeholder: 'https://example.com/logo.svg',
    isMonogram: false,
    dark: {
      name: 'customLogoDarkUrlPath',
      labelKey: 'label.dark-mode-logo-url',
      placeholder: 'https://example.com/logo-dark.svg',
    },
  },
  {
    name: 'customMonogramUrlPath',
    labelKey: 'label.monogram-url',
    placeholder: 'https://example.com/monogram.svg',
    isMonogram: true,
    dark: {
      name: 'customMonogramDarkUrlPath',
      labelKey: 'label.dark-mode-monogram-url',
      placeholder: 'https://example.com/monogram-dark.svg',
    },
  },
  {
    name: 'customFaviconUrlPath',
    labelKey: 'label.favicon-url',
    placeholder: 'https://example.com/favicon.png',
    isMonogram: true,
  },
];

const LOGO_URL_KEYS = LOGO_URL_FIELDS.flatMap(({ name, dark }) =>
  dark ? [name, dark.name] : [name]
);

export const toThemeFormValues = (
  config?: Pick<UIThemePreference, 'customLogoConfig' | 'customTheme'>
): ThemeFormValues => {
  const values = {} as ThemeFormValues;
  LOGO_URL_KEYS.forEach((name) => {
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
  customLogoConfig: pickValues(LOGO_URL_KEYS, values),
  customTheme: pickValues(
    THEME_COLOR_FIELDS.map(({ name }) => name),
    values
  ),
});

export const EMPTY_THEME_CONFIG = toThemeConfig(toThemeFormValues());

export const isValidUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

// Relative luminance of the dark preview tile (~#1c1f27).
const DARK_TILE_LUMINANCE = 0.014;
const MIN_DARK_CONTRAST = 3;

const toLinear = (channel: number) => {
  const value = channel / 255;

  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

/**
 * WCAG contrast of an image's visible pixels (alpha-weighted mean luminance)
 * against the dark tile. Below 3:1 the logo is hard to see in dark mode.
 * Returns false for a fully transparent image.
 */
export const isHardToSeeOnDark = (rgba: Uint8ClampedArray) => {
  let luminance = 0;
  let weight = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3] / 255;
    luminance +=
      alpha *
      (0.2126 * toLinear(rgba[i]) +
        0.7152 * toLinear(rgba[i + 1]) +
        0.0722 * toLinear(rgba[i + 2]));
    weight += alpha;
  }
  if (weight === 0) {
    return false;
  }

  return (
    (luminance / weight + 0.05) / (DARK_TILE_LUMINANCE + 0.05) <
    MIN_DARK_CONTRAST
  );
};
