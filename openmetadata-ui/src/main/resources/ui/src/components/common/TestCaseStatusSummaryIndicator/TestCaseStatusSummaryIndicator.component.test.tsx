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
import { MemoryRouter } from 'react-router-dom';
import TestCaseStatusSummaryIndicator from './TestCaseStatusSummaryIndicator.component';

const testCaseStatusCounts = {
  success: 5,
  failed: 2,
  aborted: 3,
  total: 10,
  queued: 0,
  entityLink: 'test',
};

jest.mock('../TestIndicator/TestIndicator', () => {
  return jest
    .fn()
    .mockImplementation(({ type }) => <div>{`test-indicator-${type}`}</div>);
});
jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test' }),
}));

describe('TestCaseStatusSummaryIndicator', () => {
  it('should render test indicators for each test status', () => {
    render(
      <TestCaseStatusSummaryIndicator
        testCaseStatusCounts={testCaseStatusCounts}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(screen.getByText('test-indicator-success')).toBeInTheDocument();
    expect(screen.getByText('test-indicator-failed')).toBeInTheDocument();
    expect(screen.getByText('test-indicator-aborted')).toBeInTheDocument();
  });

  it('should render no data placeholder when testCaseStatusCounts is null', () => {
    render(<TestCaseStatusSummaryIndicator />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('no-data-placeholder')).toBeInTheDocument();
  });

  it('should have href property for redirection', async () => {
    render(
      <TestCaseStatusSummaryIndicator
        testCaseStatusCounts={testCaseStatusCounts}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const successIndicator = await screen.findByTestId('success');

    expect(successIndicator).toBeInTheDocument();
    expect(successIndicator).toHaveAttribute(
      'href',
      '/table/test/profiler?activeTab=Data%20Quality'
    );
  });
});
