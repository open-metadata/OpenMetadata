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
import { afterEach, describe, expect, it } from 'vitest';
import { DARK_CHART_PALETTE, LIGHT_CHART_PALETTE } from './palette';
import { useChartPalette } from './use-chart-palette';

afterEach(() => {
  document.documentElement.classList.remove('dark-mode');
});

describe('useChartPalette', () => {
  it('returns the light palette by default', () => {
    const { result } = renderHook(() => useChartPalette());

    expect(result.current).toBe(LIGHT_CHART_PALETTE);
  });

  it('follows the dark-mode class on <html>', async () => {
    const { result } = renderHook(() => useChartPalette());

    await act(async () => {
      document.documentElement.classList.add('dark-mode');
    });

    expect(result.current).toBe(DARK_CHART_PALETTE);
  });
});
