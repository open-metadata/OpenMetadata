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
import { render, screen } from '@testing-library/react';
import {
  MOCK_SQL_TEST_CASE,
  MOCK_TEST_CASE,
} from '../../../../mocks/TestSuite.mock';
import { getEpochMillisForPastDays } from '../../../../utils/date-time/DateTimeUtils';
import { TestSummaryProps } from '../ProfilerDashboard/profilerDashboard.interface';
import TestSummary from './TestSummary';

const mockProps: TestSummaryProps = {
  data: MOCK_TEST_CASE[1],
};

jest.mock('../../../../rest/testAPI', () => {
  return {
    getListTestCaseResults: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ data: MOCK_TEST_CASE[1] })),
  };
});
jest.mock('../../../../constants/profiler.constant', () => {
  return {
    PROFILER_FILTER_RANGE: {
      last30days: {
        days: 30,
        title: 'last 30 days',
      },
    },
  };
});

jest.mock('../../../common/DatePickerMenu/DatePickerMenu.component', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>DatePickerMenu.component</div>);
});
jest.mock('../../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader.component</div>);
});
jest.mock('./TestSummaryGraph', () => {
  return jest.fn().mockImplementation(() => <div>TestSummaryGraph</div>);
});
jest.mock('../../../../utils/date-time/DateTimeUtils', () => {
  return {
    getCurrentMillis: jest.fn().mockImplementation(() => 1633948800000),
    getEpochMillisForPastDays: jest
      .fn()
      .mockImplementation(() => 1633948800000),
  };
});

describe('TestSummary component', () => {
  it('Component should render', async () => {
    render(<TestSummary {...mockProps} />);

    const graphContainer = await screen.findByTestId('graph-container');
    const graph = await screen.findByText('TestSummaryGraph');

    expect(
      await screen.findByTestId('test-summary-container')
    ).toBeInTheDocument();
    expect(graphContainer).toBeInTheDocument();
    expect(graph).toBeInTheDocument();
    expect(
      await screen.findByText('DatePickerMenu.component')
    ).toBeInTheDocument();
  });

  it('default time range should be 30 days', async () => {
    const MockGetEpochMillisForPastDays =
      getEpochMillisForPastDays as jest.Mock;
    render(<TestSummary data={MOCK_SQL_TEST_CASE} />);

    expect(MockGetEpochMillisForPastDays).toHaveBeenCalledWith(30);
  });
});
