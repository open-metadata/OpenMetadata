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
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface BrandColors {
  primaryColor?: string;
  hoverColor?: string;
  selectedColor?: string;
  errorColor?: string;
  successColor?: string;
  warningColor?: string;
  infoColor?: string;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
  brandColors?: BrandColors;
  /**
   * The class to add to the root element when the theme is dark
   * @default "dark-mode"
   */
  darkModeClass?: string;
  /**
   * The default theme to use if no theme is stored in localStorage
   * @default "system"
   */
  defaultTheme?: Theme;
  /**
   * The key to use to store the theme in localStorage
   * @default "ui-theme"
   */
  storageKey?: string;
}

/**
 * Overrides the compiled Tailwind CSS variables (--tw-* prefix) for brand colors.
 *
 * Because core-components uses `prefix(tw)` in Tailwind v4, all theme tokens are
 * compiled into static `--tw-*` CSS variables (e.g. `--tw-background-color-brand-solid`).
 * Utility classes like `tw:bg-brand-solid` reference these `--tw-*` vars at runtime,
 * so we override them directly to update the brand color system-wide.
 *
 * Mapping (matches what generateAllMuiPalettes uses for consistency):
 *   primaryColor  → brand-600 (solid bg, fg-brand-primary, borders)
 *   hoverColor    → brand-100 (light bg tints)
 *   selectedColor → brand-700 (solid hover, selected state)
 *   errorColor    → error-600 (solid bg, fg-error-primary, borders)
 *   successColor  → success-600 (solid bg, fg-success-primary)
 *   warningColor  → warning-600 (solid bg, fg-warning-primary)
 *   infoColor     → blue-600 (utility-blue-600, maps to UntitledUI's blue/tertiary palette)
 */
const applyBrandCssVars = (colors: BrandColors, root: HTMLElement) => {
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
    root.style.setProperty('--tw-color-fg-brand-secondary_hover', primaryColor);
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
    root.style.setProperty('--tw-color-text-secondary_on-brand', hoverColor);
    root.style.setProperty('--tw-color-text-tertiary_on-brand', hoverColor);
    root.style.setProperty('--tw-color-icon-fg-brand_on-brand', hoverColor);
    root.style.setProperty('--tw-text-color-secondary_on-brand', hoverColor);
    root.style.setProperty('--tw-text-color-tertiary_on-brand', hoverColor);
    root.style.setProperty('--tw-text-color-brand-secondary_hover', hoverColor);
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

const clearBrandCssVars = (root: HTMLElement) => {
  const allSet = Array.from(root.style);
  allSet
    .filter(
      (p) =>
        p.startsWith('--tw-') &&
        (p.includes('brand') ||
          p.includes('error') ||
          p.includes('success') ||
          p.includes('warning') ||
          p.includes('info') ||
          p.includes('blue'))
    )
    .forEach((p) => root.style.removeProperty(p));
};

export const ThemeProvider = ({
  children,
  brandColors,
  defaultTheme = 'system',
  storageKey = 'ui-theme',
  darkModeClass = 'dark-mode',
}: ThemeProviderProps) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(storageKey) as Theme | null;

      return savedTheme || defaultTheme;
    }

    return defaultTheme;
  });

  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;

      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
          .matches
          ? 'dark'
          : 'light';

        root.classList.toggle(darkModeClass, systemTheme === 'dark');
        localStorage.removeItem(storageKey);
      } else {
        root.classList.toggle(darkModeClass, theme === 'dark');
        localStorage.setItem(storageKey, theme);
      }
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;

    clearBrandCssVars(root);
    if (brandColors && Object.values(brandColors).some(Boolean)) {
      applyBrandCssVars(brandColors, root);
    }
  }, [
    brandColors?.primaryColor,
    brandColors?.hoverColor,
    brandColors?.selectedColor,
    brandColors?.errorColor,
    brandColors?.successColor,
    brandColors?.warningColor,
    brandColors?.infoColor,
  ]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
