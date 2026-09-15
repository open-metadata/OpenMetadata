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
import { TeamsPageTab } from './team.interface';
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

let mockLocationSearch = '';
jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: () => ({ search: mockLocationSearch }),
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

const mockGetTabs = jest.fn().mockReturnValue([]);
jest.mock('./TeamDetailsV1.utils', () => ({
  getTabs: (...args: unknown[]) => mockGetTabs(...args),
}));

jest.mock('../../../common/EntityPageInfos/ManageButton/ManageButton', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        extraDropdownContent,
        canDelete,
      }: {
        extraDropdownContent?: unknown[];
        canDelete?: boolean;
      }) => (
        <div data-can-delete={String(canDelete)} data-testid="manage-button">
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
jest.mock('../../../common/EntityDescription/Description', () =>
  jest
    .fn()
    .mockImplementation(({ hasEditAccess }: { hasEditAccess?: boolean }) => (
      <div
        data-has-edit-access={String(hasEditAccess)}
        data-testid="description">
        Description
      </div>
    ))
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

  it('should hide the import option when Create permission is missing', async () => {
    renderComponent({
      entityPermissions: { Create: false } as OperationPermission,
    });

    expect(await screen.findByTestId('export-button')).toBeInTheDocument();
    expect(screen.queryByTestId('import-button')).not.toBeInTheDocument();
  });
});

describe('TeamDetailsV1 default tab selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTabs.mockReturnValue([]);
    mockLocationSearch = '';
  });

  it('should default to the first tab in the list when teamType is inconsistent with the tab list', async () => {
    mockGetTabs.mockReturnValue([
      { name: 'label.team-plural', key: TeamsPageTab.TEAMS },
    ]);

    // Corrupted data shape: root team named Organization but typed Group.
    // The old teamType-based default picked the Users tab, which is not in
    // the tab list, rendering no tab pane at all.
    renderComponent({
      currentTeam: {
        ...ORGANIZATION_TEAM,
        teamType: TeamType.Group,
      } as Team,
      childTeams: [ORGANIZATION_TEAM],
    });

    expect(await screen.findByText('TeamHierarchy')).toBeInTheDocument();
  });

  it('should default to the Users tab for a Group team', async () => {
    mockGetTabs.mockReturnValue([
      { name: 'label.user-plural', key: TeamsPageTab.USERS },
      { name: 'label.asset-plural', key: TeamsPageTab.ASSETS },
    ]);

    renderComponent({
      currentTeam: {
        ...ORGANIZATION_TEAM,
        name: 'group-team',
        teamType: TeamType.Group,
      } as Team,
    });

    expect(await screen.findByText('UserTab')).toBeInTheDocument();
  });

  it('should never fall back when an explicit activeTab is in the URL, even if it is not in the tab list yet', async () => {
    // Plugin-contributed tabs register asynchronously; an explicit URL tab
    // must be honored as-is rather than redirected while tabs populate.
    mockLocationSearch = '?activeTab=policies';
    mockGetTabs.mockReturnValue([
      { name: 'label.team-plural', key: TeamsPageTab.TEAMS },
    ]);

    renderComponent({ childTeams: [ORGANIZATION_TEAM] });

    expect(screen.queryByText('TeamHierarchy')).not.toBeInTheDocument();
  });
});

// Task 8 Batch 3: entityPermissions.EditAll -> canEditAll (getDerivedPermissionFlags).
// A non-organization team is required to exercise the ManageButton branch — the
// Organization team always uses the unconditional (EditAll-independent) branch.
const NON_ORG_TEAM = {
  ...ORGANIZATION_TEAM,
  id: 'non-org-team-id',
  name: 'engineering',
  fullyQualifiedName: 'engineering',
  teamType: TeamType.Department,
} as unknown as Team;

