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

import { render, screen } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import {
  CustomTooltip,
  renderDataInsightLineChart,
  renderLegend,
} from './DataInsightChartUtils';

jest.mock('recharts', () => ({
  CartesianGrid: ({ stroke }: { stroke: string }) => (
    <div data-stroke={stroke} data-testid="data-insight-grid" />
  ),
  Line: ({ stroke }: { stroke: string }) => (
    <div data-stroke={stroke} data-testid="data-insight-line" />
  ),
  LineChart: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Surface: ({ children }: PropsWithChildren) => <svg>{children}</svg>,
  Tooltip: () => null,
  XAxis: ({ tick }: { tick?: { fill: string } }) => (
    <div data-fill={tick?.fill} data-testid="data-insight-x-axis" />
  ),
  YAxis: ({ tick }: { tick?: { fill: string } }) => (
    <div data-fill={tick?.fill} data-testid="data-insight-y-axis" />
  ),
}));

const CHART_COLORS = {
  axis: '#123456',
  grid: '#234567',
  inactive: '#345678',
};

describe('DataInsightChartUtils theme colors', () => {
  it('uses the semantic text color for tooltip titles', () => {
    render(
      <CustomTooltip
        active
        payload={[
          {
            color: '#abcdef',
            dataKey: 'count',
            name: 'Description coverage',
            payload: { term: 'Sep 1, 2026' },
            value: 76.27,
          },
        ]}
        timeStampKey="term"
      />
    );

    expect(screen.getByRole('heading', { name: 'Sep 1, 2026' })).toHaveClass(
      'custom-data-insight-tooltip-title'
    );
  });

  it('applies active theme colors to reusable line charts', () => {
    render(
      Reflect.apply(renderDataInsightLineChart, null, [
        [{ day: 1, table: 2 }],
        ['table'],
        [],
        '',
        false,
        CHART_COLORS,
      ])
    );

    expect(screen.getByTestId('data-insight-grid')).toHaveAttribute(
      'data-stroke',
      '#234567'
    );
    expect(screen.getByTestId('data-insight-x-axis')).toHaveAttribute(
      'data-fill',
      '#123456'
    );
    expect(screen.getByTestId('data-insight-y-axis')).toHaveAttribute(
      'data-fill',
      '#123456'
    );
  });

  it('applies the active theme muted color to inactive legends', () => {
    const legend = {
      payload: [{ color: '#abcdef', value: 'Table' }],
    };

    render(
      Reflect.apply(renderLegend, null, [
        legend,
        ['Dashboard'],
        undefined,
        CHART_COLORS.inactive,
      ])
    );

    expect(screen.getByText('Table')).toHaveStyle({ color: '#345678' });
  });
});
