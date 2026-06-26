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
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Team, TeamType } from '../../../../generated/entity/teams/team';
import TeamDetailsV1 from './TeamDetailsV1';
import { TeamDetailsProp } from './TeamDetailsV1.interface';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true }),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'admin-id' } }),
}));

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: () => ({ search: '' }),
}));

jest.mock(
  '../../Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      extensionRegistry: { getContributions: () => [] },
    }),
  })
);

const mockShowModal = jest.fn();
jest.mock(
  '../../../Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: () => ({ showModal: mockShowModal }),
  })
);

jest.mock('./TeamDetailsV1.utils', () => ({
  getTabs: () => [],
}));

jest.mock('../../../common/EntityPageInfos/ManageButton/ManageButton', () =>
  jest
    .fn()
    .mockImplementation(
      ({ extraDropdownContent }: { extraDropdownContent?: unknown[] }) => (
        <div data-testid="manage-button">
          {(extraDropdownContent as { key: string }[] | undefined)?.map(
            (item) => (
              <div data-testid={item.key} key={item.key} />
            )
          )}
        </div>
      )
    )
);

jest.mock('./TeamsHeaderSection/TeamsHeadingLabel.component', () =>
  jest.fn().mockImplementation(() => <div>TeamsHeadingLabel</div>)
);
jest.mock('./TeamsHeaderSection/TeamsInfo.component', () =>
  jest.fn().mockImplementation(() => <div>TeamsInfo</div>)
);
jest.mock('../../../common/EntityDescription/DescriptionV1', () =>
  jest.fn().mockImplementation(() => <div>DescriptionV1</div>)
);
jest.mock('../../../common/TitleBreadcrumb/TitleBreadcrumb.component', () =>
  jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>)
);
jest.mock('../../../Learning/LearningIcon/LearningIcon.component', () => ({
  LearningIcon: jest.fn().mockImplementation(() => <div>LearningIcon</div>),
}));
jest.mock('../../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);
jest.mock('./RolesAndPoliciesList', () =>
  jest.fn().mockImplementation(() => <div>ListEntities</div>)
);
jest.mock('./TeamHierarchy', () =>
  jest.fn().mockImplementation(() => <div>TeamHierarchy</div>)
);
jest.mock('./UserTab/UserTab.component', () => ({
  UserTab: jest.fn().mockImplementation(() => <div>UserTab</div>),
}));
jest.mock('../../../Glossary/GlossaryTerms/tabs/AssetsTabs.component', () =>
  jest.fn().mockImplementation(() => <div>AssetsTabs</div>)
);
jest.mock(
  '../../../Explore/EntitySummaryPanel/EntitySummaryPanel.component',
  () => jest.fn().mockImplementation(() => <div>EntitySummaryPanel</div>)
);
jest.mock(
  '../../../../pages/RolesPage/AddAttributeModal/AddAttributeModal',
  () => jest.fn().mockImplementation(() => <div>AddAttributeModal</div>)
);

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { hits: [], total: 0 } }),
}));
jest.mock('../../../../rest/teamsAPI', () => ({
  exportTeam: jest.fn(),
  restoreTeam: jest.fn(),
}));

const ORGANIZATION_TEAM = {
  id: 'org-id',
  name: 'Organization',
  fullyQualifiedName: 'Organization',
  teamType: TeamType.Organization,
  children: [],
  childrenCount: 0,
  userCount: 0,
  users: [],
} as unknown as Team;

const defaultProps: TeamDetailsProp = {
  assetsCount: 0,
  currentTeam: ORGANIZATION_TEAM,
  isTeamMemberLoading: 0,
  isFetchingAdvancedDetails: false,
  isFetchingAllTeamAdvancedDetails: false,
  isTeamBasicDataLoading: false,
  entityPermissions: { Create: true } as OperationPermission,
  childTeams: [],
  parentTeams: [],
  showDeletedTeam: false,
  handleAddTeam: jest.fn(),
  onDescriptionUpdate: jest.fn().mockResolvedValue(undefined),
  updateTeamHandler: jest.fn().mockResolvedValue(undefined),
  handleAddUser: jest.fn().mockResolvedValue(undefined),
  afterDeleteAction: jest.fn(),
  removeUserFromTeam: jest.fn().mockResolvedValue(undefined),
  handleJoinTeamClick: jest.fn(),
  handleLeaveTeamClick: jest.fn().mockResolvedValue(undefined),
  onShowDeletedTeamChange: jest.fn(),
  onTeamExpand: jest.fn(),
};

const renderComponent = (props: Partial<TeamDetailsProp> = {}) =>
  render(
    <BrowserRouter>
      <TeamDetailsV1 {...defaultProps} {...props} />
    </BrowserRouter>
  );

describe('TeamDetailsV1 Import/Export permission gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show both export and import options when user has Create permission', async () => {
    renderComponent({
      entityPermissions: { Create: true } as OperationPermission,
    });

    expect(await screen.findByTestId('export-button')).toBeInTheDocument();
    expect(screen.getByTestId('import-button')).toBeInTheDocument();
  });

  it('should hide the import option for a non-admin user without Create permission', async () => {
    renderComponent({
      entityPermissions: { Create: false } as OperationPermission,
    });

    expect(await screen.findByTestId('export-button')).toBeInTheDocument();
    expect(screen.queryByTestId('import-button')).not.toBeInTheDocument();
  });
});
