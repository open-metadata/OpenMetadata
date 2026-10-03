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
import { act, fireEvent, render, screen } from '@testing-library/react';
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
  beforeEach(() => {
    jest.useFakeTimers();
    // Establish pointer modality so react-aria accepts hover events.
    fireEvent.mouseMove(document);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const openCard = () => {
    const trigger = screen.getByTestId('dq-indicator').parentElement;

    fireEvent.mouseEnter(trigger as HTMLElement, { pointerType: 'mouse' });
    act(() => {
      jest.advanceTimersByTime(300);
    });
  };

  it('renders nothing when there are no failures, incidents or upstream issues', () => {
    renderIndicator({});

    expect(screen.queryByTestId('dq-indicator')).not.toBeInTheDocument();
  });

  it('shows the red failing state and links to the data quality tab', () => {
    renderIndicator({ failingTests: 2 });

    const indicator = screen.getByTestId('dq-indicator');

    expect(indicator).toHaveAttribute('data-level', 'failing');
    // The svg mock renders className as a literal `classname` attribute.
    expect(indicator.firstElementChild).toHaveAttribute(
      'classname',
      'tw:text-fg-error-primary'
    );
    expect(indicator.getAttribute('href')).toContain('profiler/data-quality');

    openCard();

    expect(
      screen.getByText('label.data-quality-test-failing')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.dq-failing-tests-description-plural')
    ).toBeInTheDocument();
    expect(screen.getByTestId('dq-indicator-action')).toHaveTextContent(
      'label.view-failing-test-plural'
    );
  });

  it('stays visible in amber while an incident is open even if tests pass', () => {
    renderIndicator({ unresolvedIncidents: 1 });

    const indicator = screen.getByTestId('dq-indicator');

    expect(indicator).toHaveAttribute('data-level', 'incident');
    expect(indicator.firstElementChild).toHaveAttribute(
      'classname',
      'tw:text-fg-warning-primary'
    );
    expect(
      screen.queryByTestId('dq-indicator-upstream-badge')
    ).not.toBeInTheDocument();

    openCard();

    expect(
      screen.getByText('message.dq-incident-open-tests-passing')
    ).toBeInTheDocument();

    const action = screen.getByTestId('dq-indicator-action');

    expect(action).toHaveTextContent('label.view-incident');
    expect(action.getAttribute('href')).toContain('profiler/incidents');
  });

  it('shows amber with the upstream badge and links to lineage for upstream-only issues', () => {
    renderIndicator({ upstreamIssues: 1 });

    const indicator = screen.getByTestId('dq-indicator');

    expect(indicator).toHaveAttribute('data-level', 'upstream');
    expect(
      screen.getByTestId('dq-indicator-upstream-badge')
    ).toBeInTheDocument();
    expect(indicator.getAttribute('href')).toContain('lineage');

    openCard();

    expect(screen.getByTestId('dq-indicator-action')).toHaveTextContent(
      'label.view-upstream-issue'
    );
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

    openCard();

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByTestId('dq-indicator-action')).toHaveTextContent(
      'label.view-data-quality'
    );
  });
});

describe('countUnresolvedIncidents', () => {
  it('skips open incidents on currently failing tests', () => {
    const incidents = [
      incident('passing-new', TestCaseResolutionStatusTypes.New),
      incident('passing-ack', TestCaseResolutionStatusTypes.ACK),
      incident('failing-assigned', TestCaseResolutionStatusTypes.Assigned),
    ];

    expect(
      countUnresolvedIncidents(incidents, new Set(['failing-assigned']))
    ).toBe(2);
  });
});
