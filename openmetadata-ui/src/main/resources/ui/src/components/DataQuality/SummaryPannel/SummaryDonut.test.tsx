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
import { GREY_200 } from '../../../constants/Color.constants';
import { ChartData } from './SummaryPanel.interface';
import { SummaryDonut } from './SummaryDonut.component';

jest.mock('recharts', () => {
  const PieChart = ({
    children,
    height,
    width,
  }: React.PropsWithChildren<{ height?: number; width?: number }>) => (
    <div data-height={height} data-testid="pie-chart" data-width={width}>
      {children}
    </div>
  );

  const Pie = ({
    children,
    data,
    innerRadius,
    outerRadius,
  }: React.PropsWithChildren<{
    data?: unknown[];
    innerRadius?: number;
    outerRadius?: number;
  }>) => (
    <div
      data-inner-radius={innerRadius}
      data-length={(data || []).length}
      data-outer-radius={outerRadius}
      data-testid="pie">
      {children}
    </div>
  );

  const Cell = ({ fill }: { fill?: string }) => (
    <div data-fill={fill} data-testid="cell" />
  );

  const Tooltip = () => <div data-testid="tooltip" />;

  return { Cell, Pie, PieChart, Tooltip };
});

const chartData: ChartData[] = [
  { name: 'success', value: 8, color: '#21bf73' },
  { name: 'failed', value: 2, color: '#cb2531' },
];

describe('SummaryDonut component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the centered percentage text', () => {
    render(<SummaryDonut chartData={chartData} percentage="80%" />);

    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('should render a numeric percentage', () => {
    render(<SummaryDonut chartData={chartData} percentage={42} />);

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should render two pies (grey track + data ring)', () => {
    render(<SummaryDonut chartData={chartData} percentage="80%" />);

    const pies = screen.getAllByTestId('pie');

    expect(pies).toHaveLength(2);
  });

  it('should render a grey track cell plus one colored cell per data entry', () => {
    render(<SummaryDonut chartData={chartData} percentage="80%" />);

    const cells = screen.getAllByTestId('cell');

    // 1 grey track cell + 2 data cells
    expect(cells).toHaveLength(chartData.length + 1);

    const greyCells = cells.filter(
      (cell) => cell.getAttribute('data-fill') === GREY_200
    );

    expect(greyCells).toHaveLength(1);

    chartData.forEach((entry) => {
      expect(
        cells.some((cell) => cell.getAttribute('data-fill') === entry.color)
      ).toBe(true);
    });
  });

  it('should render an empty data ring when chartData is empty', () => {
    render(<SummaryDonut chartData={[]} percentage="0%" />);

    const cells = screen.getAllByTestId('cell');

    // only the grey track cell remains
    expect(cells).toHaveLength(1);
    expect(cells[0].getAttribute('data-fill')).toBe(GREY_200);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should render at the default size of 120', () => {
    render(<SummaryDonut chartData={chartData} percentage="80%" />);

    const chart = screen.getByTestId('pie-chart');

    expect(chart.getAttribute('data-height')).toBe('120');
    expect(chart.getAttribute('data-width')).toBe('120');

    const pies = screen.getAllByTestId('pie');

    expect(pies[0].getAttribute('data-inner-radius')).toBe('45');
    expect(pies[0].getAttribute('data-outer-radius')).toBe('60');
  });

  it('should scale the ring radii with the size prop', () => {
    render(<SummaryDonut chartData={chartData} percentage="80%" size={240} />);

    const chart = screen.getByTestId('pie-chart');

    expect(chart.getAttribute('data-height')).toBe('240');
    expect(chart.getAttribute('data-width')).toBe('240');

    const pies = screen.getAllByTestId('pie');

    // innerRadius = 240 * 45 / 120 = 90, outerRadius = 240 * 60 / 120 = 120
    expect(pies[0].getAttribute('data-inner-radius')).toBe('90');
    expect(pies[0].getAttribute('data-outer-radius')).toBe('120');
  });
});
