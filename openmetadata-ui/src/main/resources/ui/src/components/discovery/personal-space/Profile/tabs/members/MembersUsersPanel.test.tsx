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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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

const mockRestoreUser = jest.fn().mockResolvedValue({});
const mockDeleteEntity = jest.fn();

jest.mock('../../../../../../rest/userAPI', () => ({
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
  restoreUser: (...args: unknown[]) => mockRestoreUser(...args),
}));

jest.mock('../../../../../../rest/miscAPI', () => ({
  deleteEntity: (...args: unknown[]) => mockDeleteEntity(...args),
}));

jest.mock('../../../../../../hooks/useApplicationStore', () => {
  const state = {
    currentUser: { id: 'me', name: 'admin' },
    userProfilePics: { user1: { name: 'user1', displayName: 'User One' } },
    updateUserProfilePics: jest.fn(),
  };

  return {
    useApplicationStore: Object.assign(
      (selector?: (s: unknown) => unknown) =>
        selector ? selector(state) : state,
      { getState: () => state }
    ),
  };
});

jest.mock('../../../../../Auth/AuthProviders/AuthProvider', () => ({
  useAuthProvider: () => ({ onLogoutHandler: jest.fn() }),
}));

jest.mock(
  '../../../../../../context/AsyncDeleteProvider/AsyncDeleteProvider',
  () => ({
    useAsyncDeleteProvider: () => ({
      handleOnAsyncEntityDeleteConfirm: jest.fn(),
    }),
  })
);

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
        resolvedPageSize: 15,
        savePageSize: jest.fn(),
        setPage: (...args: [number, ...unknown[]]) => {
          mockSetHashPage(...args);
          setPage(args[0]);
        },
      };
    },
  };
});

import MembersUsersPanel from './MembersUsersPanel';

const usersPage = (paging: Record<string, unknown>) => ({
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
  paging,
});

const renderComponent = (isAdmin = false) =>
  render(
    <MemoryRouter>
      <MembersUsersPanel isAdmin={isAdmin} onNavigate={jest.fn()} />
    </MemoryRouter>
  );

