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
  PieChart,
  type PieChartProps,
} from '@openmetadata/ui-core-components/charts';
import { render, screen } from '@testing-library/react';
import CustomPieChart from './CustomPieChart.component';

const mockPieChart = PieChart as unknown as jest.Mock<null, [PieChartProps]>;
const pieProps = () =>
  mockPieChart.mock.calls[mockPieChart.mock.calls.length - 1]?.[0];

const mockData = [
  { name: 'Success', value: 400, color: '#0088FE' },
  { name: 'Failed', value: 0, color: '#00C49F' },
  { name: 'Aborted', value: 3, color: '#FFBB28' },
];

describe('CustomPieChart', () => {
  it('renders a donut with a track ring from the data', () => {
    render(
      <CustomPieChart ariaLabel="Test results" data={mockData} name="test" />
    );

    expect(pieProps()).toEqual(
      expect.objectContaining({
        ariaLabel: 'Test results',
        data: mockData,
        track: true,
        innerRadius: '60%',
        outerRadius: '80%',
        minAngle: 3,
        height: 200,
        legend: { show: false },
      })
    );
  });

  it('keeps the chart id Playwright uses', () => {
    const { container } = render(
      <CustomPieChart ariaLabel="Test results" data={mockData} name="test" />
    );

    expect(container.querySelector('#test-pie-chart')).toBeInTheDocument();
  });

  it('passes a custom minAngle', () => {
    render(
      <CustomPieChart ariaLabel="x" data={mockData} minAngle={0} name="test" />
    );

    expect(pieProps()?.minAngle).toBe(0);
  });

  it('renders a string label in the centre', () => {
    render(
      <CustomPieChart
        ariaLabel="x"
        data={mockData}
        label="Center"
        name="test"
      />
    );

    expect(screen.getByText('Center')).toBeInTheDocument();
  });

  it('renders a React label in the centre', () => {
    render(
      <CustomPieChart
        ariaLabel="x"
        data={mockData}
        label={<span>React label</span>}
        name="test"
      />
    );

    expect(screen.getByText('React label')).toBeInTheDocument();
  });

  it('renders no centre label when label is undefined', () => {
    render(<CustomPieChart ariaLabel="x" data={mockData} name="test" />);

    expect(pieProps()?.centerLabel).toBeUndefined();
  });

  it('maps a slice click to the segment and its index', () => {
    const onSegmentClick = jest.fn();
    render(
      <CustomPieChart
        ariaLabel="x"
        data={mockData}
        name="test"
        onSegmentClick={onSegmentClick}
      />
    );
    pieProps()?.onSliceClick?.(mockData[2], {} as never);

    expect(onSegmentClick).toHaveBeenCalledWith(mockData[2], 2);
  });

  it('passes no click handler when onSegmentClick is not set', () => {
    render(<CustomPieChart ariaLabel="x" data={mockData} name="test" />);

    expect(pieProps()?.onSliceClick).toBeUndefined();
  });

  it('renders legends with counts when showLegends is true', () => {
    render(
      <CustomPieChart showLegends ariaLabel="x" data={mockData} name="test" />
    );

    expect(screen.getByTestId('legend-count-success')).toHaveTextContent('400');
    expect(screen.getByTestId('legend-count-failed')).toHaveTextContent('0');
  });

  it('renders no legends by default', () => {
    render(<CustomPieChart ariaLabel="x" data={mockData} name="test" />);

    expect(
      screen.queryByTestId('legend-count-success')
    ).not.toBeInTheDocument();
  });

  it('passes empty data through so core draws the empty track', () => {
    render(<CustomPieChart ariaLabel="x" data={[]} label="0" name="test" />);

    expect(pieProps()?.data).toEqual([]);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
