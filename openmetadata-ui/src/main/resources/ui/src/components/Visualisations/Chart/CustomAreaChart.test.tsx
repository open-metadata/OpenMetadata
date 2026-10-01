/*
 *  Copyright 2024 Collate.
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
import {
  AreaChart,
  type CartesianChartProps,
} from '@openmetadata/ui-core-components/charts';
import { render, screen } from '@testing-library/react';
import CustomAreaChart from './CustomAreaChart.component';

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDate: jest.fn((timestamp: number) => `date-${timestamp}`),
}));

type Row = { timestamp: number; count: number; date: string };
const mockAreaChart = AreaChart as unknown as jest.Mock<
  null,
  [CartesianChartProps<Row>]
>;
const areaProps = () =>
  mockAreaChart.mock.calls[mockAreaChart.mock.calls.length - 1][0];

const data = [
  { timestamp: 1, count: 4 },
  { timestamp: 2, count: 7 },
];

describe('CustomAreaChart', () => {
  it('renders a core area sparkline keyed by a readable date', () => {
    render(<CustomAreaChart ariaLabel="Success" data={data} name="success" />);

    expect(document.getElementById('success-area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('core-area-chart')).toBeInTheDocument();
    expect(areaProps()).toEqual(
      expect.objectContaining({
        ariaLabel: 'Success',
        xKey: 'date',
        height: 150,
        legend: { show: false },
        xAxis: { show: false },
        yAxis: { show: false },
      })
    );
    expect(areaProps().data).toEqual([
      { timestamp: 1, count: 4, date: 'date-1' },
      { timestamp: 2, count: 7, date: 'date-2' },
    ]);
    expect(areaProps().series).toEqual([
      {
        key: 'count',
        name: 'Success',
        status: 'info',
        seriesOption: { connectNulls: true },
      },
    ]);
  });

  it('colours the series by status and honours height', () => {
    render(
      <CustomAreaChart
        ariaLabel="Failed"
        data={data}
        height={50}
        name="failed"
        status="failed"
      />
    );

    expect(areaProps().height).toBe(50);
    expect(areaProps().series[0].status).toBe('failed');
  });

  it('formats tooltip values with valueFormatter', () => {
    render(
      <CustomAreaChart
        ariaLabel="Time"
        data={data}
        name="time"
        valueFormatter={(value) => `${value} ms`}
      />
    );

    expect(areaProps().tooltip?.valueFormatter?.(7, 'count')).toBe('7 ms');
  });
});