describe('TeamDetailsV1 ManageButton canEditAll wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides the ManageButton for a non-organization team when EditAll is false', async () => {
    renderComponent({
      currentTeam: NON_ORG_TEAM,
      entityPermissions: { EditAll: false } as OperationPermission,
    });

    await screen.findByText('TeamsHeadingLabel');

    expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument();
  });

  it('shows the ManageButton with canDelete=true for a non-organization team when EditAll is true', async () => {
    renderComponent({
      currentTeam: NON_ORG_TEAM,
      entityPermissions: { EditAll: true } as OperationPermission,
    });

    expect(await screen.findByTestId('manage-button')).toHaveAttribute(
      'data-can-delete',
      'true'
    );
  });

  // Task 8 Batch 3 review round, Finding 1 (Critical): the ManageButton hosts the ONLY UI
  // path to restore a soft-deleted team (`restore-team-dropdown`). Gating its render/canDelete
  // on the deleted-gated `canEditAll` makes it disappear entirely for a deleted team, admins
  // included, with no way back — old code read raw, ungated `entityPermissions.EditAll` here.
  // Fixed via a second, ungated derivation (`ungatedFlags.canEditAll`) rather than a raw read.
  it('keeps the ManageButton (and its restore option) reachable for a deleted team when EditAll is true', async () => {
    renderComponent({
      currentTeam: { ...NON_ORG_TEAM, deleted: true },
      entityPermissions: { EditAll: true } as OperationPermission,
    });

    expect(await screen.findByTestId('manage-button')).toHaveAttribute(
      'data-can-delete',
      'true'
    );
    expect(screen.getByTestId('restore-team-dropdown')).toBeInTheDocument();
  });
});

// Task 8 Batch 3: editDescriptionPermission's raw
// `(entityPermissions.EditAll || entityPermissions.EditDescription) && !isTeamDeleted`
// -> canEditDescription (getDerivedPermissionFlags). Documented explicit-deny-wins
// behavior change: an explicit `EditDescription: false` now wins over `EditAll: true`,
// where the old raw OR granted access regardless (same pattern as CommonWidgets /
// QuickLinkFormModal in Task 8 Batch 2).
describe('TeamDetailsV1 description hasEditAccess wiring (explicit-deny-wins)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grants edit access via EditAll when EditDescription is not present', async () => {
    renderComponent({
      entityPermissions: { EditAll: true } as OperationPermission,
    });

    expect(await screen.findByTestId('description')).toHaveAttribute(
      'data-has-edit-access',
      'true'
    );
  });

  it('denies edit access when EditDescription is explicitly false, even with EditAll true', async () => {
    renderComponent({
      entityPermissions: {
        EditAll: true,
        EditDescription: false,
      } as OperationPermission,
    });

    expect(await screen.findByTestId('description')).toHaveAttribute(
      'data-has-edit-access',
      'false'
    );
  });
});

// Task 8 Batch 3 review round, Finding 2 (Important): AssignErrorPlaceHolder hard-branches
// on its `permission` prop (`if (!permission) return <PermissionErrorPlaceholder />`),
// replacing the whole assign-roles/policies UI (including the separately-disabled Add button)
// with a misleading "no access" message. Old code passed raw, ungated `entityPermissions.EditAll`
// here — a deleted team's admin saw a disabled Add button with a tooltip, not "no access".
// Fixed via `ungatedFlags.canEditAll` instead of the deleted-gated `canEditAll`.
describe('TeamDetailsV1 rolesTabRender/policiesTabRender permission gate (ungated for deleted teams)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationSearch = '?activeTab=roles';
    mockGetTabs.mockReturnValue([
      { name: 'label.role-plural', key: TeamsPageTab.ROLES },
    ]);
  });

  it('shows the assign-roles UI (not the no-access placeholder) for a deleted team when EditAll is true', async () => {
    renderComponent({
      currentTeam: { ...NON_ORG_TEAM, deleted: true },
      entityPermissions: { EditAll: true } as OperationPermission,
    });

    expect(
      await screen.findByTestId('add-placeholder-button')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('permission-error-placeholder')
    ).not.toBeInTheDocument();
    // The Add action itself stays disabled independently via its own isTeamDeleted check.
    expect(screen.getByTestId('add-placeholder-button')).toBeDisabled();
  });

  it('shows the no-access placeholder for a non-deleted team when EditAll is false', async () => {
    renderComponent({
      currentTeam: NON_ORG_TEAM,
      entityPermissions: { EditAll: false } as OperationPermission,
    });

    expect(
      await screen.findByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
  });
});
