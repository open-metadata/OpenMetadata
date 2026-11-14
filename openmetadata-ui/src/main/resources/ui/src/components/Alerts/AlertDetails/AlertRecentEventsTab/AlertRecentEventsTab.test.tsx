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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Status } from '../../../../generated/events/api/typedEvent';
import {
  mockAlertDetails,
  MOCK_TYPED_EVENT_LIST_RESPONSE,
} from '../../../../mocks/Alerts.mock';
import { getAlertEventsFromId } from '../../../../rest/alertsAPI';
import { getChangeEventDataFromTypedEvent } from '../../../../utils/Alerts/AlertsUtilPure';
import { NextPreviousWithOffsetProps } from '../../../common/NextPreviousWithOffset/NextPreviousWithOffset.interface';
import AlertRecentEventsTab from './AlertRecentEventsTab';

let mockInitialPage = 1;

jest.mock('../../../../hooks/paging/usePaging', () => {
  const { useState } = jest.requireActual('react');

  return {
    usePaging: () => {
      const [paging, setPaging] = useState({});
      const [currentPage, setCurrentPage] = useState(mockInitialPage);

      return {
        currentPage,
        paging,
        pageSize: 5,
        handlePagingChange: setPaging,
        handlePageChange: setCurrentPage,
        handlePageSizeChange: jest.fn(),
        showPagination: true,
      };
    },
  };
});

jest.mock('../../../../rest/alertsAPI', () => ({
  getAlertEventsFromId: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TYPED_EVENT_LIST_RESPONSE)),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../common/NextPreviousWithOffset/NextPreviousWithOffset', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        currentPage,
        pageSize,
        pagingHandler,
      }: NextPreviousWithOffsetProps) => (
        <div>
          <span data-testid="current-page">{currentPage}</span>
          <button
            onClick={() =>
              pagingHandler({
                offset: currentPage * pageSize,
                page: currentPage + 1,
              })
            }>
            next
          </button>
        </div>
      )
    )
);

jest.mock('../../../Database/SchemaEditor/SchemaEditor', () =>
  jest.fn().mockImplementation(() => <div>SchemaEditor</div>)
);

const mockGetEvents = getAlertEventsFromId as jest.Mock;

