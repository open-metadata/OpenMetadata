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

/* Contract tests for the MembersUsersTab whole-team user search fix.
 *
 * The Members page (MembersTeamDetail → MembersUsersTab) user search must route
 * non-empty terms through the backend searchQuery API scoped to the team (and
 * its descendant teams) — not a client-side filter over a single cursor page —
 * mirroring the sibling MembersUsersPanel and the legacy UserTab. These tests
 * pin that contract: a backend SearchIndex.USER search is dispatched, the
 * queryFilter covers the team and its descendants (and excludes bots), an
 * off-page member surfaces in the rows, clearing reverts to the paginated
 * getUsers fetch, and paging while searching re-runs the search by page.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { renderWithQueryClient } from '../../../../../../test/unit/test-utils';

const renderWithRouter = (ui: ReactElement) =>
  renderWithQueryClient(<MemoryRouter>{ui}</MemoryRouter>);

// 30 members; page 1 holds u1..u15 and page 2 holds u16..u30. "User 20" (u20)
// lives on page 2, so a page-local filter can never surface it from page 1 —
// only a whole-team backend search can.
const PAGE1 = Array.from({ length: 15 }, (_, i) => ({
  id: `u${i + 1}`,
  name: `user${i + 1}`,
  displayName: `User ${i + 1}`,
  fullyQualifiedName: `user${i + 1}`,
  type: 'user',
  roles: [],
  teams: [],
  profile: {},
}));

const OFF_PAGE_MEMBER = {
  id: 'u20',
  name: 'user20',
  displayName: 'User 20',
  fullyQualifiedName: 'user20',
  type: 'user',
  roles: [],
  teams: [],
  profile: {},
};

const mockGetUsers = jest.fn();
const mockSearchQuery = jest.fn();

// Group team with a descendant team so descendant-teams scoping is assertable.
// Group's available tabs start at 'users', so the users tab auto-activates.
const TEAM = {
  id: 'team-1',
  name: 'engineering',
  displayName: 'Engineering',
  fullyQualifiedName: 'engineering',
  teamType: 'Group',
  description: 'The engineering team',
  userCount: 30,
  childrenCount: 0,
  users: [{ id: 'u1', type: 'user', name: 'user1' }],
  children: [],
  descendantTeams: [{ id: 'sub-group-1', type: 'team', name: 'sub-group-1' }],
  defaultRoles: [],
  policies: [],
  domains: [],
  owners: [],
  owns: [],
  parents: [],
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({ usePermissionProvider: () => ({ permissions: {} }) })
);

jest.mock(
  '../../../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: () => ({
      canEditAll: true,
      canEditDescription: true,
      canEditDisplayName: true,
      hasViewAccess: true,
      permissions: {},
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    }),
  })
);

jest.mock('../../../../../../rest/teamsAPI', () => ({
  getTeamByName: jest.fn().mockResolvedValue(TEAM),
  patchTeamDetail: jest.fn().mockResolvedValue({}),
  getTeams: jest.fn().mockResolvedValue({ data: [], paging: { total: 0 } }),
  restoreTeam: jest.fn().mockResolvedValue({}),
  deleteUserFromTeam: jest.fn().mockResolvedValue({}),
  exportTeam: jest.fn().mockResolvedValue(''),
}));

jest.mock('../../../../../../rest/userAPI', () => ({
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
}));

jest.mock('../../../../../../rest/searchAPI', () => ({
  searchQuery: (...args: unknown[]) => mockSearchQuery(...args),
}));

jest.mock('../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'me', teams: [] } }),
}));

jest.mock(
  '../../../../../Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: () => ({ showModal: jest.fn() }),
    EntityExportModalProvider: ({
      children,
    }: {
      children: React.ReactNode;
    }) => <>{children}</>,
  })
);

jest.mock('../../../../../common/DomainSelect/DomainSelect', () => ({
  __esModule: true,
  default: () => <div data-testid="domain-select" />,
}));
jest.mock('../../../../../common/PersonaSelect/PersonaSelect', () => ({
  __esModule: true,
  default: () => <div data-testid="persona-select" />,
}));
jest.mock(
  '../../../../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="user-team-selectable">{children}</div>
    ),
  })
);
jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));
jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () =>
  jest.fn().mockReturnValue(<div data-testid="rich-text-editor" />)
);
jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () => jest.fn().mockReturnValue(<div data-testid="rich-text-previewer" />)
);
jest.mock('../../../../../common/Loader/Loader', () => () => (
  <div data-testid="loader" />
));
jest.mock('../../../../../common/DeleteModal/DeleteModal', () => () => (
  <div data-testid="delete-modal" />
));

// Non-stub TableV2: renders a controlled search input that calls onSearch on
// change (no debounce, so the test is deterministic), plus each dataSource row
// so we can assert which members surface.
jest.mock('../../../../../common/Table/TableV2', () => {
  return jest.fn(
    ({
      dataSource,
      searchProps,
      'data-testid': testId,
    }: {
      dataSource?: Array<{
        id?: string;
        displayName?: string;
        name?: string;
      }>;
      searchProps?: {
        placeholder?: string;
        onSearch?: (v: string) => void;
        searchValue?: string;
      };
      'data-testid'?: string;
    }) => (
      <div data-testid={testId ?? 'table'}>
        {searchProps && (
          <input
            aria-label="search"
            data-testid="user-searchbar"
            placeholder={searchProps.placeholder}
            value={searchProps.searchValue ?? ''}
            onChange={(e: { target: { value: string } }) =>
              searchProps.onSearch?.(e.target.value)
            }
          />
        )}
        {dataSource?.filter(Boolean).map((row) => (
          <div data-testid={`user-row-${row.id}`} key={row.id}>
            {row.displayName ?? row.name ?? ''}
          </div>
        ))}
      </div>
    )
  );
});

// Expose the paginator's onPageChange through a button so we can drive
// paging during a search.
jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');

  return {
    ...actual,
    PaginationCardWithControls: ({
      onPageChange,
    }: {
      onPageChange?: (page: number) => void;
    }) => (
      <button
        data-testid="page-next"
        type="button"
        onClick={() => onPageChange?.(2)}>
        next
      </button>
    ),
  };
});

import MembersTeamDetail from './MembersTeamDetail';

const userSearchCalls = () =>
  mockSearchQuery.mock.calls.filter((call) => {
    const params = call[0] as { searchIndex?: SearchIndex };

    return params?.searchIndex === SearchIndex.USER;
  });

describe('MembersTeamDetail user search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUsers.mockResolvedValue({
      data: PAGE1,
      paging: { total: 30, after: 'cursor-page-2' },
    });
  });

  it('dispatches a backend SearchIndex.USER search scoped to the team and its descendant teams', async () => {
    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    await waitFor(() =>
      expect(screen.getByTestId('team-detail')).toBeInTheDocument()
    );
    // Group teams auto-activate the users tab (no 'teams' tab for Group).
    await waitFor(() =>
      expect(screen.getByTestId('team-users-table')).toBeInTheDocument()
    );
    await waitFor(() => expect(mockGetUsers).toHaveBeenCalled());

    const searchInput = screen.getByTestId('user-searchbar');
    await act(async () => {
      fireEvent.input(searchInput, { target: { value: 'User 20' } });
    });

    await waitFor(() => expect(userSearchCalls().length).toBeGreaterThan(0));

    const call = userSearchCalls()[0][0] as {
      query: string;
      searchIndex: SearchIndex;
      queryFilter: unknown;
    };

    // Wildcarded query, full team scope via SearchIndex.USER.
    expect(call.searchIndex).toBe(SearchIndex.USER);
    expect(call.query).toContain('User 20');
    expect(call.query.startsWith('*') && call.query.endsWith('*')).toBe(true);

    const queryFilter = JSON.stringify(call.queryFilter);

    // The team itself…
    expect(queryFilter).toContain(TEAM.id);
    // …and its descendant team are both in the teams.id terms clause.
    expect(queryFilter).toContain('sub-group-1');
    // The query must use a `terms` (IN) clause for teams.id, not per-id ANDed
    // `term` clauses (which would match a user in *every* listed team).
    expect(queryFilter).toContain('"teams.id"');
    // Search results should exclude bots, matching the non-search getUsers list.
    expect(queryFilter).toContain('isBot');
    expect(queryFilter).toContain('false');
  });

  it('surfaces an off-page member via the whole-team search (not just the loaded page)', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: { hits: [{ _source: OFF_PAGE_MEMBER }], total: { value: 1 } },
    });

    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    await waitFor(() =>
      expect(screen.getByTestId('team-users-table')).toBeInTheDocument()
    );
    await waitFor(() => expect(mockGetUsers).toHaveBeenCalled());

    // Off-page member is absent from page 1 (cursor-paginated getUsers).
    expect(screen.queryByTestId('user-row-u20')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.input(screen.getByTestId('user-searchbar'), {
        target: { value: 'User 20' },
      });
    });

    await waitFor(() => expect(userSearchCalls().length).toBeGreaterThan(0));
    // The backend search returns the off-page member, which now renders.
    await waitFor(() =>
      expect(screen.getByText('User 20')).toBeInTheDocument()
    );

    expect(screen.queryByTestId('user-row-u1')).not.toBeInTheDocument();
  });

  it('reverts to the cursor-paginated getUsers fetch (no user searchQuery) when the search term is cleared', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: { hits: [{ _source: OFF_PAGE_MEMBER }], total: { value: 1 } },
    });

    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    await waitFor(() =>
      expect(screen.getByTestId('team-users-table')).toBeInTheDocument()
    );
    await waitFor(() => expect(mockGetUsers).toHaveBeenCalled());
    const getUsersCallsBeforeSearch = mockGetUsers.mock.calls.length;

    await act(async () => {
      fireEvent.input(screen.getByTestId('user-searchbar'), {
        target: { value: 'User 20' },
      });
    });
    await waitFor(() => expect(userSearchCalls().length).toBeGreaterThan(0));

    // Clearing the term.
    await act(async () => {
      fireEvent.input(screen.getByTestId('user-searchbar'), {
        target: { value: '' },
      });
    });
    await waitFor(() =>
      expect(mockGetUsers.mock.calls.length).toBeGreaterThan(
        getUsersCallsBeforeSearch
      )
    );

    // No additional SearchIndex.USER search after clearing.
    expect(userSearchCalls().length).toBe(1);
  });

  it('re-runs the search by page number when paging during a search (no cursor restriction)', async () => {
    const searchHits = PAGE1.map((u) => ({ _source: u }));
    mockSearchQuery.mockResolvedValue({
      // 30 total results across two 15-row pages during the search.
      hits: { hits: searchHits, total: { value: 30 } },
    });

    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    await waitFor(() =>
      expect(screen.getByTestId('team-users-table')).toBeInTheDocument()
    );
    await waitFor(() => expect(mockGetUsers).toHaveBeenCalled());

    await act(async () => {
      fireEvent.input(screen.getByTestId('user-searchbar'), {
        target: { value: 'User' },
      });
    });
    await waitFor(() => expect(userSearchCalls().length).toBe(1));

    // Pagination is shown for the search (total 30 > pageSize 15) and a page
    // jump re-runs the search with the requested page number.
    await act(async () => {
      fireEvent.click(screen.getByTestId('page-next'));
    });
    await waitFor(() => expect(userSearchCalls().length).toBe(2));

    const secondCall = userSearchCalls()[1][0] as {
      pageNumber: number;
      query: string;
    };

    expect(secondCall.pageNumber).toBe(2);
    expect(secondCall.query).toContain('User');
  });
});
