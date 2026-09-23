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
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseIncidentGroup';
import { INCIDENT_GROUP_STATUS_BAR_CLASS } from './IncidentGroups.constants';
import IncidentStatusBreakdown from './IncidentStatusBreakdown';

const barClass = (status: TestCaseResolutionStatusTypes) =>
  INCIDENT_GROUP_STATUS_BAR_CLASS[status] ?? '';

describe('IncidentStatusBreakdown', () => {
  it('should give each status a slice sized against the group', () => {
    render(
      <IncidentStatusBreakdown
        statusCounts={[
          { status: TestCaseResolutionStatusTypes.Assigned, count: 3 },
          { status: TestCaseResolutionStatusTypes.ACK, count: 1 },
        ]}
      />
    );

    const assigned = screen.getByTestId('group-status-segment-Assigned');
    const ack = screen.getByTestId('group-status-segment-Ack');

    expect(assigned).toHaveStyle({ width: '75%' });
    expect(assigned).toHaveClass(
      barClass(TestCaseResolutionStatusTypes.Assigned)
    );
    expect(ack).toHaveStyle({ width: '25%' });
    expect(ack).toHaveClass(barClass(TestCaseResolutionStatusTypes.ACK));
  });

  it('should spell the counts out under the bar', () => {
    render(
      <IncidentStatusBreakdown
        statusCounts={[
          { status: TestCaseResolutionStatusTypes.Assigned, count: 3 },
          { status: TestCaseResolutionStatusTypes.New, count: 2 },
        ]}
      />
    );

    expect(screen.getByTestId('group-status-counts')).toHaveTextContent(
      '3 label.assigned-lowercase · 2 label.new-lowercase'
    );
  });

  it('should give a lone status the whole bar', () => {
    render(
      <IncidentStatusBreakdown
        statusCounts={[{ status: TestCaseResolutionStatusTypes.New, count: 2 }]}
      />
    );

    expect(screen.getByTestId('group-status-segment-New')).toHaveStyle({
      width: '100%',
    });
  });

  it('should fall back to a placeholder when no status is carried', () => {
    render(<IncidentStatusBreakdown />);

    expect(screen.getByTestId('group-status')).toHaveTextContent('--');
  });
});
