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
import { STATUS_COLORS } from '../../../../constants/Color.constants';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseIncidentGroup';
import IncidentStatusBreakdown from './IncidentStatusBreakdown';

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

    expect(screen.getByTestId('group-status-segment-Assigned')).toHaveStyle({
      width: '75%',
      backgroundColor: STATUS_COLORS.Assigned.border,
    });
    expect(screen.getByTestId('group-status-segment-Ack')).toHaveStyle({
      width: '25%',
      backgroundColor: STATUS_COLORS.Ack.border,
    });
  });

  it('should spell the counts out under the bar', () => {
    render(
      <IncidentStatusBreakdown
        statusCounts={[
          { status: TestCaseResolutionStatusTypes.New, count: 2 },
          { status: TestCaseResolutionStatusTypes.Assigned, count: 3 },
        ]}
      />
    );

    expect(screen.getByTestId('group-status-counts')).toHaveTextContent(
      '3 label.assigned-lowercase · 2 label.new-lowercase'
    );
  });

  it('should draw no slice for a status the group has no incident in', () => {
    render(
      <IncidentStatusBreakdown
        statusCounts={[
          { status: TestCaseResolutionStatusTypes.New, count: 2 },
          { status: TestCaseResolutionStatusTypes.ACK, count: 0 },
        ]}
      />
    );

    expect(screen.getByTestId('group-status-segment-New')).toHaveStyle({
      width: '100%',
    });
    expect(
      screen.queryByTestId('group-status-segment-Ack')
    ).not.toBeInTheDocument();
  });

  it('should keep resolved incidents out of the bar', () => {
    render(
      <IncidentStatusBreakdown
        statusCounts={[
          { status: TestCaseResolutionStatusTypes.Resolved, count: 5 },
          { status: TestCaseResolutionStatusTypes.New, count: 1 },
        ]}
      />
    );

    expect(
      screen.queryByTestId('group-status-segment-Resolved')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('group-status-counts')).toHaveTextContent(
      '1 label.new-lowercase'
    );
  });

  it('should fall back to a placeholder when no status is carried', () => {
    render(<IncidentStatusBreakdown />);

    expect(screen.getByTestId('group-status')).toHaveTextContent('--');
  });
});
