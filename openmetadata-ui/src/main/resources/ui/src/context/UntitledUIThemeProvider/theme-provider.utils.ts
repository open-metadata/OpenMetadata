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
import {
  BRAND_CSS_VAR_KEYWORDS,
  DARK_SCHEME_QUERY,
} from './theme-provider.constants';
import type {
  BrandColors,
  Theme,
  ThemePreference,
} from './theme-provider.interface';

export const prefersDarkScheme = () =>
  typeof globalThis.matchMedia === 'function' &&
  globalThis.matchMedia(DARK_SCHEME_QUERY).matches;

export const resolveTheme = (preference: ThemePreference): Theme => {
  if (preference === 'system') {
    return prefersDarkScheme() ? 'dark' : 'light';
  }

  return preference;
};

// Must accept the same values as the index.html boot script.
// See ADR:2026-10-09-theme-and-sidebar-preferences-are-per-device.
export const getStoredTheme = (storageKey: string): ThemePreference | null => {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return null;
    }

    const savedTheme = localStorage.getItem(
      storageKey
    ) as ThemePreference | null;

    if (
      savedTheme === 'light' ||
      savedTheme === 'dark' ||
      savedTheme === 'system'
    ) {
      return savedTheme;
    }

    localStorage.removeItem(storageKey);
  } catch {
    // Privacy restrictions can block storage access; treat that as no preference.
  }

  return null;
};

export const applyThemeToRoot = (theme: Theme, darkModeClass: string) => {
  if (typeof globalThis.document === 'undefined') {
    return;
  }

  const root = globalThis.document.documentElement;
  const shouldUseDarkMode = theme === 'dark';

  if (root.classList.contains(darkModeClass) !== shouldUseDarkMode) {
    root.classList.toggle(darkModeClass, shouldUseDarkMode);
  }
  if (root.style.colorScheme !== theme) {
    root.style.colorScheme = theme;
  }
};

/**
 * Overrides the compiled Tailwind CSS variables (--tw-* prefix) for brand colors.
 *
 * Because core-components uses `prefix(tw)` in Tailwind v4, all theme tokens are
 * compiled into static `--tw-*` CSS variables (e.g. `--tw-background-color-brand-solid`).
 * Utility classes like `tw:bg-brand-solid` reference these `--tw-*` vars at runtime,
 * so we override them directly to update the brand color system-wide.
 *
 * Mapping:
 *   primaryColor  → brand-600 (solid bg, fg-brand-primary, borders)
 *   hoverColor    → brand-100 (light bg tints)
 *   selectedColor → brand-700 (solid hover, selected state)
 *   errorColor    → error-600 (solid bg, fg-error-primary, borders)
 *   successColor  → success-600 (solid bg, fg-success-primary)
 *   warningColor  → warning-600 (solid bg, fg-warning-primary)
 *   infoColor     → blue-600 (utility-blue-600, maps to UntitledUI's blue/tertiary palette)
 */
