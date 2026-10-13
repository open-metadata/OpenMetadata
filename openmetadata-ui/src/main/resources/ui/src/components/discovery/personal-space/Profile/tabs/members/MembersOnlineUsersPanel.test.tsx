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

import { render, screen, waitFor } from '@testing-library/react';
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
      extraTableFilters,
    }: {
      'data-testid'?: string;
      extraTableFilters?: React.ReactNode;
    }) => <div data-testid={testId ?? 'table'}>{extraTableFilters}</div>
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
});
