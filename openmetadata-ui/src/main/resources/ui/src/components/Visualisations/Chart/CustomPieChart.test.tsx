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
import { fireEvent, render } from '@testing-library/react';
import { CHART_SMALL_SIZE } from '../../../constants/Chart.constants';
import { TEXT_GREY_MUTED } from '../../../constants/constants';
import CustomPieChart from './CustomPieChart.component';

describe('CustomPieChart', () => {
  const mockData = [
    { name: 'Category A', value: 400, color: '#0088FE' },
    { name: 'Category B', value: 300, color: '#00C49F' },
    { name: 'Category C', value: 300, color: '#FFBB28' },
    { name: 'Category D', value: 200, color: '#FF8042' },
  ];

  it('renders without crashing', () => {
    const { container } = render(
      <CustomPieChart data={mockData} name="test-chart" />
    );

    expect(container).toBeInTheDocument();
  });

  it('renders the center label when label is a string', () => {
    const label = 'Center Label';
    const { getByText } = render(
      <CustomPieChart data={mockData} label={label} name="test-chart" />
    );
    const centerLabel = getByText(label);

    expect(centerLabel).toBeInTheDocument();
    expect(centerLabel).toHaveAttribute('fill', TEXT_GREY_MUTED);
  });

  it('renders the center label when label is a React element', () => {
    const label = <text>Center Label</text>;
    const { getByText } = render(
      <CustomPieChart data={mockData} label={label} name="test-chart" />
    );
    const centerLabel = getByText('Center Label');

    expect(centerLabel).toBeInTheDocument();
  });

  it('does not render the center label when label is undefined', () => {
    const { container } = render(
      <CustomPieChart data={mockData} name="test-chart" />
    );
    const centerLabel = container.querySelector('text');

    expect(centerLabel).toBeNull();
  });

  it('applies the correct dimensions to the chart', () => {
    const { container } = render(
      <CustomPieChart data={mockData} name="test-chart" />
    );
    const pieChart = container.querySelector('.recharts-wrapper');

    expect(pieChart).toBeInTheDocument();
    expect(pieChart).toHaveStyle(`height: ${CHART_SMALL_SIZE}px`);
    expect(pieChart).toHaveStyle(`width: ${CHART_SMALL_SIZE}px`);
  });

  it('applies the correct fill color to the cells', () => {
    const { container } = render(
      <CustomPieChart data={mockData} name="test-chart" />
    );
    const cells = container.querySelectorAll('path.recharts-pie-sector');
    cells.forEach((cell, index) => {
      expect(cell).toHaveAttribute('fill', mockData[index].color);
    });
  });

  it('renders legends when showLegends is true', () => {
    const { getByText, getAllByText, container } = render(
      <CustomPieChart showLegends data={mockData} name="test-chart" />
    );

    // Check that all legend items are rendered
    mockData.forEach((item) => {
      expect(getByText(item.name)).toBeInTheDocument();

      // Use getAllByText for values since some values might appear multiple times
      const valueElements = getAllByText(item.value.toString());

      expect(valueElements.length).toBeGreaterThan(0);
    });

    // Check that legend dots are rendered with correct colors
    const legendDots = container.querySelectorAll('.legend-dot');

    expect(legendDots).toHaveLength(mockData.length);

    legendDots.forEach((dot, index) => {
      expect(dot).toHaveStyle(`background-color: ${mockData[index].color}`);
    });
  });

  it('does not render legends when showLegends is false or undefined', () => {
    const { container: containerFalse } = render(
      <CustomPieChart data={mockData} name="test-chart" showLegends={false} />
    );

    const { container: containerUndefined } = render(
      <CustomPieChart data={mockData} name="test-chart" />
    );

    // Check that no legend dots are rendered
    expect(containerFalse.querySelectorAll('.legend-dot')).toHaveLength(0);
    expect(containerUndefined.querySelectorAll('.legend-dot')).toHaveLength(0);
  });

  it('renders tooltip component', () => {
    const { container } = render(
      <CustomPieChart data={mockData} name="test-chart" />
    );

    // Check that tooltip is rendered
    const tooltip = container.querySelector('.recharts-tooltip-wrapper');

    expect(tooltip).toBeInTheDocument();
  });

  it('applies correct chart ID', () => {
    const chartName = 'test-chart';
    const { container } = render(
      <CustomPieChart data={mockData} name={chartName} />
    );

    const pieChart = container.querySelector(`#${chartName}-pie-chart`);

    expect(pieChart).toBeInTheDocument();
  });

  it('renders multiple pie components for layered effect', () => {
    const { container } = render(
      <CustomPieChart data={mockData} name="test-chart" />
    );

    // Should have two pie components (background and data)
    const pieComponents = container.querySelectorAll('.recharts-pie');

    expect(pieComponents).toHaveLength(2);
  });

  it('handles empty data gracefully', () => {
    const { container } = render(
      <CustomPieChart data={[]} name="test-chart" />
    );

    expect(container.querySelector('.custom-pie-chart')).toBeInTheDocument();
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
  });

  it('calls onSegmentClick when a data segment is clicked', () => {
    const onSegmentClick = jest.fn();
    const { container } = render(
      <CustomPieChart
        data={mockData}
        name="test-chart"
        onSegmentClick={onSegmentClick}
      />
    );

    const sectors = container.querySelectorAll('.recharts-pie-sector');
    const firstDataSector = sectors[1];

    fireEvent.click(firstDataSector as Element);

    expect(onSegmentClick).toHaveBeenCalled();
    expect(onSegmentClick).toHaveBeenCalledTimes(1);
    expect(onSegmentClick).toHaveBeenCalledWith(mockData[0], 0);
  });

  it('calls onSegmentClick with correct segment and index for each data segment', () => {
    const onSegmentClick = jest.fn();
    const { container } = render(
      <CustomPieChart
        data={mockData}
        name="test-chart"
        onSegmentClick={onSegmentClick}
      />
    );

    const sectors = container.querySelectorAll('.recharts-pie-sector');

    mockData.forEach((segment, index) => {
      onSegmentClick.mockClear();
      fireEvent.click(sectors[index + 1] as Element);

      expect(onSegmentClick).toHaveBeenCalledWith(segment, index);
    });
  });

  it('applies custom-pie-chart-clickable class when onSegmentClick is provided', () => {
    const { container } = render(
      <CustomPieChart
        data={mockData}
        name="test-chart"
        onSegmentClick={jest.fn()}
      />
    );

    const clickablePie = container.querySelector('.custom-pie-chart-clickable');

    expect(clickablePie).toBeInTheDocument();
  });

  it('does not apply custom-pie-chart-clickable class when onSegmentClick is not provided', () => {
    const { container } = render(
      <CustomPieChart data={mockData} name="test-chart" />
    );

    const clickablePie = container.querySelector('.custom-pie-chart-clickable');

    expect(clickablePie).toBeNull();
  });
});
