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

/**
 * Jest stand-in for `@openmetadata/ui-core-components/charts`. The real entry
 * loads the ESM `echarts/core`, which jest cannot run, and app tests assert on
 * the props they pass rather than on echarts output. Read them from
 * `(PieChart as unknown as jest.Mock<null, [PieChartProps]>).mock.calls`.
 *
 * Only what app code imports is mocked; add exports here as migrations need them.
 */
interface MockChartProps {
  'data-testid'?: string;
  centerLabel?: ReactNode;
  children?: ReactNode;
}

const mockChart = (fallbackTestId: string) =>
  jest.fn(
    ({ 'data-testid': dataTestId, centerLabel, children }: MockChartProps) => (
      <div data-testid={dataTestId ?? fallbackTestId}>
        {centerLabel}
        {children}
      </div>
    )
  );

// Stand-in palette: distinct, recognisable values tests can assert against.
export const LIGHT_CHART_PALETTE = {
  series: ['#100000', '#200000', '#300000', '#400000'],
  status: {
    success: '#00a000',
    warning: '#a0a000',
    failed: '#a00000',
    info: '#0000a0',
    neutral: '#a0a0a0',
    muted: '#909090',
  },
  scale: ['#000010', '#0000ff'],
};

export const useChartPalette = jest.fn(() => LIGHT_CHART_PALETTE);

export const chartColor = (
  palette: typeof LIGHT_CHART_PALETTE,
  index: number,
  status?: keyof typeof LIGHT_CHART_PALETTE.status
) =>
  status
    ? palette.status[status]
    : palette.series[index % palette.series.length];

export const hexToRgba = (hex: string, alpha: number) => `${hex}@${alpha}`;

export const useIsDarkMode = jest.fn(() => false);

// Stand-in theme: only what app code reads of it.
export const buildChartTheme = ({ isDark = false } = {}) => ({
  axisText: isDark ? '#d0d0d0' : '#606060',
});

export const PieChart = mockChart('core-pie-chart');
export const LineChart = mockChart('core-line-chart');
export const AreaChart = mockChart('core-area-chart');
export const BarChart = mockChart('core-bar-chart');
export const ComposedChart = mockChart('core-composed-chart');
export const GeoMapChart = mockChart('core-geo-map-chart');
export const EChart = mockChart('core-echart');
