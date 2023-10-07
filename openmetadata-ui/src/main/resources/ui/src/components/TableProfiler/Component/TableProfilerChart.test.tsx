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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import {
  getSystemProfileList,
  getTableProfilesList,
} from '../../../rest/tableAPI';
import TableProfilerChart from './TableProfilerChart';

const mockFQN = 'testFQN';
const mockTimeValue = {
  endSec: 1670667984,
  startSec: 1670408784,
  endMilli: 1670667984000,
  startMilli: 1670408784000,
};
const mockDateRangeObject = { startTs: 1670408784000, endTs: 1670667984000 };

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({ fqn: mockFQN })),
}));
jest.mock('../../../rest/tableAPI');
jest.mock('../../ProfilerDashboard/component/ProfilerLatestValue', () => {
  return jest.fn().mockImplementation(() => <div>ProfilerLatestValue</div>);
});
jest.mock('../../ProfilerDashboard/component/ProfilerDetailsCard', () => {
  return jest.fn().mockImplementation(() => <div>ProfilerDetailsCard</div>);
});
jest.mock('../../Chart/CustomBarChart', () => {
  return jest.fn().mockImplementation(() => <div>CustomBarChart</div>);
});
jest.mock('../../Chart/OperationDateBarChart', () => {
  return jest.fn().mockImplementation(() => <div>OperationDateBarChart</div>);
});

describe('TableProfilerChart component test', () => {
  it('Component should render', async () => {
    const mockGetSystemProfileList = getSystemProfileList as jest.Mock;
    const mockGetTableProfilesList = getTableProfilesList as jest.Mock;
    act(() => {
      render(<TableProfilerChart dateRangeObject={mockDateRangeObject} />);
    });

    expect(
      await screen.findByTestId('table-profiler-chart-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('row-metrics')).toBeInTheDocument();
    expect(await screen.findByTestId('operation-metrics')).toBeInTheDocument();
    expect(
      await screen.findByTestId('operation-date-metrics')
    ).toBeInTheDocument();
    expect(await screen.findAllByText('ProfilerLatestValue')).toHaveLength(2);
    expect(
      await screen.findByText('OperationDateBarChart')
    ).toBeInTheDocument();
    expect(await screen.findByText('CustomBarChart')).toBeInTheDocument();
    expect(await screen.findByText('ProfilerDetailsCard')).toBeInTheDocument();
    expect(mockGetSystemProfileList.mock.instances).toHaveLength(1);
    expect(mockGetTableProfilesList.mock.instances).toHaveLength(1);
  });

  it('Api call should done as per proper data', async () => {
    const mockGetSystemProfileList = getSystemProfileList as jest.Mock;
    const mockGetTableProfilesList = getTableProfilesList as jest.Mock;
    await act(async () => {
      render(<TableProfilerChart dateRangeObject={mockDateRangeObject} />);
    });

    // API should be call once
    expect(mockGetSystemProfileList.mock.instances).toHaveLength(1);
    expect(mockGetTableProfilesList.mock.instances).toHaveLength(1);
    // API should be call with FQN value
    expect(mockGetSystemProfileList.mock.calls[0][0]).toEqual(mockFQN);
    expect(mockGetTableProfilesList.mock.calls[0][0]).toEqual(mockFQN);
    // API should be call with proper Param value
    expect(mockGetSystemProfileList.mock.calls[0][1]).toEqual({
      startTs: mockTimeValue.startMilli,
      endTs: mockTimeValue.endMilli,
    });
    expect(mockGetTableProfilesList.mock.calls[0][1]).toEqual({
      startTs: mockTimeValue.startMilli,
      endTs: mockTimeValue.endMilli,
    });
  });

  it('If TimeRange change API should be call accordingly', async () => {
    const startTime = {
      inMilli: 1670408784000,
      inSec: 1670408784,
    };
    const mockGetSystemProfileList = getSystemProfileList as jest.Mock;
    const mockGetTableProfilesList = getTableProfilesList as jest.Mock;

    await act(async () => {
      render(<TableProfilerChart dateRangeObject={mockDateRangeObject} />);
    });

    // API should be call with proper Param value
    expect(mockGetSystemProfileList.mock.calls[0][1]).toEqual({
      startTs: startTime.inMilli,
      endTs: mockTimeValue.endMilli,
    });
    expect(mockGetTableProfilesList.mock.calls[0][1]).toEqual({
      startTs: startTime.inMilli,
      endTs: mockTimeValue.endMilli,
    });
  });
});
