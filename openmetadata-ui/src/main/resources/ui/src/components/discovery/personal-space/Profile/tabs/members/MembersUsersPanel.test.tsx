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
import { MemoryRouter } from 'react-router-dom';

const mockGetUsers = jest.fn().mockResolvedValue({
  data: [
    {
      id: '1',
      name: 'user1',
      displayName: 'User One',
      fullyQualifiedName: 'user1',
      teams: [],
      roles: [],
    },
  ],
  paging: { total: 1 },
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('../../../../../../rest/userAPI', () => ({
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
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

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true }),
}));

import MembersUsersPanel from './MembersUsersPanel';

const renderComponent = (isAdmin = false) =>
  render(
    <MemoryRouter>
      <MembersUsersPanel isAdmin={isAdmin} onNavigate={jest.fn()} />
    </MemoryRouter>
  );

describe('MembersUsersPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the users list container', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('users-list-container')).toBeInTheDocument();
    });
  });

  it('calls getUsers on mount', async () => {
    renderComponent();

    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalled();
    });
  });

  it('renders table element', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('users-list-table')).toBeInTheDocument();
    });
  });

  // Regression: the add-user button is published as a header action and the
  // parent no longer clears it, so the panel must set it for an admin and clear
  // it itself on unmount.
  it('publishes the add-user header action for an admin and clears it on unmount', async () => {
    const onSetHeader = jest.fn();
    const { unmount } = render(
      <MemoryRouter>
        <MembersUsersPanel
          isAdmin
          onNavigate={jest.fn()}
          onSetHeader={onSetHeader}
        />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(
        onSetHeader.mock.calls.some(([patch]) => Boolean(patch?.actions))
      ).toBe(true)
    );

    unmount();

    expect(onSetHeader).toHaveBeenLastCalledWith({ actions: undefined });
  });
});
