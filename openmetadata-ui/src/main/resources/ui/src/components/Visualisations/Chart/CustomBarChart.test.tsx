/*
 *  Copyright 2022 Collate.
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
  BarChart,
  type BarChartProps,
} from '@openmetadata/ui-core-components/charts';
import { render, screen } from '@testing-library/react';
import { PROFILER_CHART_DATA_SIZE } from '../../../constants/profiler.constant';
import { tooltipFormatter } from '../../../utils/ChartUtils';
import { CustomBarChartProps } from './Chart.interface';
import CustomBarChart from './CustomBarChart';

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('../../../utils/date-time/DateTimeUtils'),
  formatDateTimeLong: jest.fn((timestamp: number) => `long-${timestamp}`),
}));

type Row = Record<string, string | number | undefined>;
const mockBarChart = BarChart as unknown as jest.Mock<
  null,
  [BarChartProps<Row>]
>;
const barProps = () =>
  mockBarChart.mock.calls[mockBarChart.mock.calls.length - 1][0];

const props: CustomBarChartProps = {
  ariaLabel: 'Volume change',
  name: 'operationMetrics',
  tickFormatter: '%',
  chartCollection: {
    information: [
      { title: 'Insert', dataKey: 'INSERT' },
      {
        title: 'Delete',
        dataKey: 'DELETE',
        status: 'warning',
      },
    ],
    data: [
      { name: 'Jan 1', timestamp: 1, INSERT: 4, DELETE: 1 },
      { name: 'Jan 2', timestamp: 2, INSERT: 2, DELETE: 0 },
    ],
  },
};

describe('CustomBarChart', () => {
  it('stacks one bar series per metric, palette-coloured, zooming above 500 points', () => {
    render(<CustomBarChart {...props} />);

    expect(
      document.getElementById('operationMetrics_graph')
    ).toBeInTheDocument();
    expect(barProps()).toEqual(
      expect.objectContaining({
        ariaLabel: 'Volume change',
        data: props.chartCollection.data,
        xKey: 'name',
        zoom: 'auto',
        zoomVisiblePoints: PROFILER_CHART_DATA_SIZE,
      })
    );
    expect(barProps().series).toEqual([
      { key: 'INSERT', name: 'Insert', stack: 'custom-bar-chart' },
      {
        key: 'DELETE',
        name: 'Delete',
        stack: 'custom-bar-chart',
        status: 'warning',
      },
    ]);
  });

  it('formats y ticks with the tick formatter', () => {
    render(<CustomBarChart {...props} />);
    const yAxis = barProps().yAxis as { formatter: (value: number) => string };

    expect(yAxis.formatter(40)).toBe('40%');
  });

  it('shows the long date and each operation with a value in the tooltip', () => {
    render(<CustomBarChart {...props} />);
    const content = barProps().tooltip?.render?.(
      [
        {
          seriesKey: 'INSERT',
          name: 'Insert',
          value: 4,
          color: '#1',
          dataIndex: 0,
        },
        {
          seriesKey: 'DELETE',
          name: 'Delete',
          value: null,
          color: '#2',
          dataIndex: 0,
        },
      ],
      props.chartCollection.data[0]
    );
    render(<>{content}</>);

    expect(screen.getByText('long-1')).toBeInTheDocument();
    expect(screen.getByText('Insert')).toBeInTheDocument();
    expect(
      screen.getByText(String(tooltipFormatter(4, '%')))
    ).toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('shows the placeholder and no chart when there is no data', () => {
    render(
      <CustomBarChart
        {...props}
        chartCollection={{ ...props.chartCollection, data: [] }}
        noDataPlaceholderText="No data"
      />
    );

    expect(screen.queryByTestId('core-bar-chart')).not.toBeInTheDocument();
  });
});
