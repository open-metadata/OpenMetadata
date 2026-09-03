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

import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  ThemeProvider,
  useTheme,
} from '../context/UntitledUIThemeProvider/theme-provider';
import { BrandColors } from '../context/UntitledUIThemeProvider/theme-provider.interface';
import { useChartColors } from './useChartColors';

const TEST_THEME_STORAGE_KEY = 'shared-chart-colors-test';
let activeBrandColors: BrandColors | undefined;
let setActiveTheme: ReturnType<typeof useTheme>['setTheme'];

const ThemeController = ({ children }: { children: ReactNode }) => {
  const { setTheme } = useTheme();
  setActiveTheme = setTheme;

  return <>{children}</>;
};

const TestThemeProvider = ({ children }: { children: ReactNode }) => (
  <ThemeProvider
    brandColors={activeBrandColors}
    defaultTheme="light"
    storageKey={TEST_THEME_STORAGE_KEY}>
    <ThemeController>{children}</ThemeController>
  </ThemeProvider>
);

describe('useChartColors', () => {
  beforeEach(() => {
    activeBrandColors = undefined;
  });

  afterEach(() => {
    localStorage.removeItem(TEST_THEME_STORAGE_KEY);
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
  });

  it('refreshes common chart surfaces when the active theme changes', () => {
    document.documentElement.style.setProperty(
      '--om-color-border-secondary',
      '#112233'
    );
    document.documentElement.style.setProperty(
      '--om-color-text-tertiary',
      '#223344'
    );
    document.documentElement.style.setProperty(
      '--om-color-bg-tertiary',
      '#334455'
    );

    const { result } = renderHook(() => useChartColors(), {
      wrapper: TestThemeProvider,
    });

    expect(result.current.grid).toBe('#112233');
    expect(result.current.axis).toBe('#223344');
    expect(result.current.cursorFill).toBe('#334455');

    act(() => {
      document.documentElement.style.setProperty(
        '--om-color-border-secondary',
        '#aabbcc'
      );
      document.documentElement.style.setProperty(
        '--om-color-text-tertiary',
        '#bbccdd'
      );
      document.documentElement.style.setProperty(
        '--om-color-bg-tertiary',
        '#ccddee'
      );
      setActiveTheme('dark');
    });

    expect(result.current.grid).toBe('#aabbcc');
    expect(result.current.axis).toBe('#bbccdd');
    expect(result.current.cursorFill).toBe('#ccddee');
  });

  it('resolves chart accents and empty states from registered tokens', () => {
    document.documentElement.style.setProperty(
      '--om-color-bg-primary',
      '#123456'
    );
    document.documentElement.style.setProperty(
      '--om-color-bg-quaternary',
      '#234567'
    );
    document.documentElement.style.setProperty(
      '--om-color-fg-brand',
      '#345678'
    );
    document.documentElement.style.setProperty(
      '--om-color-bg-brand',
      '#456789'
    );

    const { result } = renderHook(() => useChartColors(), {
      wrapper: TestThemeProvider,
    });

    expect(result.current.activeDotBorder).toBe('#123456');
    expect(result.current.emptyFill).toBe('#234567');
    expect(result.current.primary).toBe('#345678');
    expect(result.current.primaryArea).toBe('#456789');
  });

  it('refreshes common chart colors when brand colors change', () => {
    document.documentElement.style.setProperty(
      '--om-color-fg-brand',
      '#112233'
    );

    const { rerender, result } = renderHook(() => useChartColors(), {
      wrapper: TestThemeProvider,
    });

    expect(result.current.primary).toBe('#112233');

    act(() => {
      document.documentElement.style.setProperty(
        '--om-color-fg-brand',
        '#aabbcc'
      );
      activeBrandColors = { primaryColor: '#123456' };
      rerender();
    });

    expect(result.current.primary).toBe('#aabbcc');
  });
});
