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
import { deleteEntity } from '../../../../../../rest/miscAPI';
import {
  getTeams,
  getTeamsAssetCounts,
  patchTeamDetail,
} from '../../../../../../rest/teamsAPI';
import { renderWithQueryClient } from '../../../../../../test/unit/test-utils';
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

jest.mock('../../../../../common/Table/TableV2', () =>
  jest.fn(({ 'data-testid': testId }: { 'data-testid'?: string }) => (
    <div data-testid={testId ?? 'table'} />
  ))
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

      await act(async () => {
        fireEvent.click(screen.getByTestId('delete-team-popover-hard-delete'));
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
