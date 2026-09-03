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

  it('resolves chart colors again when the active theme changes', () => {
    document.documentElement.style.setProperty(
      '--om-color-border-secondary',
      '#112233'
    );
    document.documentElement.style.setProperty(
      '--om-color-text-tertiary',
      '#223344'
    );

    const { result } = renderHook(() => useDataInsightChartColors(), {
      wrapper: TestThemeProvider,
    });

    expect(result.current.grid).toBe('#112233');
    expect(result.current.axis).toBe('#223344');

    act(() => {
      document.documentElement.style.setProperty(
        '--om-color-border-secondary',
        '#aabbcc'
      );
      document.documentElement.style.setProperty(
        '--om-color-text-tertiary',
        '#bbccdd'
      );
      setActiveTheme('dark');
    });

    expect(result.current.grid).toBe('#aabbcc');
    expect(result.current.axis).toBe('#bbccdd');
  });

  it('resolves semantic surfaces and categorical palettes for chart consumers', () => {
    document.documentElement.style.setProperty(
      '--om-color-bg-primary',
      '#123456'
    );
    document.documentElement.style.setProperty(
      '--om-color-text-disabled',
      '#234567'
    );
    document.documentElement.style.setProperty(
      '--om-color-brand-200',
      '#345678'
    );
    document.documentElement.style.setProperty(
      '--om-color-warning-400',
      '#456789'
    );
    document.documentElement.style.setProperty(
      '--om-color-purple-50',
      '#56789a'
    );
    document.documentElement.style.setProperty(
      '--om-color-violet-500',
      '#6789ab'
    );

    const { result } = renderHook(() => useDataInsightChartColors(), {
      wrapper: TestThemeProvider,
    });

    expect(result.current.activeDotBorder).toBe('#123456');
    expect(result.current.inactive).toBe('#234567');
    expect(result.current.progress).toBe('#345678');
    expect(result.current.dataInsightSeries[0]).toBe('#456789');
    expect(result.current.kpiBackgrounds[0]).toBe('#56789a');
    expect(result.current.kpiSeries[0]).toBe('#6789ab');
  });

  it('resolves chart colors again when brand colors change', () => {
    document.documentElement.style.setProperty(
      '--om-color-text-tertiary',
      '#112233'
    );

    const { rerender, result } = renderHook(() => useDataInsightChartColors(), {
      wrapper: TestThemeProvider,
    });

    expect(result.current.axis).toBe('#112233');

    act(() => {
      document.documentElement.style.setProperty(
        '--om-color-text-tertiary',
        '#aabbcc'
      );
      activeBrandColors = { primaryColor: '#123456' };
      rerender();
    });

    expect(result.current.axis).toBe('#aabbcc');
  });
});