export const applyBrandCssVars = (colors: BrandColors, root: HTMLElement) => {
  const {
    primaryColor,
    hoverColor,
    selectedColor,
    errorColor,
    successColor,
    warningColor,
    infoColor,
  } = colors;

  if (primaryColor) {
    root.style.setProperty('--tw-color-brand-600', primaryColor);
    root.style.setProperty('--tw-color-utility-brand-600', primaryColor);
    root.style.setProperty('--tw-color-utility-brand-600_alt', primaryColor);
    root.style.setProperty('--tw-color-fg-brand-primary', primaryColor);
    root.style.setProperty('--tw-color-fg-brand-primary_alt', primaryColor);
    root.style.setProperty(
      '--tw-color-fg-brand-secondary_hover',
      hoverColor ?? primaryColor
    );
    root.style.setProperty('--tw-color-bg-brand-solid', primaryColor);
    root.style.setProperty('--tw-color-border-brand_alt', primaryColor);
    root.style.setProperty('--tw-color-text-brand-tertiary', primaryColor);
    root.style.setProperty('--tw-color-text-brand-tertiary_alt', primaryColor);
    root.style.setProperty('--tw-color-icon-fg-brand', primaryColor);
    root.style.setProperty(
      '--tw-color-featured-icon-light-fg-brand',
      primaryColor
    );
    root.style.setProperty('--tw-color-slider-handle-border', primaryColor);
    root.style.setProperty('--tw-background-color-brand-solid', primaryColor);
    root.style.setProperty(
      '--tw-background-color-border-brand_alt',
      primaryColor
    );
    root.style.setProperty('--tw-text-color-brand-tertiary', primaryColor);
    root.style.setProperty('--tw-text-color-brand-tertiary_alt', primaryColor);
    root.style.setProperty('--tw-border-color-brand_alt', primaryColor);
    root.style.setProperty('--tw-border-color-brand-solid', primaryColor);
    root.style.setProperty('--tw-ring-color-brand-solid', primaryColor);
    root.style.setProperty('--tw-ring-color-brand_alt', primaryColor);
    root.style.setProperty('--tw-ring-color-bg-brand-solid', primaryColor);
    root.style.setProperty('--tw-outline-color-brand-solid', primaryColor);
    // Borders are drawn with `outline` now, so each themed ring colour needs an outline
    // counterpart or the border ignores custom branding. `bg-brand-solid` needs no entry:
    // `tw:outline-bg-brand-solid` resolves to `--tw-color-bg-brand-solid`, set above.
    root.style.setProperty('--tw-outline-color-brand_alt', primaryColor);
  }

  if (selectedColor) {
    root.style.setProperty('--tw-color-brand-700', selectedColor);
    root.style.setProperty('--tw-color-utility-brand-700', selectedColor);
    root.style.setProperty('--tw-color-utility-brand-700_alt', selectedColor);
    root.style.setProperty('--tw-color-bg-brand-solid_hover', selectedColor);
    root.style.setProperty('--tw-color-bg-brand-section_subtle', selectedColor);
    root.style.setProperty('--tw-color-fg-brand-secondary', selectedColor);
    root.style.setProperty('--tw-color-fg-brand-secondary_alt', selectedColor);
    root.style.setProperty('--tw-color-text-brand-secondary', selectedColor);
    root.style.setProperty('--tw-color-border-brand', selectedColor);
    root.style.setProperty(
      '--tw-background-color-brand-solid_hover',
      selectedColor
    );
    root.style.setProperty(
      '--tw-background-color-brand-section_subtle',
      selectedColor
    );
    root.style.setProperty('--tw-background-color-border-brand', selectedColor);
    root.style.setProperty('--tw-text-color-brand-secondary', selectedColor);
    root.style.setProperty('--tw-border-color-brand', selectedColor);
    root.style.setProperty(
      '--tw-border-color-brand-solid_hover',
      selectedColor
    );
    root.style.setProperty('--tw-ring-color-brand', selectedColor);
    root.style.setProperty('--tw-ring-color-brand-solid_hover', selectedColor);
    root.style.setProperty('--tw-outline-color-brand', selectedColor);
    root.style.setProperty(
      '--tw-outline-color-brand-solid_hover',
      selectedColor
    );
  }

  if (hoverColor) {
    root.style.setProperty('--tw-color-brand-100', hoverColor);
    root.style.setProperty('--tw-color-utility-brand-100', hoverColor);
    root.style.setProperty('--tw-color-utility-brand-100_alt', hoverColor);
    root.style.setProperty('--tw-color-bg-brand-secondary', hoverColor);
    root.style.setProperty('--tw-background-color-brand-secondary', hoverColor);
  }

  if (errorColor) {
    root.style.setProperty('--tw-color-error-600', errorColor);
    root.style.setProperty('--tw-color-utility-error-600', errorColor);
    root.style.setProperty('--tw-color-fg-error-primary', errorColor);
    root.style.setProperty('--tw-color-bg-error-solid', errorColor);
    root.style.setProperty('--tw-color-text-error-primary', errorColor);
    root.style.setProperty('--tw-background-color-error-solid', errorColor);
    root.style.setProperty('--tw-text-color-error-primary', errorColor);
    root.style.setProperty(
      '--tw-color-featured-icon-light-fg-error',
      errorColor
    );
  }

  if (successColor) {
    root.style.setProperty('--tw-color-success-600', successColor);
    root.style.setProperty('--tw-color-utility-success-600', successColor);
    root.style.setProperty('--tw-color-fg-success-primary', successColor);
    root.style.setProperty('--tw-color-bg-success-solid', successColor);
    root.style.setProperty('--tw-color-text-success-primary', successColor);
    root.style.setProperty('--tw-background-color-success-solid', successColor);
    root.style.setProperty('--tw-text-color-success-primary', successColor);
    root.style.setProperty(
      '--tw-color-featured-icon-light-fg-success',
      successColor
    );
  }

  if (warningColor) {
    root.style.setProperty('--tw-color-warning-600', warningColor);
    root.style.setProperty('--tw-color-utility-warning-600', warningColor);
    root.style.setProperty('--tw-color-fg-warning-primary', warningColor);
    root.style.setProperty('--tw-color-bg-warning-solid', warningColor);
    root.style.setProperty('--tw-color-text-warning-primary', warningColor);
    root.style.setProperty('--tw-background-color-warning-solid', warningColor);
    root.style.setProperty('--tw-text-color-warning-primary', warningColor);
    root.style.setProperty(
      '--tw-color-featured-icon-light-fg-warning',
      warningColor
    );
  }

  if (infoColor) {
    root.style.setProperty('--tw-color-blue-600', infoColor);
    root.style.setProperty('--tw-color-utility-blue-600', infoColor);
    root.style.setProperty('--tw-color-utility-blue-600_alt', infoColor);
  }
};

export const clearBrandCssVars = (root: HTMLElement) => {
  const allSet = Array.from(root.style);

  allSet
    .filter(
      (p) =>
        p.startsWith('--tw-') &&
        BRAND_CSS_VAR_KEYWORDS.some((keyword) => p.includes(keyword))
    )
    .forEach((property) => root.style.removeProperty(property));
};
