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
import {
  MOCK_TEST_CASE_FEED_DATA,
  MOCK_TEST_CASE_FEED_DATA_2,
} from '../../../../../mocks/TestCaseFeeed.mock';
import TestCaseFeed from './TestCaseFeed';

jest.mock('../../../../Database/Profiler/TestSummary/TestSummaryGraph', () => {
  return jest.fn().mockReturnValue(<p>TestSummaryGraph</p>);
});

describe('Test TestCaseFeed Component', () => {
  it('Component should render with', async () => {
    render(<TestCaseFeed {...MOCK_TEST_CASE_FEED_DATA} />);

    expect(screen.getByText('label.test-suite-summary:')).toBeInTheDocument();

    expect(screen.getByText('TestSummaryGraph')).toBeInTheDocument();

    expect(screen.getByTestId('test-Success-value')).toContainHTML('2');
    expect(screen.getByTestId('test-Aborted-value')).toContainHTML('1');
    expect(screen.getByTestId('test-Failed-value')).toContainHTML('1');
  });

  it('Should not render TestSummaryGraph if all status is success', async () => {
    render(<TestCaseFeed {...MOCK_TEST_CASE_FEED_DATA_2} />);

    expect(screen.getByText('label.test-suite-summary:')).toBeInTheDocument();

    expect(screen.getByTestId('test-Success-value')).toContainHTML('4');
    expect(screen.getByTestId('test-Aborted-value')).toContainHTML('0');
    expect(screen.getByTestId('test-Failed-value')).toContainHTML('0');

    expect(screen.queryByText('TestSummaryGraph')).not.toBeInTheDocument();
  });
});