describe('MembersUsersPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUsers.mockResolvedValue(usersPage({ total: 1 }));
    mockDeleteEntity.mockResolvedValue({ status: 200, data: {} });
  });

  it('soft-deletes a user from the row popover and reloads the list', async () => {
    renderComponent();
    fireEvent.click(await screen.findByTestId('delete-user-btn-user1'));

    expect(
      screen.getByTestId('delete-user-popover-confirm')
    ).toBeInTheDocument();

    mockGetUsers.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-user-popover-confirm'));
    });

    expect(mockDeleteEntity).toHaveBeenCalledWith('users', '1', false, false);

    await waitFor(() => expect(mockGetUsers).toHaveBeenCalled());
  });

  it('keeps the delete popover open when the delete fails', async () => {
    mockDeleteEntity.mockRejectedValueOnce(new Error('boom'));
    renderComponent();
    fireEvent.click(await screen.findByTestId('delete-user-btn-user1'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-user-popover-confirm'));
    });

    expect(mockDeleteEntity).toHaveBeenCalledWith('users', '1', false, false);
    expect(screen.getByTestId('delete-user-popover')).toBeInTheDocument();
  });

  it('does not delete when the row popover is cancelled', async () => {
    renderComponent();
    fireEvent.click(await screen.findByTestId('delete-user-btn-user1'));
    fireEvent.click(screen.getByTestId('delete-user-popover-cancel'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('delete-user-popover')
      ).not.toBeInTheDocument()
    );

    expect(mockDeleteEntity).not.toHaveBeenCalled();
  });

  it('restores a deleted user from the row popover', async () => {
    renderComponent();
    fireEvent.click(await screen.findByTestId('show-deleted'));
    fireEvent.click(await screen.findByTestId('restore-user-btn-user1'));

    expect(
      screen.getByTestId('restore-user-popover-confirm')
    ).toHaveTextContent('label.restore');

    await act(async () => {
      fireEvent.click(screen.getByTestId('restore-user-popover-confirm'));
    });

    expect(mockRestoreUser).toHaveBeenCalledWith('1');
    expect(
      screen.queryByTestId('restore-user-popover')
    ).not.toBeInTheDocument();
  });

  it('keeps the restore popover open when the restore fails', async () => {
    mockRestoreUser.mockRejectedValueOnce(new Error('boom'));
    renderComponent();
    fireEvent.click(await screen.findByTestId('show-deleted'));
    fireEvent.click(await screen.findByTestId('restore-user-btn-user1'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('restore-user-popover-confirm'));
    });

    expect(mockRestoreUser).toHaveBeenCalledWith('1');
    expect(screen.getByTestId('restore-user-popover')).toBeInTheDocument();
  });

  it('pages forward with the next cursor from the Next button', async () => {
    mockGetUsers
      .mockResolvedValueOnce(usersPage({ after: 'cursor-2', total: 100 }))
      .mockResolvedValueOnce(usersPage({ before: 'cursor-1', total: 100 }));
    renderComponent(true);

    const next = await screen.findByTestId('next');

    await waitFor(() => expect(next).toBeEnabled());

    fireEvent.click(next);

    await waitFor(() =>
      expect(mockGetUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ after: 'cursor-2', isAdmin: true })
      )
    );

    await waitFor(() => expect(screen.getByTestId('previous')).toBeEnabled());

    // Only the page and size reach the URL; the cursor stays in state.
    expect(mockSetHashPage).toHaveBeenLastCalledWith(
      2,
      undefined,
      undefined,
      15
    );
  });

  it('goes back with the page-3 before cursor from the Previous button', async () => {
    mockGetUsers
      .mockResolvedValueOnce(usersPage({ after: 'cursor-2', total: 100 }))
      .mockResolvedValueOnce(
        usersPage({ after: 'cursor-3', before: 'before-2', total: 100 })
      )
      .mockResolvedValueOnce(
        usersPage({ after: 'cursor-4', before: 'before-3', total: 100 })
      )
      .mockResolvedValueOnce(
        usersPage({ after: 'cursor-3', before: 'before-2', total: 100 })
      );
    renderComponent();

    const next = await screen.findByTestId('next');
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);
    await waitFor(() => expect(mockGetUsers).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);
    await waitFor(() => expect(mockGetUsers).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByTestId('previous'));

    await waitFor(() =>
      expect(mockGetUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ before: 'before-3' })
      )
    );

    expect(mockSetHashPage).toHaveBeenLastCalledWith(
      2,
      undefined,
      undefined,
      15
    );
  });

  it('keeps the newest page when an older page responds last', async () => {
    const named = (name: string, paging: Record<string, unknown>) => ({
      ...usersPage(paging),
      data: [{ ...usersPage({}).data[0], id: name, name }],
    });
    const heldPageTwo: Array<(value: unknown) => void> = [];
    let pageTwoCalls = 0;
    mockGetUsers.mockImplementation(({ after }: { after?: string }) => {
      if (after === 'cursor-2') {
        pageTwoCalls++;

        // Page 2's own load hangs; the walk to page 3 gets an answer.
        return pageTwoCalls === 1
          ? new Promise((resolve) => heldPageTwo.push(resolve))
          : Promise.resolve(
              named('walk-user', { after: 'cursor-3', total: 100 })
            );
      }

      return Promise.resolve(
        after === 'cursor-3'
          ? named('page-three-user', { after: 'cursor-4', total: 100 })
          : named('page-one-user', { after: 'cursor-2', total: 100 })
      );
    });
    renderComponent();
    await screen.findByTestId('page-one-user');

    // Next stays clickable while page 2 loads, so page 3 is reached by walking.
    fireEvent.click(screen.getByTestId('next'));
    await waitFor(() => expect(pageTwoCalls).toBe(1));
    fireEvent.click(screen.getByTestId('next'));

    expect(await screen.findByTestId('page-three-user')).toBeInTheDocument();

    await act(async () =>
      heldPageTwo.forEach((resolve) =>
        resolve(named('page-two-user', { after: 'cursor-3', total: 100 }))
      )
    );

    expect(screen.getByTestId('page-three-user')).toBeInTheDocument();
    expect(screen.queryByTestId('page-two-user')).not.toBeInTheDocument();
    // The walk to page 3 asks only for cursors, not the row fields.
    expect(mockGetUsers).toHaveBeenCalledWith(
      expect.objectContaining({ after: 'cursor-2', fields: undefined })
    );
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

  it('shows the display name in the name column and the email beside it', async () => {
    renderComponent();

    const nameCell = await screen.findByTestId('user1');

    expect(nameCell).toHaveTextContent('User One');
    expect(screen.getByText('label.email')).toBeInTheDocument();
    expect(screen.queryByText('label.username')).not.toBeInTheDocument();
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
