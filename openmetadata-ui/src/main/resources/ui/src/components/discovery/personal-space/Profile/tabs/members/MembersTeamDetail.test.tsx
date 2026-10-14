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

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithQueryClient } from '../../../../../../test/unit/test-utils';

const renderWithRouter = (ui: ReactElement) =>
  renderWithQueryClient(<MemoryRouter>{ui}</MemoryRouter>);

const mockGetTeamByName = jest.fn().mockResolvedValue({
  id: '1',
  name: 'engineering',
  displayName: 'Engineering',
  fullyQualifiedName: 'engineering',
  teamType: 'Department',
  description: 'The engineering team',
  userCount: 10,
  childrenCount: 2,
  users: [],
  children: [],
  defaultRoles: [],
  policies: [],
  domains: [],
  owners: [],
});

const mockGetTeams = jest
  .fn()
  .mockResolvedValue({ data: [], paging: { total: 0 } });

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: () => ({ permissions: {} }),
  })
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
  getTeamByName: (...args: unknown[]) => mockGetTeamByName(...args),
  patchTeamDetail: jest.fn().mockResolvedValue({}),
  getTeams: (...args: unknown[]) => mockGetTeams(...args),
  restoreTeam: jest.fn().mockResolvedValue({}),
  deleteUserFromTeam: jest.fn().mockResolvedValue({}),
  exportTeam: jest.fn().mockResolvedValue(''),
}));

jest.mock('../../../../../../rest/userAPI', () => ({
  getUsers: jest.fn().mockResolvedValue({ data: [], paging: { total: 0 } }),
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
    UserTeamSelectableList: () => <div data-testid="user-team-selectable" />,
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

jest.mock('../../../../../common/Table/TableV2', () =>
  jest.fn(
    ({
      'data-testid': testId,
      dataSource,
      extraTableFilters,
      searchProps,
    }: {
      'data-testid'?: string;
      dataSource?: { name: string }[];
      extraTableFilters?: React.ReactNode;
      searchProps?: { onSearch?: (value: string) => void };
    }) => (
      <div data-testid={testId ?? 'table'}>
        {searchProps && (
          <input
            aria-label="search"
            data-testid="table-search"
            onChange={(e) => searchProps.onSearch?.(e.target.value)}
          />
        )}
        {extraTableFilters}
        {dataSource?.map((row) => (
          <span key={row.name}>{row.name}</span>
        ))}
      </div>
    )
  )
);

import MembersTeamDetail from './MembersTeamDetail';

// Contributed team tabs (e.g. Collate's SQL Studio) come through this provider;
// default to none so only the native tabs are asserted.
const mockGetContributions = jest.fn().mockReturnValue([]);
jest.mock(
  '../../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      getContributions: mockGetContributions,
    }),
  })
);

describe('MembersTeamDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetContributions.mockReturnValue([]);
  });

  it('renders team detail after loading', async () => {
    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('team-detail')).toBeInTheDocument();
    });
  });

  it('calls getTeamByName with the fqn', async () => {
    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    await waitFor(() => {
      expect(mockGetTeamByName).toHaveBeenCalledWith(
        'engineering',
        expect.any(Object)
      );
    });
  });

  it('renders info cards when team is loaded', async () => {
    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('team-info-widgets')).toBeInTheDocument();
    });
  });

  it('renders a contributed tab and passes it the team id', async () => {
    const PluginTab = jest
      .fn()
      .mockImplementation(({ teamId }: { teamId?: string }) => (
        <div data-testid="plugin-tab">{teamId}</div>
      ));
    mockGetContributions.mockReturnValue([
      { key: 'sql-studio', label: 'SQL Studio', component: PluginTab },
    ]);

    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    const tab = await screen.findByRole('tab', { name: 'SQL Studio' });

    fireEvent.click(tab);

    expect(await screen.findByTestId('plugin-tab')).toBeInTheDocument();
    expect(PluginTab).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: expect.any(String) }),
      expect.anything()
    );
  });

  it('renders the custom properties tab', async () => {
    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    expect(
      await screen.findByRole('tab', { name: /custom-property/ })
    ).toBeInTheDocument();
  });

  it('gives the tab body a scrollable block container', async () => {
    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    await screen.findByTestId('team-detail');

    const body = document.querySelector('.tw\\:overflow-y-auto.tw\\:py-4');

    // Measured in Chromium: as a flex container the tab content becomes a flex
    // item and shrinks to the container height, so scrollHeight never exceeds
    // clientHeight and `overflow-y-auto` has nothing to scroll. It must stay a
    // block, and must not grow its flex parent (`min-h-0`).
    expect(body).not.toHaveClass('tw:flex');
    expect(body).not.toHaveClass('tw:flex-col');
    expect(body).toHaveClass('tw:min-h-0');
    expect(body).toHaveClass('tw:flex-1');
    expect(body).toHaveClass('tw:w-full');
  });

  it('renders a contributed ReactNode label as-is', async () => {
    // `TabContribution.label` is `string | ReactNode`; an element label (icon +
    // text, a badge) must render, not be replaced by the contribution's key.
    mockGetContributions.mockReturnValue([
      {
        key: 'sql-studio',
        label: <span data-testid="plugin-tab-label">SQL Studio</span>,
        component: () => null,
      },
    ]);

    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    expect(await screen.findByTestId('plugin-tab-label')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'sql-studio' })).toBeNull();
  });

  describe('Organization sub-teams', () => {
    beforeEach(() => {
      mockGetTeamByName.mockResolvedValueOnce({
        id: 'org',
        name: 'Organization',
        fullyQualifiedName: 'Organization',
        teamType: 'Organization',
        users: [],
        defaultRoles: [],
        policies: [],
      });
      mockGetTeams.mockResolvedValue({
        data: [
          { name: 'finance', displayName: 'Finance' },
          { name: 'marketing', displayName: 'Marketing' },
        ],
        paging: { total: 2 },
      });
    });

    it('filters the sub-teams table by the search term', async () => {
      renderWithRouter(
        <MembersTeamDetail fqn="Organization" onNavigate={jest.fn()} />
      );

      const table = await screen.findByTestId('sub-teams-table');

      expect(await within(table).findByText('finance')).toBeInTheDocument();

      fireEvent.change(within(table).getByTestId('table-search'), {
        target: { value: 'fin' },
      });

      expect(within(table).getByText('finance')).toBeInTheDocument();
      expect(within(table).queryByText('marketing')).not.toBeInTheDocument();

      fireEvent.change(within(table).getByTestId('table-search'), {
        target: { value: 'non-existent-team-xyz' },
      });

      expect(within(table).queryByText('finance')).not.toBeInTheDocument();
    });

    it('refetches child teams including deleted ones when show-deleted is toggled', async () => {
      renderWithRouter(
        <MembersTeamDetail fqn="Organization" onNavigate={jest.fn()} />
      );

      const table = await screen.findByTestId('sub-teams-table');
      fireEvent.click(within(table).getByRole('switch'));

      await waitFor(() =>
        expect(mockGetTeams).toHaveBeenLastCalledWith(
          expect.objectContaining({
            parentTeam: 'Organization',
            include: 'deleted',
          })
        )
      );
    });
  });
});
