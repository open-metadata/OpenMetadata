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
import {
  PieChart,
  type PieChartProps,
} from '@openmetadata/ui-core-components/charts';
import { render, screen } from '@testing-library/react';
import { SummaryDonut } from './SummaryDonut.component';
import { ChartData } from './SummaryPanel.interface';

const mockPieChart = PieChart as unknown as jest.Mock<null, [PieChartProps]>;
const pieProps = () =>
  mockPieChart.mock.calls[mockPieChart.mock.calls.length - 1]?.[0];

const chartData: ChartData[] = [
  { name: 'success', value: 8, color: '#21bf73' },
  { name: 'failed', value: 2, color: '#cb2531' },
];

describe('SummaryDonut component', () => {
  it('renders a tracked donut sized to `size`', () => {
    render(
      <SummaryDonut ariaLabel="Tests" chartData={chartData} percentage="80%" />
    );

    expect(pieProps()).toEqual(
      expect.objectContaining({
        ariaLabel: 'Tests',
        data: chartData,
        track: true,
        innerRadius: '75%',
        outerRadius: '100%',
        padAngle: 0,
        height: 120,
        legend: { show: false },
      })
    );
  });

  it('renders the centred percentage', () => {
    render(
      <SummaryDonut ariaLabel="Tests" chartData={chartData} percentage="80%" />
    );

    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('renders a numeric percentage', () => {
    render(
      <SummaryDonut ariaLabel="Tests" chartData={chartData} percentage={42} />
    );

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('scales the chart and the label with size', () => {
    render(
      <SummaryDonut
        ariaLabel="Tests"
        chartData={chartData}
        percentage="80%"
        size={100}
      />
    );

    expect(pieProps()?.height).toBe(100);
    expect(screen.getByText('80%')).toHaveStyle({ fontSize: '14px' });
  });

  it('passes the padding angle', () => {
    render(
      <SummaryDonut
        ariaLabel="Tests"
        chartData={chartData}
        paddingAngle={2}
        percentage="80%"
      />
    );

    expect(pieProps()?.padAngle).toBe(2);
  });

  it('keeps the track and label when there is no data', () => {
    render(<SummaryDonut ariaLabel="Tests" chartData={[]} percentage="0%" />);

    expect(pieProps()?.data).toEqual([]);
    expect(pieProps()?.track).toBe(true);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
