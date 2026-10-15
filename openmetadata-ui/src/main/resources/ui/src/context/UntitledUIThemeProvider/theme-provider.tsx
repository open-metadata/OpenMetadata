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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useIsAiMode } from '../../hooks/useAppMode';
import { DARK_SCHEME_QUERY, DEFAULT_THEME } from './theme-provider.constants';
import {
  BrandColors,
  Theme,
  ThemeContextType,
  ThemePreference,
} from './theme-provider.interface';
import {
  applyBrandCssVars,
  applyThemeToRoot,
  clearBrandCssVars,
  getStoredTheme,
  resolveTheme,
} from './theme-provider.utils';

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
   * The class to add to the root element when the theme is dark.
   * @default "dark-mode"
   */
  darkModeClass?: string;
  /**
   * The key to use to store the theme in localStorage.
   * @default "ui-theme"
   */
  storageKey?: string;
}

export const ThemeProvider = ({
  children,
  brandColors,
  storageKey = 'ui-theme',
  darkModeClass = 'dark-mode',
}: ThemeProviderProps) => {
  const {
    primaryColor,
    hoverColor,
    selectedColor,
    errorColor,
    successColor,
    warningColor,
    infoColor,
  } = brandColors ?? {};
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    () => getStoredTheme(storageKey) ?? DEFAULT_THEME
  );
  const [resolvedTheme, setThemeState] = useState<Theme>(() =>
    resolveTheme(themePreference)
  );
  // Classic mode is light-only. The stored preference is left untouched so AI
  // mode still honours it.
  const theme: Theme = useIsAiMode() ? resolvedTheme : 'light';

  // This render-phase write is deliberate: canvas consumers resolve CSS tokens
  // before effects run, and applyThemeToRoot skips DOM writes when already synced.
  applyThemeToRoot(theme, darkModeClass);

  const setTheme = useCallback(
    (nextPreference: ThemePreference) => {
      try {
        if (globalThis.localStorage !== undefined) {
          localStorage.setItem(storageKey, nextPreference);
        }
      } catch {
        // Persistence failure must not block theme changes for the current session.
      }
      setThemePreference(nextPreference);
      setThemeState(resolveTheme(nextPreference));
    },
    [storageKey]
  );

  // Following the system: re-theme live when the OS colour scheme changes.
  useEffect(() => {
    if (
      themePreference !== 'system' ||
      typeof globalThis.matchMedia !== 'function'
    ) {
      return undefined;
    }
    const query = globalThis.matchMedia(DARK_SCHEME_QUERY);
    const onChange = () => setThemeState(resolveTheme('system'));
    query.addEventListener?.('change', onChange);

    return () => query.removeEventListener?.('change', onChange);
  }, [themePreference]);

  useEffect(() => {
    const root = globalThis.document.documentElement;
    const isDark = theme === 'dark';
    // selected (brand-700) and hover (brand-100) are light-palette shades. Written
    // inline they beat the .dark-mode remaps, leaving light tints and dark text in
    // dark mode. ponytail: dark keeps the core dark palette for these; derive
    // dark shades from the brand colours if custom dark branding is needed.
    const activeBrandColors = {
      primaryColor,
      hoverColor: isDark ? undefined : hoverColor,
      selectedColor: isDark ? undefined : selectedColor,
      errorColor,
      successColor,
      warningColor,
      infoColor,
    };

    clearBrandCssVars(root);
    if (Object.values(activeBrandColors).some(Boolean)) {
      applyBrandCssVars(activeBrandColors, root);
    }
  }, [
    primaryColor,
    hoverColor,
    selectedColor,
    errorColor,
    successColor,
    warningColor,
    infoColor,
    theme,
  ]);

  const values = useMemo(
    () => ({ theme, themePreference, brandColors, setTheme }),
    [theme, themePreference, brandColors, setTheme]
  );

  return (
    <ThemeContext.Provider value={values}>{children}</ThemeContext.Provider>
  );
};
