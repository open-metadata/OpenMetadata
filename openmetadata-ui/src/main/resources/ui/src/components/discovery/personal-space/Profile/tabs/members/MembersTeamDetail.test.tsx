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

import { screen, waitFor } from '@testing-library/react';
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
  getTeams: jest.fn().mockResolvedValue({ data: [], paging: { total: 0 } }),
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

jest.mock(
  '../../../../../common/DomainLabel/DomainLabel.component',
  () => ({
    DomainLabel: () => <div data-testid="domain-label" />,
  })
);

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

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditor',
  () =>
    jest.fn().mockReturnValue(<div data-testid="rich-text-editor" />)
);

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    jest.fn().mockReturnValue(<div data-testid="rich-text-previewer" />)
);

jest.mock('../../../../../common/Loader/Loader', () => () => (
  <div data-testid="loader" />
));

jest.mock('../../../../../common/DeleteModal/DeleteModal', () => () => (
  <div data-testid="delete-modal" />
));

jest.mock('../../../../../common/Table/TableV2', () =>
  jest.fn(({ 'data-testid': testId }: { 'data-testid'?: string }) => (
    <div data-testid={testId ?? 'table'} />
  ))
);

import MembersTeamDetail from './MembersTeamDetail';

describe('MembersTeamDetail', () => {

  beforeEach(() => {
    jest.clearAllMocks();
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

});
