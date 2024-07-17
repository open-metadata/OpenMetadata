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

import { queryByAttribute, render, screen } from '@testing-library/react';
import React from 'react';
import { MOCK_TEST_CASE_RESULT } from '../../../../mocks/TestSuite.mock';
import TestSummaryGraph from './TestSummaryGraph';
import { TestSummaryGraphProps } from './TestSummaryGraph.interface';

const mockProps: TestSummaryGraphProps = {
  testCaseName: 'test-case-1',
  testCaseParameterValue: [],
  testCaseResults: MOCK_TEST_CASE_RESULT,
  selectedTimeRange: '',
  minHeight: 20,
};

const mockHistory = {
  push: jest.fn(),
  goBack: jest.fn(),
};

jest.mock('react-router-dom', () => {
  return {
    ...jest.requireActual('react-router-dom'),
    useHistory: jest.fn().mockImplementation(() => mockHistory),
  };
});

jest.mock('../../../common/DatePickerMenu/DatePickerMenu.component', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>DatePickerMenu.component</div>);
});
jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>ErrorPlaceHolder.component</div>);
});
jest.mock('../../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader.component</div>);
});
jest.mock('../../SchemaEditor/SchemaEditor', () => {
  return jest.fn().mockImplementation(() => <div>SchemaEditor.component</div>);
});
jest.mock('../../../../utils/date-time/DateTimeUtils', () => {
  return {
    formatDateTime: jest.fn(),
    getCurrentMillis: jest.fn(),
    getEpochMillisForPastDays: jest.fn(),
  };
});

jest.mock(
  '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn().mockImplementation(() => ({
      entityThread: [],
    })),
  })
);

describe('TestSummaryGraph', () => {
  it('should display error placeholder when the result data is empty', () => {
    render(<TestSummaryGraph {...mockProps} testCaseResults={[]} />);

    expect(screen.getByText('ErrorPlaceHolder.component')).toBeInTheDocument();
  });

  it('should display the graph when the test result data is present', () => {
    render(<TestSummaryGraph {...mockProps} />);

    expect(
      queryByAttribute('id', document.body, `${mockProps.testCaseName}_graph`)
    ).toBeInTheDocument();
  });
});
