/*
 *  Copyright 2023 Collate.
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
  LineChart,
  type CartesianChartProps,
} from '@openmetadata/ui-core-components/charts';
import { queryByAttribute, render, screen } from '@testing-library/react';
import { ProfilerDetailsCardProps } from '../ProfilerDashboard/profilerDashboard.interface';
import ProfilerDetailsCard from './ProfilerDetailsCard';

jest.mock('../../../../utils/ChartUtils', () => ({
  axisTickFormatter: jest.fn(
    (value: number, unit?: string) => `${value}${unit ?? ''}`
  ),
  tooltipFormatter: jest.fn((value: number | string) => `fmt:${value}`),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTimeLong: jest.fn((ts: number) => `date:${ts}`),
}));

jest.mock('../ProfilerLatestValue/ProfilerLatestValue', () =>
  jest.fn(() => <div>ProfilerLatestValue</div>)
);

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../../../constants/profiler.constant', () => ({
  PROFILER_CHART_DATA_SIZE: 500,
}));

type Row = Record<string, string | number | undefined>;
const lineProps = () =>
  (
    LineChart as unknown as jest.Mock<null, [CartesianChartProps<Row>]>
  ).mock.calls.at(-1)?.[0] as CartesianChartProps<Row>;
const areaProps = () =>
  (
    AreaChart as unknown as jest.Mock<null, [CartesianChartProps<Row>]>
  ).mock.calls.at(-1)?.[0] as CartesianChartProps<Row>;

const mockProps: ProfilerDetailsCardProps = {
  chartCollection: {
    data: [{ name: 'Mon', timestamp: 1, value: 1, other: 2 }],
    information: [
      { dataKey: 'value', title: 'Value' },
      { dataKey: 'other', title: 'Other', status: 'warning' },
    ],
  },
  name: 'rowCount',
  title: 'Data count',
};

describe('ProfilerDetailsCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a line chart with one series per metric', () => {
    const { container } = render(<ProfilerDetailsCard {...mockProps} />);

    expect(
      screen.getByTestId('profiler-details-card-container')
    ).toBeInTheDocument();
    expect(
      queryByAttribute('id', container, 'rowCount_graph')
    ).toBeInTheDocument();
    expect(lineProps().series).toEqual([
      { key: 'value', name: 'Value', status: undefined },
      { key: 'other', name: 'Other', status: 'warning' },
    ]);
    expect(lineProps().xKey).toBe('name');
    expect(lineProps().ariaLabel).toBe('Data count');
    expect(lineProps().zoom).toBe('auto');
    expect(lineProps().zoomVisiblePoints).toBe(500);
  });

  it('renders an area chart for chartType area', () => {
    render(<ProfilerDetailsCard {...mockProps} chartType="area" />);

    expect(areaProps().series).toHaveLength(2);
    expect(LineChart).not.toHaveBeenCalled();
  });

  it('formats ticks with the unit and uses a category axis for strings', () => {
    const { rerender } = render(
      <ProfilerDetailsCard {...mockProps} tickFormatter="%" />
    );

    expect(lineProps().yAxis).toEqual(
      expect.objectContaining({ type: 'value' })
    );
    expect(
      (lineProps().yAxis as { formatter: (v: number) => string }).formatter(5)
    ).toBe('5%');

    rerender(<ProfilerDetailsCard {...mockProps} showYAxisCategory />);

    expect(lineProps().yAxis).toEqual({ type: 'category' });
  });

  it('renders the Data Quality tooltip with the date and formatted values', () => {
    render(<ProfilerDetailsCard {...mockProps} />);
    const content = lineProps().tooltip?.render?.(
      [
        {
          seriesKey: 'value',
          name: 'Value',
          value: 1,
          color: '#100000',
          dataIndex: 0,
        },
        {
          seriesKey: 'other',
          name: 'Other',
          value: null,
          color: '#a0a000',
          dataIndex: 0,
        },
      ],
      mockProps.chartCollection.data[0]
    );
    render(<>{content}</>);

    expect(screen.getByText('date:1')).toBeInTheDocument();
    expect(screen.getByText('fmt:1')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  it('shows the placeholder when there is no data', () => {
    render(
      <ProfilerDetailsCard
        {...mockProps}
        chartCollection={{ data: [], information: [] }}
      />
    );

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
    expect(LineChart).not.toHaveBeenCalled();
  });
});
