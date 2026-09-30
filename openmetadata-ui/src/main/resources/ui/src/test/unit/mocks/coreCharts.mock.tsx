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
 * the props they pass rather than on echarts output. Read them with
 * `jest.mocked(PieChart).mock.calls.at(-1)?.[0]`.
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

export const PieChart = mockChart('core-pie-chart');
export const LineChart = mockChart('core-line-chart');
export const AreaChart = mockChart('core-area-chart');
export const BarChart = mockChart('core-bar-chart');
export const ComposedChart = mockChart('core-composed-chart');
export const GeoMapChart = mockChart('core-geo-map-chart');
export const EChart = mockChart('core-echart');
