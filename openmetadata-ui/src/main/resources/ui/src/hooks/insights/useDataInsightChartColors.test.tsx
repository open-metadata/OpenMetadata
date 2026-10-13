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
} from '../../context/UntitledUIThemeProvider/theme-provider';
import { BrandColors } from '../../context/UntitledUIThemeProvider/theme-provider.interface';
import { useDataInsightChartColors } from './useDataInsightChartColors';

const TEST_THEME_STORAGE_KEY = 'data-insight-chart-colors-test';
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

describe('useDataInsightChartColors', () => {
  beforeEach(() => {
    activeBrandColors = undefined;
  });

  afterEach(() => {
    localStorage.removeItem(TEST_THEME_STORAGE_KEY);
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
  });

  it('resolves the progress color again when the active theme changes', () => {
    document.documentElement.style.setProperty(
      '--om-color-brand-200',
      '#112233'
    );

    const { result } = renderHook(() => useDataInsightChartColors(), {
      wrapper: TestThemeProvider,
    });

    expect(result.current).toEqual({ progress: '#112233' });

    act(() => {
      document.documentElement.style.setProperty(
        '--om-color-brand-200',
        '#aabbcc'
      );
      setActiveTheme('dark');
    });

    expect(result.current.progress).toBe('#aabbcc');
  });

  it('resolves chart colors again when brand colors change', () => {
    document.documentElement.style.setProperty(
      '--om-color-brand-200',
      '#112233'
    );

    const { rerender, result } = renderHook(() => useDataInsightChartColors(), {
      wrapper: TestThemeProvider,
    });

    expect(result.current.progress).toBe('#112233');

    act(() => {
      document.documentElement.style.setProperty(
        '--om-color-brand-200',
        '#aabbcc'
      );
      activeBrandColors = { primaryColor: '#123456' };
      rerender();
    });

    expect(result.current.progress).toBe('#aabbcc');
  });
});
