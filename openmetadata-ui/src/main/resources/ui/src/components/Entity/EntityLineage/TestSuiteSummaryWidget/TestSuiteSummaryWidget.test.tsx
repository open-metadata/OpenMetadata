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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { getTestCaseExecutionSummary } from '../../../../rest/testAPI';
import TestSuiteSummaryWidget from './TestSuiteSummaryWidget.component';

const mockTestSuite = { id: 'example', type: 'testSuite' };

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Skeleton: {
    Input: jest.fn().mockImplementation(() => <div>Skeleton.Input</div>),
  },
}));

jest.mock('../../../../rest/testAPI', () => ({
  getTestCaseExecutionSummary: jest.fn().mockImplementation(() =>
    Promise.resolve({
      success: 5,
      aborted: 1,
      failed: 2,
    })
  ),
}));

describe('TestSuiteSummaryWidget', () => {
  it('should show loader when fetching test suite summary', async () => {
    await act(async () => {
      render(<TestSuiteSummaryWidget testSuite={mockTestSuite} />);

      expect(screen.getByText('Skeleton.Input')).toBeInTheDocument();

      expect(screen.queryByTestId('test-passed-value')).toBeNull();
      expect(screen.queryByTestId('test-aborted-value')).toBeNull();
      expect(screen.queryByTestId('test-failed-value')).toBeNull();
    });
  });

  it('should render correct status counts', async () => {
    await act(async () => {
      render(<TestSuiteSummaryWidget testSuite={mockTestSuite} />);
    });

    expect(screen.getByTestId('test-passed-value')).toHaveTextContent('5');
    expect(screen.getByTestId('test-aborted-value')).toHaveTextContent('1');
    expect(screen.getByTestId('test-failed-value')).toHaveTextContent('2');
  });

  it('should render 0 count if no testSuite is passed in prop', async () => {
    await act(async () => {
      render(<TestSuiteSummaryWidget />);
    });

    expect(screen.getByTestId('test-passed-value')).toHaveTextContent('0');
    expect(screen.getByTestId('test-aborted-value')).toHaveTextContent('0');
    expect(screen.getByTestId('test-failed-value')).toHaveTextContent('0');
  });

  it('should render 0 count if no value is returned for respective count', async () => {
    (getTestCaseExecutionSummary as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({})
    );

    await act(async () => {
      render(<TestSuiteSummaryWidget testSuite={mockTestSuite} />);
    });

    expect(screen.getByTestId('test-passed-value')).toHaveTextContent('0');
    expect(screen.getByTestId('test-aborted-value')).toHaveTextContent('0');
    expect(screen.getByTestId('test-failed-value')).toHaveTextContent('0');
  });

  it('should render 0 count if getTestCaseExecutionSummary fails', async () => {
    (getTestCaseExecutionSummary as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({})
    );

    await act(async () => {
      render(<TestSuiteSummaryWidget testSuite={mockTestSuite} />);
    });

    expect(screen.getByTestId('test-passed-value')).toHaveTextContent('0');
    expect(screen.getByTestId('test-aborted-value')).toHaveTextContent('0');
    expect(screen.getByTestId('test-failed-value')).toHaveTextContent('0');
  });
});
