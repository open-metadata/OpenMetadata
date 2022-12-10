/*
 *  Copyright 2022 Collate
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
import React from 'react';
import { INITIAL_OPERATION_METRIC_VALUE } from '../../constants/profiler.constant';
import { CustomBarChartProps } from './Chart.interface';
import CustomBarChart from './CustomBarChart';

const mockCustomBarChartProp: CustomBarChartProps = {
  chartCollection: {
    ...INITIAL_OPERATION_METRIC_VALUE,
    data: [
      {
        name: '07/Dec 14:32',
        timestamp: 1670403758680,
        INSERT: 37251,
      },
    ],
  },
  name: 'testChart',
};

jest.mock('recharts', () => ({
  Bar: jest.fn().mockImplementation(() => <div>Bar</div>),
  Legend: jest.fn().mockImplementation(() => <div>Legend</div>),
  Tooltip: jest.fn().mockImplementation(() => <div>Tooltip</div>),
  XAxis: jest.fn().mockImplementation(() => <div>XAxis</div>),
  YAxis: jest.fn().mockImplementation(() => <div>YAxis</div>),
  BarChart: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  ResponsiveContainer: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="responsive-container">{children}</div>
    )),
}));

describe('CustomBarChart component test', () => {
  it('Component should render', async () => {
    render(<CustomBarChart {...mockCustomBarChartProp} />);

    const container = await screen.findByTestId('responsive-container');
    const XAxis = await screen.findByText('XAxis');
    const YAxis = await screen.findByText('YAxis');
    const noData = screen.queryByTestId('"no-data-placeholder');

    expect(container).toBeInTheDocument();
    expect(XAxis).toBeInTheDocument();
    expect(YAxis).toBeInTheDocument();
    expect(noData).not.toBeInTheDocument();
  });

  it('If there is no data, placeholder should be visible', async () => {
    render(
      <CustomBarChart
        {...mockCustomBarChartProp}
        chartCollection={{
          ...INITIAL_OPERATION_METRIC_VALUE,
          data: [],
        }}
      />
    );

    const noData = await screen.findByTestId('no-data-placeholder');

    expect(noData).toBeInTheDocument();
  });
});
