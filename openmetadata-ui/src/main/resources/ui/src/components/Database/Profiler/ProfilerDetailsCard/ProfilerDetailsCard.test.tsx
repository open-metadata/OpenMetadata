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

import { queryByAttribute, render, screen } from '@testing-library/react';
import { ProfilerDetailsCardProps } from '../ProfilerDashboard/profilerDashboard.interface';
import ProfilerDetailsCard from './ProfilerDetailsCard';

// Mock utility functions
jest.mock('../../../../utils/ChartUtils', () => ({
  axisTickFormatter: jest.fn(),
  tooltipFormatter: jest.fn(),
  updateActiveChartFilter: jest.fn(),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTimeLong: jest.fn(),
}));

// Existing mocks
jest.mock('../ProfilerLatestValue/ProfilerLatestValue', () =>
  jest.fn(() => <div>ProfilerLatestValue</div>)
);

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../../../utils/DataInsightUtils', () => ({
  CustomTooltip: jest.fn(() => <div>CustomTooltip</div>),
}));

// Improve mock data to be minimal
const mockProps: ProfilerDetailsCardProps = {
  chartCollection: {
    data: [{ name: 'test', value: 1 }],
    information: [{ dataKey: 'value', title: 'Test', color: '#000' }],
  },
  name: 'rowCount',
};

describe('ProfilerDetailsCard Test', () => {
  it('Component should render', async () => {
    const { container } = render(<ProfilerDetailsCard {...mockProps} />);

    expect(
      await screen.findByTestId('profiler-details-card-container')
    ).toBeInTheDocument();
    expect(
      queryByAttribute('id', container, `${mockProps.name}_graph`)
    ).toBeInTheDocument();
  });

  it('No data should be rendered', async () => {
    render(
      <ProfilerDetailsCard
        {...mockProps}
        chartCollection={{
          data: [],
          information: [],
        }}
      />
    );

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });
});