describe('AlertRecentEventsTab', () => {
  beforeEach(() => {
    mockInitialPage = 1;
    mockGetEvents.mockClear();
  });

  it('should render the component', async () => {
    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    expect(screen.getByText('label.description:')).toBeInTheDocument();
    expect(
      screen.getByText('message.alert-recent-events-description')
    ).toBeInTheDocument();

    expect(screen.getByTestId('recent-events-list')).toBeInTheDocument();
  });

  it('should display loading skeletons when loading', async () => {
    render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);

    expect(await screen.findAllByTestId('skeleton-loading-panel')).toHaveLength(
      5
    );
  });

  it('should display empty placeholder when no data is available', async () => {
    (getAlertEventsFromId as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: [] })
    );

    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
  });

  it('should display recent events list', async () => {
    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    expect(screen.getByTestId('recent-events-list')).toBeInTheDocument();
  });

  it('expands events by keyboard and allows multiple event details to stay open', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const [firstEvent, secondEvent] = MOCK_TYPED_EVENT_LIST_RESPONSE.data;
    const firstId =
      getChangeEventDataFromTypedEvent(firstEvent).changeEventData.id;
    const secondId =
      getChangeEventDataFromTypedEvent(secondEvent).changeEventData.id;

    if (!firstId || !secondId) {
      throw new Error('Event fixtures must include IDs');
    }

    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });
    const firstHeader = screen.getByRole('button', {
      name: new RegExp(firstId),
    });
    act(() => firstHeader.focus());

    await user.keyboard('{Enter}');

    expect(screen.getByTestId(`event-details-${firstId}`)).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: new RegExp(secondId) })
    );

    expect(screen.getByTestId(`event-details-${firstId}`)).toBeVisible();
    expect(screen.getByTestId(`event-details-${secondId}`)).toBeVisible();
  });

  it('should handle filter change', async () => {
    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    const filterButton = screen.getByTestId('filter-button');
    fireEvent.click(filterButton);

    const filterOption = await screen.findByText('label.successful');
    fireEvent.click(filterOption);

    expect(await screen.findByTestId('applied-filter-text')).toHaveTextContent(
      ': label.successful'
    );
    expect(filterButton).toHaveAccessibleName(
      'label.filter-plural : label.successful'
    );
  });

  it('should go back to the first page when the filter changes', async () => {
    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    fireEvent.click(screen.getByText('next'));
    fireEvent.click(await screen.findByText('next'));

    expect(await screen.findByTestId('current-page')).toHaveTextContent('3');

    fireEvent.click(screen.getByTestId('filter-button'));
    fireEvent.click(await screen.findByText('label.failed'));

    expect(await screen.findByTestId('current-page')).toHaveTextContent('1');

    await waitFor(() =>
      expect(mockGetEvents).toHaveBeenLastCalledWith({
        id: mockAlertDetails.id,
        params: { limit: 5, paginationOffset: 0, status: Status.Failed },
      })
    );
  });

  it('should fetch the next page by offset', async () => {
    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    fireEvent.click(screen.getByText('next'));

    await waitFor(() =>
      expect(mockGetEvents).toHaveBeenLastCalledWith({
        id: mockAlertDetails.id,
        params: { limit: 5, paginationOffset: 5 },
      })
    );
  });

  it('should load the page restored from the URL', async () => {
    mockInitialPage = 3;

    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    expect(mockGetEvents).toHaveBeenCalledTimes(1);
    expect(mockGetEvents).toHaveBeenCalledWith({
      id: mockAlertDetails.id,
      params: { limit: 5, paginationOffset: 10 },
    });
  });

  it('should fall back to the first page when the URL page is past the end', async () => {
    mockInitialPage = 99;
    mockGetEvents.mockImplementationOnce(() =>
      Promise.resolve({ data: [], paging: { total: 3 } })
    );

    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    expect(mockGetEvents).toHaveBeenLastCalledWith({
      id: mockAlertDetails.id,
      params: { limit: 5, paginationOffset: 0 },
    });
    expect(screen.getByTestId('current-page')).toHaveTextContent('1');
    expect(screen.getByTestId('recent-events-list')).toBeInTheDocument();
  });

  it('should ignore a response that arrives after a newer request', async () => {
    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    let resolveStale: (value: unknown) => void = jest.fn();
    mockGetEvents.mockImplementationOnce(
      () => new Promise((resolve) => (resolveStale = resolve))
    );

    fireEvent.click(screen.getByText('next'));
    fireEvent.click(screen.getByTestId('filter-button'));
    fireEvent.click(await screen.findByText('label.failed'));

    expect(await screen.findByTestId('recent-events-list')).toBeInTheDocument();

    await act(async () => {
      resolveStale({
        data: [{ status: Status.Failed, data: [], timestamp: 1700000000001 }],
        paging: { offset: 5 },
      });
    });

    expect(screen.getByTestId('current-page')).toHaveTextContent('1');
    expect(
      screen.queryByTestId('event-collapse-unreadable-failed-1700000000001')
    ).not.toBeInTheDocument();
  });

  it('renders an unreadable (empty-data) row without crashing the page', async () => {
    (getAlertEventsFromId as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [
          {
            status: Status.Failed,
            data: [],
            timestamp: 1700000000001,
          },
          ...MOCK_TYPED_EVENT_LIST_RESPONSE.data,
        ],
        paging: { offset: 0 },
      })
    );

    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    // The unreadable row degrades gracefully into a header keyed by the
    // fallback id `unreadable-<status>-<timestamp>`.
    expect(
      await screen.findByTestId(
        'event-collapse-unreadable-failed-1700000000001'
      )
    ).toBeInTheDocument();

    // The header shows a translated label, not the synthetic fallback id.
    expect(screen.getByText('label.unreadable-event')).toBeInTheDocument();
    expect(
      screen.queryByText('unreadable-failed-1700000000001')
    ).not.toBeInTheDocument();

    // The readable rows still render their headers too.
    expect(screen.getByTestId('recent-events-list')).toBeInTheDocument();

    // No global 500 fallback is rendered.
    expect(screen.queryByText('500')).not.toBeInTheDocument();
  });
});
