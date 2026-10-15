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

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

const mockGetOnlineUsers = jest.fn().mockResolvedValue({
  data: [],
  paging: { total: 0 },
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('../../../../../../rest/userAPI', () => ({
  getOnlineUsers: (...args: unknown[]) => mockGetOnlineUsers(...args),
}));

jest.mock('../../../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: { hits: [], total: { value: 0 } },
  }),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../../hooks/paging/usePaging', () => ({
  usePaging: () => ({
    paging: { total: 0 },
    handlePagingChange: jest.fn(),
    currentPage: 1,
    handlePageChange: jest.fn(),
    pageSize: 10,
    handlePageSizeChange: jest.fn(),
    showPagination: false,
  }),
}));

jest.mock(
  '../../../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder',
  () => () => <div data-testid="filter-table-placeholder" />
);

jest.mock('../../../../../common/Table/TableV2', () =>
  jest.fn(
    ({
      'data-testid': testId,
      columns,
      extraTableFilters,
    }: {
      'data-testid'?: string;
      columns: { key: string; title: string }[];
      extraTableFilters?: React.ReactNode;
    }) => (
      <div data-testid={testId ?? 'table'}>
        {columns.map((col) => (
          <span key={col.key} role="columnheader">
            {col.title}
          </span>
        ))}
        {extraTableFilters}
      </div>
    )
  )
);

import MembersOnlineUsersPanel from './MembersOnlineUsersPanel';

const renderPanel = () =>
  render(
    <MemoryRouter>
      <MembersOnlineUsersPanel onNavigate={jest.fn()} />
    </MemoryRouter>
  );

describe('MembersOnlineUsersPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with time window select', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('time-window-select')).toBeInTheDocument();
    });
  });

  it('calls getOnlineUsers on mount', async () => {
    renderPanel();

    await waitFor(() => {
      expect(mockGetOnlineUsers).toHaveBeenCalled();
    });
  });

  it('renders the username and last-activity columns', async () => {
    renderPanel();

    expect(
      await screen.findByRole('columnheader', { name: 'label.username' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'label.last-activity' })
    ).toBeInTheDocument();
  });

  it('defaults to the last 24 hours window', async () => {
    renderPanel();

    await waitFor(() =>
      expect(mockGetOnlineUsers).toHaveBeenCalledWith(
        expect.objectContaining({ timeWindow: 1440 })
      )
    );

    expect(screen.getByTestId('time-window-select')).toHaveTextContent(
      'label.last-24-hours'
    );
  });

  it('refetches online users with the selected time window', async () => {
    renderPanel();

    fireEvent.click(
      within(screen.getByTestId('time-window-select')).getByRole('button')
    );
    fireEvent.click(
      await screen.findByRole('option', { name: 'label.last-hour' })
    );

    await waitFor(() =>
      expect(mockGetOnlineUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ timeWindow: 60 })
      )
    );
  });
});
