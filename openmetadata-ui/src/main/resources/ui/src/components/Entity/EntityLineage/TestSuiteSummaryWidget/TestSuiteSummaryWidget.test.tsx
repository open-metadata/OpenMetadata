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

import { render, screen } from '@testing-library/react';
import TestSuiteSummaryWidget from './TestSuiteSummaryWidget.component';

const TEST_PASSED_VALUE = 'test-passed-value';
const TEST_ABORTED_VALUE = 'test-aborted-value';
const TEST_FAILED_VALUE = 'test-failed-value';

const mockSummary = {
  success: 5,
  aborted: 1,
  failed: 2,
};

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Skeleton: {
    Button: jest.fn().mockImplementation(() => <div>Skeleton.Button</div>),
  },
}));

describe('TestSuiteSummaryWidget', () => {
  it('should show loader when isLoading is true', () => {
    render(<TestSuiteSummaryWidget isLoading />);

    expect(screen.getByText('Skeleton.Button')).toBeInTheDocument();
    expect(screen.queryByTestId(TEST_PASSED_VALUE)).toBeNull();
    expect(screen.queryByTestId(TEST_ABORTED_VALUE)).toBeNull();
    expect(screen.queryByTestId(TEST_FAILED_VALUE)).toBeNull();
  });

  it('should render correct status counts when summary is provided', () => {
    render(<TestSuiteSummaryWidget summary={mockSummary} />);

    expect(screen.getByTestId(TEST_PASSED_VALUE)).toHaveTextContent('5');
    expect(screen.getByTestId(TEST_ABORTED_VALUE)).toHaveTextContent('1');
    expect(screen.getByTestId(TEST_FAILED_VALUE)).toHaveTextContent('2');
  });

  it('should render 0 count if no summary is provided', () => {
    render(<TestSuiteSummaryWidget />);

    expect(screen.getByTestId(TEST_PASSED_VALUE)).toHaveTextContent('0');
    expect(screen.getByTestId(TEST_ABORTED_VALUE)).toHaveTextContent('0');
    expect(screen.getByTestId(TEST_FAILED_VALUE)).toHaveTextContent('0');
  });

  it('should render 0 count if summary values are undefined', () => {
    render(<TestSuiteSummaryWidget summary={{}} />);

    expect(screen.getByTestId(TEST_PASSED_VALUE)).toHaveTextContent('0');
    expect(screen.getByTestId(TEST_ABORTED_VALUE)).toHaveTextContent('0');
    expect(screen.getByTestId(TEST_FAILED_VALUE)).toHaveTextContent('0');
  });
});
