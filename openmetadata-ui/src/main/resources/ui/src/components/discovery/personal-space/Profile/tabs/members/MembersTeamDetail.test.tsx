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

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import React, { ReactElement, ReactNode, useCallback, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TabSpecificField } from '../../../../../../enums/entity.enum';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { deleteEntity } from '../../../../../../rest/miscAPI';
import { searchQuery } from '../../../../../../rest/searchAPI';
import {
  getTeams,
  getTeamsAssetCounts,
  patchTeamDetail,
} from '../../../../../../rest/teamsAPI';
import { renderWithQueryClient } from '../../../../../../test/unit/test-utils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import type { ColumnsType } from '../../../../../common/Table/Table.interface';
import Table from '../../../../../common/Table/TableV2';

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

let mockGlobalPermissions: Record<string, Record<string, boolean>> = {};

jest.mock('../../../../../../rest/miscAPI', () => ({
  deleteEntity: jest.fn().mockResolvedValue({ status: 200, data: {} }),
}));

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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: () => ({ permissions: mockGlobalPermissions }),
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
  getTeams: jest.fn().mockResolvedValue({ data: [], paging: { total: 0 } }),
  getTeamsAssetCounts: jest.fn().mockResolvedValue({}),
  restoreTeam: jest.fn().mockResolvedValue({}),
  deleteUserFromTeam: jest.fn().mockResolvedValue({}),
  exportTeam: jest.fn().mockResolvedValue(''),
}));

jest.mock('../../../../../../rest/userAPI', () => ({
  getUsers: jest.fn().mockResolvedValue({ data: [], paging: { total: 0 } }),
}));

