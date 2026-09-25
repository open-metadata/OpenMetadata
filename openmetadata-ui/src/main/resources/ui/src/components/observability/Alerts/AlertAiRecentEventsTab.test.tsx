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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Status } from '../../../generated/events/api/typedEvent';
import { EventSubscription } from '../../../generated/events/eventSubscription';
import { getAlertEventsFromId } from '../../../rest/alertsAPI';
import AlertAiRecentEventsTab from './AlertAiRecentEventsTab';

jest.mock('../../../rest/alertsAPI', () => ({
  getAlertEventsFromId: jest.fn(),
}));

jest.mock('../../../hooks/paging/usePaging', () => {
  const { useState } = jest.requireActual('react');

  return {
    usePaging: () => {
      const [paging, setPaging] = useState({ total: 0 });
      const [currentPage, setCurrentPage] = useState(1);

      return {
        currentPage,
        handlePageChange: setCurrentPage,
        handlePageSizeChange: jest.fn(),
        handlePagingChange: setPaging,
        pageSize: 15,
        paging,
        showPagination: paging.total > 15,
      };
    },
  };
});

jest.mock('../../../utils/SearchClassBase', () => ({
  getEntityIcon: () => <svg data-testid="entity-icon" />,
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: (value: number) => `time-${value}`,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockGetEvents = getAlertEventsFromId as jest.Mock;

const alertDetails = {
  id: 'alert-id',
  name: 'my-alert',
} as EventSubscription;

const successfulEvent = {
  status: Status.Successful,
  timestamp: 1700000000000,
  data: [
    {
      id: 'event-1',
      entityId: 'table-id',
      entityType: 'table',
      eventType: 'entityUpdated',
      timestamp: 1700000000000,
      changeDescription: { fieldsUpdated: [{ name: 'description' }] },
    },
  ],
};

describe('AlertAiRecentEventsTab', () => {
  beforeEach(() => {
    mockGetEvents.mockReset();
  });

  it('lists recent events and shows the event details when expanded', async () => {
    mockGetEvents.mockResolvedValue({
      data: [successfulEvent],
      paging: { total: 1 },
    });

    render(<AlertAiRecentEventsTab alertDetails={alertDetails} />);

    expect(mockGetEvents).toHaveBeenCalledWith({
      id: 'alert-id',
      params: { limit: 15, paginationOffset: 0 },
    });

    fireEvent.click(await screen.findByTestId('event-collapse-event-1'));

    const details = await screen.findByTestId('event-details-event-1');

    expect(
      details.querySelector('[data-testid="event-data-entityId"]')
    ).toHaveTextContent('table-id');
    expect(
      details.querySelector('[data-testid="event-data-eventType"]')
    ).toHaveTextContent('entityUpdated');
    expect(screen.getByTestId('event-change-description')).toHaveTextContent(
      '"fieldsUpdated"'
    );
    expect(screen.getByText('time-1700000000000')).toBeInTheDocument();
  });

  it('shows the no-events state when the alert has no events', async () => {
    mockGetEvents.mockResolvedValue({ data: [], paging: { total: 0 } });

    render(<AlertAiRecentEventsTab alertDetails={alertDetails} />);

    expect(
      await screen.findByText('message.no-recent-events')
    ).toBeInTheDocument();
  });

  it('shows the failure reason of a failed event', async () => {
    mockGetEvents.mockResolvedValue({
      data: [
        {
          status: Status.Failed,
          timestamp: 1,
          data: [
            {
              reason: 'Connection refused',
              failingSubscriptionId: 'sub-id',
              changeEvent: { ...successfulEvent.data[0], id: 'event-2' },
            },
          ],
        },
      ],
      paging: { total: 1 },
    });

    render(<AlertAiRecentEventsTab alertDetails={alertDetails} />);

    fireEvent.click(await screen.findByTestId('event-collapse-event-2'));

    expect(await screen.findByTestId('event-data-reason')).toHaveTextContent(
      'Connection refused'
    );
  });

  it('filters events by status and shows the filtered empty state', async () => {
    mockGetEvents.mockResolvedValue({ data: [], paging: { total: 0 } });

    render(<AlertAiRecentEventsTab alertDetails={alertDetails} />);

    fireEvent.click(
      await screen.findByRole('button', { name: /label.filter/ })
    );
    fireEvent.click(
      await screen.findByRole('option', { name: 'label.failed' })
    );

    await waitFor(() =>
      expect(mockGetEvents).toHaveBeenLastCalledWith({
        id: 'alert-id',
        params: { limit: 15, paginationOffset: 0, status: Status.Failed },
      })
    );

    expect(
      await screen.findByText('message.no-results-for-filters')
    ).toBeInTheDocument();
  });

  it('fetches the next page by offset', async () => {
    mockGetEvents.mockResolvedValue({
      data: [successfulEvent],
      paging: { total: 40 },
    });

    render(<AlertAiRecentEventsTab alertDetails={alertDetails} />);

    fireEvent.click(await screen.findByRole('button', { name: /next/i }));

    await waitFor(() =>
      expect(mockGetEvents).toHaveBeenLastCalledWith({
        id: 'alert-id',
        params: { limit: 15, paginationOffset: 15 },
      })
    );
  });
});
