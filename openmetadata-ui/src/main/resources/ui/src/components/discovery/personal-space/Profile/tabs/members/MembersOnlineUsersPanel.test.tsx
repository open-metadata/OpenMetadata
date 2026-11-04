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

const mockSearchQuery = jest.fn().mockResolvedValue({
  hits: { hits: [], total: { value: 0 } },
});

jest.mock('../../../../../../rest/searchAPI', () => ({
  searchQuery: (...args: unknown[]) => mockSearchQuery(...args),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/Table/TableV2', () =>
  jest.fn(
    ({
      'data-testid': testId,
      extraTableFilters,
      searchProps,
    }: {
      'data-testid'?: string;
      extraTableFilters?: React.ReactNode;
      searchProps?: { onSearch?: (value: string) => void };
    }) => (
      <div data-testid={testId ?? 'table'}>
        {extraTableFilters}
        <button
          aria-label="search"
          data-testid="mock-search"
          type="button"
          onClick={() => searchProps?.onSearch?.('ali')}
        />
      </div>
    )
  )
);

const mockSetHashPage = jest.fn();

// Stateful stand-in for the settings-hash pager: jsdom has no settings hash, so
// record what would be written to the URL and keep the page in state.
jest.mock('../../../../../../hooks/useSettingsHash', () => {
  const { useState } = jest.requireActual('react');

  return {
    useSettingsHash: () => ({ goTo: jest.fn() }),
    useHashPagingParams: () => {
      const [page, setPage] = useState(1);

      return {
        page,
        pageSize: undefined,
        setPage: (...args: [number, ...unknown[]]) => {
          mockSetHashPage(...args);
          setPage(args[0]);
        },
      };
    },
  };
});

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

  it('searches users by partial name with wildcards', async () => {
    renderPanel();

    fireEvent.click(await screen.findByTestId('mock-search'));

    await waitFor(() =>
      expect(mockSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ query: '*ali*', searchIndex: 'user' })
      )
    );
  });

  it('pages with the cursor but writes only page and size to the URL', async () => {
    mockGetOnlineUsers
      .mockResolvedValueOnce({ data: [], paging: { after: 'c2', total: 40 } })
      .mockResolvedValueOnce({ data: [], paging: { before: 'c1', total: 40 } });
    renderPanel();

    const next = await screen.findByTestId('next');
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);

    await waitFor(() =>
      expect(mockGetOnlineUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ after: 'c2' })
      )
    );

    // Only the page and size reach the URL; the cursor stays in state.
    expect(mockSetHashPage).toHaveBeenLastCalledWith(
      2,
      undefined,
      undefined,
      15
    );
  });

  it('calls getOnlineUsers on mount', async () => {
    renderPanel();

    await waitFor(() => {
      expect(mockGetOnlineUsers).toHaveBeenCalled();
    });
  });
});