jest.mock('../../../../../../rest/searchAPI', () => ({
  ...jest.requireActual('../../../../../../rest/searchAPI'),
  searchQuery: jest
    .fn()
    .mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
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

// Renders the table's search box so tab searches can be typed into.
jest.mock('../../../../../common/Table/TableV2', () =>
  jest.fn(
    ({
      'data-testid': testId,
      searchProps,
    }: {
      'data-testid'?: string;
      searchProps?: { onSearch?: (value: string) => void };
    }) => (
      <div data-testid={testId ?? 'table'}>
        {searchProps?.onSearch && (
          <input
            aria-label={`${testId}-search`}
            data-testid={`${testId}-search`}
            onChange={(event) => searchProps.onSearch?.(event.target.value)}
          />
        )}
      </div>
    )
  )
);

// Stands in for the shared list: one button saves a changed extension and
// echoes whether the save landed, as the list's editor would.
jest.mock(
  '../../customProperties/CustomPropertiesList',
  () =>
    ({
      onUpdate,
    }: {
      onUpdate: (ext: Record<string, unknown>) => Promise<boolean>;
    }) => {
      const [result, setResult] = React.useState('');

      return (
        <div>
          <button
            aria-label="save-extension"
            data-testid="save-extension"
            onClick={async () =>
              setResult(
                String(await onUpdate({ costCenter: 'CC-2', region: 'EU' }))
              )
            }
          />
          <span data-testid="save-result">{result}</span>
        </div>
      );
    }
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

// Renders the header actions the detail pushes up, like MembersPanel does.
const HeaderHarness = ({ onNavigate }: { onNavigate: jest.Mock }) => {
  const [actions, setActions] = useState<ReactNode>();
  const onSetHeader = useCallback(
    (patch: { actions?: ReactNode }) => setActions(patch.actions),
    []
  );

  return (
    <>
      {actions}
      <MembersTeamDetail
        fqn="engineering"
        onNavigate={onNavigate}
        onSetHeader={onSetHeader}
      />
    </>
  );
};

describe('MembersTeamDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetContributions.mockReturnValue([]);
    mockGlobalPermissions = {};
  });

  describe('delete from the team menu', () => {
    const openDeletePopover = async (onNavigate: jest.Mock) => {
      mockGlobalPermissions = { team: { Delete: true } };
      renderWithRouter(<HeaderHarness onNavigate={onNavigate} />);

      fireEvent.click(
        await screen.findByRole('button', { name: /open menu/i })
      );
      fireEvent.click(await screen.findByTestId('delete-team'));

      expect(
        await screen.findByTestId('delete-team-popover-title')
      ).toHaveTextContent('label.delete-entity');
    };

    it('soft-deletes the team recursively by default and returns to the teams list', async () => {
      const onNavigate = jest.fn();
      await openDeletePopover(onNavigate);

      await act(async () => {
        fireEvent.click(screen.getByTestId('delete-team-popover-confirm'));
      });

      expect(deleteEntity).toHaveBeenCalledWith('teams', '1', true, false);
      expect(onNavigate).toHaveBeenCalledWith({ type: 'teams' });
    });

    it('hard-deletes the team recursively from the secondary action', async () => {
      const onNavigate = jest.fn();
      await openDeletePopover(onNavigate);

      // Choose "Delete permanently", then confirm.
      fireEvent.click(screen.getByTestId('delete-team-popover-hard-delete'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('delete-team-popover-confirm'));
      });

      expect(deleteEntity).toHaveBeenCalledWith('teams', '1', true, true);
      expect(onNavigate).toHaveBeenCalledWith({ type: 'teams' });
    });

    it('keeps the popover open and stays on the team when the delete fails', async () => {
      (deleteEntity as jest.Mock).mockRejectedValueOnce(new Error('boom'));
      const onNavigate = jest.fn();
      await openDeletePopover(onNavigate);

      await act(async () => {
        fireEvent.click(screen.getByTestId('delete-team-popover-confirm'));
      });

      expect(deleteEntity).toHaveBeenCalled();
      expect(screen.getByTestId('delete-team-popover')).toBeInTheDocument();
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('keeps the team when the popover is cancelled', async () => {
      const onNavigate = jest.fn();
      await openDeletePopover(onNavigate);

      fireEvent.click(screen.getByTestId('delete-team-popover-cancel'));

      await waitFor(() =>
        expect(
          screen.queryByTestId('delete-team-popover')
        ).not.toBeInTheDocument()
      );

      expect(deleteEntity).not.toHaveBeenCalled();
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('remove a default role from the team', () => {
    const tableMock = Table as unknown as jest.Mock;
    const defaultTable = tableMock.getMockImplementation();

    // Render each row's actions cell so the remove confirmation is reachable.
    beforeEach(() => {
      tableMock.mockImplementation(
        ({
          columns,
          dataSource,
        }: {
          columns: ColumnsType<{ id: string }>;
          dataSource?: { id: string }[];
        }) => {
          const actions = columns.find((column) => column.key === 'actions');

          return (
            <div>
              {dataSource?.map((row) => (
                <div key={row.id}>
                  {actions?.render?.(undefined, row, 0) as ReactNode}
                </div>
              ))}
            </div>
          );
        }
      );
    });

    afterEach(() => tableMock.mockImplementation(defaultTable));

    const confirmRemove = async () => {
      mockGetTeamByName.mockResolvedValueOnce({
        ...(await mockGetTeamByName()),
        defaultRoles: [{ id: 'r1', name: 'DataSteward', type: 'role' }],
      });
      renderWithRouter(
        <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
      );
      fireEvent.click(
        await screen.findByRole('tab', { name: /label.role-plural/ })
      );
      fireEvent.click(await screen.findByTestId('remove-DataSteward'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('remove-from-team-popover-confirm'));
      });
    };

    it('patches the role out and closes the popover', async () => {
      await confirmRemove();

      expect(patchTeamDetail).toHaveBeenCalledWith('1', [
        expect.objectContaining({ op: 'remove', path: '/defaultRoles/0' }),
      ]);

      await waitFor(() =>
        expect(
          screen.queryByTestId('remove-from-team-popover')
        ).not.toBeInTheDocument()
      );
    });

    it('keeps the popover open when the patch fails', async () => {
      (patchTeamDetail as jest.Mock).mockRejectedValueOnce(new Error('boom'));
      await confirmRemove();

      expect(patchTeamDetail).toHaveBeenCalled();
      expect(
        screen.getByTestId('remove-from-team-popover')
      ).toBeInTheDocument();
    });
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

  it('lists sub-teams without their owned assets and reads asset counts from the counts endpoint', async () => {
    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    await waitFor(() => {
      expect(getTeams).toHaveBeenCalledWith(
        expect.objectContaining({ parentTeam: 'engineering' })
      );
    });

    (getTeams as jest.Mock).mock.calls.forEach(([params]) =>
      expect(params.fields).not.toContain(TabSpecificField.OWNS)
    );

    await waitFor(() => {
      expect(getTeamsAssetCounts).toHaveBeenCalled();
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

  it('scrolls the team detail as one page instead of squeezing the tab card', async () => {
    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );

    const detail = await screen.findByTestId('team-detail');

    // A scroller inside the detail bounded the tab card to the space under
    // the header, showing a page of sub-teams a few rows at a time.
    expect(detail).toHaveClass('tw:overflow-y-auto');
    expect(detail.querySelector('.tw\\:overflow-y-auto')).toBeNull();
  });

  describe('sub-team paging', () => {
    const subTeams = (count: number, prefix: string) =>
      Array.from({ length: count }, (_, index) => ({
        id: `${prefix}-${index}`,
        name: `${prefix}-${index}`,
        fullyQualifiedName: `${prefix}-${index}`,
      }));

    const firstPage = {
      data: subTeams(10, 'team'),
      paging: { after: 'cursor-2', total: 25 },
    };

    const latestSubTeamRows = () =>
      (Table as unknown as jest.Mock).mock.calls
        .filter(([props]) => props['data-testid'] === 'sub-teams-table')
        .pop()?.[0].dataSource as { name: string }[];

    it('loads ten sub-teams at a time and labels the tab with the full count', async () => {
      (getTeams as jest.Mock).mockResolvedValue(firstPage);
      renderWithRouter(
        <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
      );

      await waitFor(() =>
        expect(getTeams).toHaveBeenCalledWith(
          expect.objectContaining({ parentTeam: 'engineering', limit: 10 })
        )
      );

      expect(
        await screen.findByRole('tab', { name: /label.team-plural \(25\)/ })
      ).toBeInTheDocument();
    });

    it('opens the next page with the after cursor', async () => {
      (getTeams as jest.Mock).mockResolvedValue(firstPage);
      renderWithRouter(
        <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
      );

      fireEvent.click(await screen.findByTestId('next'));

      await waitFor(() =>
        expect(getTeams).toHaveBeenLastCalledWith(
          expect.objectContaining({ after: 'cursor-2', limit: 10 })
        )
      );
    });

    const searchHits = (teams: { name: string }[], total: number) => ({
      hits: {
        hits: teams.map((team) => ({ _source: team })),
        total: { value: total },
      },
    });

    it('finds a sub-team that is not on the loaded page through the team index', async () => {
      (getTeams as jest.Mock).mockResolvedValue(firstPage);
      (searchQuery as jest.Mock).mockResolvedValue(
        searchHits(subTeams(1, 'audit'), 1)
      );
      renderWithRouter(
        <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
      );
      await waitFor(() => expect(latestSubTeamRows()).toHaveLength(10));

      expect(latestSubTeamRows().map(({ name }) => name)).not.toContain(
        'audit-0'
      );

      fireEvent.change(await screen.findByTestId('sub-teams-table-search'), {
        target: { value: 'audit' },
      });

      await waitFor(() =>
        expect(latestSubTeamRows().map(({ name }) => name)).toEqual(['audit-0'])
      );

      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '*audit*',
          pageNumber: 1,
          pageSize: 10,
          searchIndex: SearchIndex.TEAM,
          queryFilter: {
            query: { bool: { must: [{ term: { 'parents.id': '1' } }] } },
          },
        })
      );
    });

    it('pages search results by number on the backend', async () => {
      (getTeams as jest.Mock).mockResolvedValue(firstPage);
      (searchQuery as jest.Mock).mockResolvedValue(
        searchHits(subTeams(10, 'sales'), 25)
      );
      renderWithRouter(
        <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
      );

      fireEvent.change(await screen.findByTestId('sub-teams-table-search'), {
        target: { value: 'sales' },
      });
      await waitFor(() => expect(searchQuery).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTestId('next'));

      await waitFor(() =>
        expect(searchQuery).toHaveBeenLastCalledWith(
          expect.objectContaining({ query: '*sales*', pageNumber: 2 })
        )
      );
    });

    it('goes back to the first cursor page when the search is cleared', async () => {
      (getTeams as jest.Mock).mockResolvedValue(firstPage);
      renderWithRouter(
        <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
      );
      const search = await screen.findByTestId('sub-teams-table-search');

      fireEvent.change(search, { target: { value: 'sales' } });
      await waitFor(() => expect(searchQuery).toHaveBeenCalled());
      const callsBeforeClear = (getTeams as jest.Mock).mock.calls.length;
      fireEvent.change(search, { target: { value: '' } });

      await waitFor(() =>
        expect(getTeams).toHaveBeenCalledTimes(callsBeforeClear + 1)
      );

      const [lastParams] = (getTeams as jest.Mock).mock.calls.at(-1);

      expect(lastParams).toEqual(expect.objectContaining({ limit: 10 }));
      expect(lastParams.after).toBeUndefined();
    });

    it('keeps the rows of the latest search when an earlier one answers late', async () => {
      (getTeams as jest.Mock).mockResolvedValue(firstPage);
      const firstSearch: { answer?: (value: unknown) => void } = {};
      (searchQuery as jest.Mock)
        .mockReturnValueOnce(
          new Promise((resolve) => {
            firstSearch.answer = resolve;
          })
        )
        .mockResolvedValueOnce(searchHits(subTeams(1, 'second'), 1));
      renderWithRouter(
        <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
      );
      const search = await screen.findByTestId('sub-teams-table-search');

      fireEvent.change(search, { target: { value: 'first' } });
      fireEvent.change(search, { target: { value: 'second' } });
      await waitFor(() =>
        expect(latestSubTeamRows().map(({ name }) => name)).toEqual([
          'second-0',
        ])
      );
      await act(async () => {
        firstSearch.answer?.(searchHits(subTeams(1, 'first'), 1));
      });

      expect(latestSubTeamRows().map(({ name }) => name)).toEqual(['second-0']);
    });

    it('reports a failed search and clears the rows', async () => {
      (getTeams as jest.Mock).mockResolvedValue(firstPage);
      (searchQuery as jest.Mock).mockRejectedValueOnce(
        new Error('search down')
      );
      renderWithRouter(
        <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
      );
      await waitFor(() => expect(latestSubTeamRows()).toHaveLength(10));

      fireEvent.change(await screen.findByTestId('sub-teams-table-search'), {
        target: { value: 'sales' },
      });

      await waitFor(() => expect(latestSubTeamRows()).toHaveLength(0));

      expect(showErrorToast).toHaveBeenCalled();
    });
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

  const openTeamCustomProperties = async () => {
    mockGetTeamByName.mockResolvedValueOnce({
      ...(await mockGetTeamByName()),
      description: 'Untouched',
      extension: { costCenter: 'CC-1', region: 'EU' },
    });
    renderWithRouter(
      <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
    );
    fireEvent.click(
      await screen.findByRole('tab', { name: /custom-property/ })
    );
    fireEvent.click(await screen.findByTestId('save-extension'));
  };

  it('saves a team custom property with extension-only patch operations', async () => {
    (patchTeamDetail as jest.Mock).mockResolvedValueOnce({ id: '1' });
    await openTeamCustomProperties();

    await waitFor(() =>
      expect(screen.getByTestId('save-result')).toHaveTextContent('true')
    );

    expect(patchTeamDetail).toHaveBeenCalledWith('1', [
      { op: 'replace', path: '/extension/costCenter', value: 'CC-2' },
    ]);
  });

  it('reports a failed team custom property save so the editor stays open', async () => {
    (patchTeamDetail as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await openTeamCustomProperties();

    await waitFor(() =>
      expect(screen.getByTestId('save-result')).toHaveTextContent('false')
    );
  });

  describe('opened with an activeTab hash param', () => {
    afterEach(() => {
      // Reset the shared settings-hash store while the hook is still mounted.
      act(() => {
        globalThis.location.hash = '';
        globalThis.dispatchEvent(new PopStateEvent('popstate'));
      });
    });

    it('opens on the contributed tab the hash names', async () => {
      mockGetContributions.mockReturnValue([
        {
          key: 'sql-studio',
          label: 'SQL Studio',
          component: () => <div data-testid="plugin-tab" />,
        },
      ]);
      globalThis.location.hash =
        '#members/teams/engineering?activeTab=sql-studio';

      renderWithRouter(
        <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
      );

      expect(await screen.findByTestId('plugin-tab')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'SQL Studio' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    // A tab click records itself in the hash; otherwise following the same
    // team link again leaves the hash unchanged and the link's tab is ignored.
    it('applies the linked tab again after another tab was chosen', async () => {
      mockGetContributions.mockReturnValue([
        {
          key: 'sql-studio',
          label: 'SQL Studio',
          component: () => <div data-testid="plugin-tab" />,
        },
      ]);
      const link = '#members/teams/engineering?activeTab=sql-studio';
      globalThis.location.hash = link;

      renderWithRouter(
        <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
      );
      await screen.findByTestId('plugin-tab');

      fireEvent.click(screen.getByRole('tab', { name: /label.team-plural/ }));

      expect(screen.getByRole('tab', { name: 'SQL Studio' })).toHaveAttribute(
        'aria-selected',
        'false'
      );

      // Following the same link again (or Back to it) brings the hash back.
      act(() => {
        globalThis.location.hash = link;
        globalThis.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(screen.getByRole('tab', { name: 'SQL Studio' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('stays on the default tab when the hash names no such tab', async () => {
      globalThis.location.hash = '#members/teams/engineering?activeTab=nope';

      renderWithRouter(
        <MembersTeamDetail fqn="engineering" onNavigate={jest.fn()} />
      );

      await screen.findByTestId('team-detail');

      expect(
        screen.getByRole('tab', { name: /label.team-plural/ })
      ).toHaveAttribute('aria-selected', 'true');
    });
  });
});
