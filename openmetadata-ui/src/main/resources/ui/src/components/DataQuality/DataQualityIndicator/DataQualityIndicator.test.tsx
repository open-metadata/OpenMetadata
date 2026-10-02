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
import { MemoryRouter } from 'react-router-dom';
import {
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../generated/tests/testCaseResolutionStatus';
import { DataQualityIndicator } from './DataQualityIndicator';
import { DataQualityIndicatorCounts } from './DataQualityIndicator.types';
import {
  countUnresolvedIncidents,
  EMPTY_DQ_INDICATOR_COUNTS,
} from './DataQualityIndicator.utils';

const TABLE_FQN = 'svc.db.schema.orders';

const renderIndicator = (counts: Partial<DataQualityIndicatorCounts>) =>
  render(
    <MemoryRouter>
      <DataQualityIndicator
        counts={{ ...EMPTY_DQ_INDICATOR_COUNTS, ...counts }}
        tableFqn={TABLE_FQN}
      />
    </MemoryRouter>
  );

const incident = (testCaseId: string, status: TestCaseResolutionStatusTypes) =>
  ({
    testCaseReference: { id: testCaseId, type: 'testCase' },
    testCaseResolutionStatusType: status,
  } as TestCaseResolutionStatus);

describe('DataQualityIndicator', () => {
  it('renders nothing when there are no failures, incidents or upstream issues', () => {
    renderIndicator({});

    expect(screen.queryByTestId('dq-indicator')).not.toBeInTheDocument();
  });

  it('shows the red failing state and links to the data quality tab', () => {
    renderIndicator({ failingTests: 2 });

    const indicator = screen.getByTestId('dq-indicator');

    expect(indicator).toHaveAttribute('data-level', 'failing');
    expect(indicator).toHaveClass('tw:text-fg-error-primary');
    expect(indicator).toHaveAttribute(
      'aria-label',
      'label.data-quality-test-failing'
    );
    expect(indicator.getAttribute('href')).toContain('profiler/data-quality');
  });

  it('stays visible in amber while an incident is open even if tests pass', () => {
    renderIndicator({ unresolvedIncidents: 1 });

    const indicator = screen.getByTestId('dq-indicator');

    expect(indicator).toHaveAttribute('data-level', 'incident');
    expect(indicator).toHaveClass('tw:text-fg-warning-primary');
    expect(indicator.getAttribute('href')).toContain('profiler/incidents');
    expect(
      screen.queryByTestId('dq-indicator-upstream-badge')
    ).not.toBeInTheDocument();
  });

  it('shows amber with the upstream badge and links to lineage for upstream-only issues', () => {
    renderIndicator({ upstreamIssues: 1 });

    const indicator = screen.getByTestId('dq-indicator');

    expect(indicator).toHaveAttribute('data-level', 'upstream');
    expect(
      screen.getByTestId('dq-indicator-upstream-badge')
    ).toBeInTheDocument();
    expect(indicator.getAttribute('href')).toContain('lineage');
  });

  it('summarises multiple conditions under the highest-priority level', () => {
    renderIndicator({
      failingTests: 1,
      unresolvedIncidents: 2,
      upstreamIssues: 1,
    });

    const indicator = screen.getByTestId('dq-indicator');

    expect(indicator).toHaveAttribute('data-level', 'failing');
    expect(indicator).toHaveAttribute(
      'aria-label',
      'label.data-quality-needs-attention'
    );
  });
});

describe('countUnresolvedIncidents', () => {
  it('counts open incidents but skips resolved ones and ones on currently failing tests', () => {
    const incidents = [
      incident('passing-new', TestCaseResolutionStatusTypes.New),
      incident('passing-ack', TestCaseResolutionStatusTypes.ACK),
      incident('passing-resolved', TestCaseResolutionStatusTypes.Resolved),
      incident('failing-assigned', TestCaseResolutionStatusTypes.Assigned),
    ];

    expect(
      countUnresolvedIncidents(incidents, new Set(['failing-assigned']))
    ).toBe(2);
  });
});
