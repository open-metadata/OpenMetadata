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

import { fireEvent, render, screen } from '@testing-library/react';
import IncidentGroupBulkFailuresModal from './IncidentGroupBulkFailuresModal';

const mockOnClose = jest.fn();

describe('IncidentGroupBulkFailuresModal', () => {
  it('should stay closed without an outcome', () => {
    render(<IncidentGroupBulkFailuresModal onClose={mockOnClose} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('incident-groups-bulk-failures-modal')
    ).not.toBeInTheDocument();
  });

  it('should list every incident that was not updated, with its reason', () => {
    render(
      <IncidentGroupBulkFailuresModal
        outcome={{
          total: 5,
          passed: 3,
          unchanged: 0,
          failures: [
            {
              request: { testCaseReference: 'svc.db.shop.orders.rows' },
              message: 'Permission denied',
            },
            {
              request: { testCaseReference: 'svc.db.shop.customers.rows' },
              message: 'Incident is already Ack',
            },
          ],
        }}
        onClose={mockOnClose}
      />
    );

    expect(
      screen.getByText('label.incident-plural-not-updated')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.bulk-incident-partial-failure')
    ).toBeInTheDocument();

    const failures = screen.getAllByTestId('incident-groups-bulk-failure');

    expect(failures).toHaveLength(2);
    expect(failures[0]).toHaveTextContent('svc.db.shop.orders.rows');
    expect(failures[0]).toHaveTextContent('Permission denied');

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should close from its Close button', () => {
    mockOnClose.mockClear();
    render(
      <IncidentGroupBulkFailuresModal
        outcome={{ total: 1, passed: 0, unchanged: 0, failures: [] }}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByTestId('incident-groups-bulk-failures-close'));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should still list a failure the server returned without its request', () => {
    render(
      <IncidentGroupBulkFailuresModal
        outcome={{
          total: 1,
          passed: 0,
          unchanged: 0,
          failures: [{ message: 'Bulk request size exceeded' }],
        }}
        onClose={mockOnClose}
      />
    );

    expect(
      screen.getByTestId('incident-groups-bulk-failure')
    ).toHaveTextContent('Bulk request size exceeded');
  });
});
