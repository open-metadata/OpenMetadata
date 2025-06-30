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

import { render, screen } from '@testing-library/react';
import '../../../test/unit/mocks/recharts.mock';
import { CustomBarChartProps } from './Chart.interface';
import CustomBarChart from './CustomBarChart';

const mockCustomBarChartProp: CustomBarChartProps = {
  chartCollection: {
    information: [
      {
        title: 'insert',
        dataKey: 'INSERT',
        color: '#00ff00',
      },
    ],
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
jest.mock('../../../utils/DataInsightUtils', () => {
  return jest.fn().mockImplementation(() => {
    return <div>CustomTooltip</div>;
  });
});

const mockData = Array.from({ length: 501 }, (_, index) => ({
  name: `test ${index}`,
  value: index,
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTimeLong: jest.fn(),
}));

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>ErrorPlaceHolder</div>),
}));

jest.mock('../../../constants/profiler.constant', () => ({
  PROFILER_CHART_DATA_SIZE: 500,
}));

jest.mock('../../../utils/ChartUtils', () => ({
  axisTickFormatter: jest.fn(),
  tooltipFormatter: jest.fn(),
  updateActiveChartFilter: jest.fn(),
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
    expect(screen.queryByText('Brush')).not.toBeInTheDocument();
  });

  it('Component should render brush when data length is greater than PROFILER_CHART_DATA_SIZE', async () => {
    render(
      <CustomBarChart
        {...mockCustomBarChartProp}
        chartCollection={{
          data: mockData,
          information: mockCustomBarChartProp.chartCollection.information,
        }}
      />
    );

    expect(screen.getByText('Brush')).toBeInTheDocument();
  });

  it('If there is no data, placeholder should be visible', async () => {
    render(
      <CustomBarChart
        {...mockCustomBarChartProp}
        chartCollection={{
          information: [],
          data: [],
        }}
      />
    );

    const noData = await screen.findByText('ErrorPlaceHolder');

    expect(noData).toBeInTheDocument();
  });
});
