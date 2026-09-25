/*
 *  Copyright 2026 Collate.
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
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import TestSummaryStatusKey from './TestSummaryStatusKey';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('TestSummaryStatusKey', () => {
  it('should name only the statuses the window actually holds', () => {
    render(
      <TestSummaryStatusKey
        statuses={[
          TestCaseStatus.Success,
          TestCaseStatus.Success,
          TestCaseStatus.Aborted,
        ]}
      />
    );

    expect(screen.getByTestId('test-summary-status-key')).toHaveTextContent(
      'label.success'
    );
    expect(screen.getByTestId('test-summary-status-key')).toHaveTextContent(
      'label.aborted'
    );
    expect(
      screen.queryByTestId(`status-key-${TestCaseStatus.Queued}`)
    ).not.toBeInTheDocument();
  });

  it('should read in a fixed order rather than the order runs arrived', () => {
    render(
      <TestSummaryStatusKey
        statuses={[
          TestCaseStatus.Queued,
          TestCaseStatus.Failed,
          TestCaseStatus.Success,
        ]}
      />
    );

    const labels = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(labels).toEqual(['label.success', 'label.failed', 'label.queued']);
  });

  // Colour alone cannot carry the difference between a run that produced no
  // value and one that has not run yet.
  it('should draw the aborted key hollow and the others filled', () => {
    render(
      <TestSummaryStatusKey
        statuses={[TestCaseStatus.Success, TestCaseStatus.Aborted]}
      />
    );

    const aborted = screen.getByTestId(
      `status-key-${TestCaseStatus.Aborted}`
    ).firstElementChild;
    const success = screen.getByTestId(
      `status-key-${TestCaseStatus.Success}`
    ).firstElementChild;

    expect(aborted).toHaveStyle(
      'border: 2px solid var(--om-color-warning-500)'
    );
    expect(success).toHaveStyle(
      'background-color: var(--om-color-visualization-green-3)'
    );
  });

  it('should render nothing when there are no runs', () => {
    const { container } = render(<TestSummaryStatusKey statuses={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
