/*
 *  Copyright 2022 Collate.
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

import { act, render, screen } from '@testing-library/react';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { TabSpecificField } from '../../../enums/entity.enum';
import { getPolicyByName } from '../../../rest/rolesAPIV1';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { POLICY_DATA } from '../PoliciesData.mock';
import PoliciesDetailPage from './PoliciesDetailPage';

// PoliciesDetailPage now fetches its own permissions via useEntityPermissions (Task 8 Batch 9)
// rather than an imperative usePermissionProvider().getEntityPermissionByFqn call — mock the
// hook directly, mirroring RolesDetailPage.test.tsx's sibling conversion.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = {},
  {
    isLoading = false,
    error = null as unknown,
  }: { isLoading?: boolean; error?: unknown } = {}
) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading,
    error,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

jest.mock('../../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({ fqn: 'policy' }),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

jest.mock('../../../rest/rolesAPIV1', () => ({
  getPolicyByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(POLICY_DATA)),
  getRoleByName: jest.fn().mockImplementation(() => Promise.resolve()),
  patchPolicy: jest.fn().mockImplementation(() => Promise.resolve()),
  patchRole: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../rest/teamsAPI', () => ({
  getTeamByName: jest.fn().mockImplementation(() => Promise.resolve()),
  patchTeamDetail: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../components/common/EntityDescription/Description', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="description-data">Description</div>)
);

jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => jest.fn().mockReturnValue(<div>ErrorPlaceholder</div>)
);

jest.mock(
  '../../../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () => jest.fn().mockReturnValue(<div data-testid="previewer">Previewer</div>)
);

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () =>
    jest.fn().mockReturnValue(<div data-testid="breadcrumb">BreadCrumb</div>)
);

jest.mock('../../../components/common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock(
  '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component',
  () => jest.fn().mockReturnValue(<div>EntityHeaderTitle</div>)
);

const mockManageButton = jest.fn().mockReturnValue(<div>ManageButton</div>);
jest.mock(
  '../../../components/common/EntityPageInfos/ManageButton/ManageButton',
  () => jest.fn().mockImplementation((props) => mockManageButton(props))
);

jest.mock('../../../constants/HelperTextUtil', () => ({
  NO_PERMISSION_FOR_ACTION: '',
  NO_PERMISSION_TO_VIEW: '',
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue(''),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getAddPolicyRulePath: jest.fn(),
  getEditPolicyRulePath: jest.fn(),
  getRoleWithFqnPath: jest.fn(),
  getSettingPath: jest.fn(),
  getTeamsWithFqnPath: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockReturnValue(''),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (label: string) => label,
  }),
}));

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

describe('Test Policy details page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions({ ViewBasic: true, EditAll: true, Delete: true });
    (getPolicyByName as jest.Mock).mockImplementation(() =>
      Promise.resolve(POLICY_DATA)
    );
  });

  it('Should render the policy details page component', async () => {
    await act(async () => {
      render(<PoliciesDetailPage />);
    });

    expect(getPolicyByName).toHaveBeenCalledWith(
      'policy',
      `${TabSpecificField.OWNERS},${TabSpecificField.LOCATION},${TabSpecificField.TEAMS},${TabSpecificField.ROLES}`
    );

    const container = await screen.findByTestId('policy-details-container');

    const breadCrumb = await screen.findByTestId('breadcrumb');

    const description = await screen.findByTestId('description-data');

    const rulesTab = await screen.findByText('label.rule-plural');

    const rolesTab = await screen.findByText('label.role-plural');

    const teamsTab = await screen.findByText('label.team-plural');

    expect(container).toBeInTheDocument();

    expect(breadCrumb).toBeInTheDocument();

    expect(description).toBeInTheDocument();

    expect(rulesTab).toBeInTheDocument();

    expect(rolesTab).toBeInTheDocument();

    expect(teamsTab).toBeInTheDocument();
  });

  it('Should render the rule card and its attributes', async () => {
    await act(async () => {
      render(<PoliciesDetailPage />);
    });

    const ruleCard = await screen.findByTestId('rule-card');

    const ruleName = await screen.findByTestId('rule-name');

    const ruleDescription = await screen.findByTestId('description');

    const ruleResources = await screen.findByTestId('resources');

    const ruleOperations = await screen.findByTestId('operations');

    const ruleEffect = await screen.findByTestId('effect');

    const ruleCondition = await screen.findByTestId('condition');

    expect(ruleCard).toBeInTheDocument();
    expect(ruleName).toBeInTheDocument();
    expect(ruleDescription).toBeInTheDocument();
    expect(ruleResources).toBeInTheDocument();
    expect(ruleOperations).toBeInTheDocument();
    expect(ruleEffect).toBeInTheDocument();
    expect(ruleCondition).toBeInTheDocument();
  });

  it('should call useEntityPermissions with the POLICY resource and current fqn', async () => {
    await act(async () => {
      render(<PoliciesDetailPage />);
    });

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.POLICY,
      'policy',
      expect.objectContaining({ enabled: true })
    );
  });

  it('should not fetch the policy when there is no view access', async () => {
    setMockPermissions({});

    await act(async () => {
      render(<PoliciesDetailPage />);
    });

    expect(getPolicyByName).not.toHaveBeenCalled();
  });

  // Regression coverage for the getDerivedPermissionFlags conversion (Task 8 Batch 9): an
  // explicit per-field deny must win over a bare EditAll grant (explicit-deny-wins) — the old
  // raw `EditAll || EditDisplayName` OR let EditAll grant unconditionally.
  it('denies display-name edit when EditDisplayName is explicitly false, even with EditAll true', async () => {
    setMockPermissions({
      ViewBasic: true,
      EditAll: true,
      EditDisplayName: false,
      Delete: true,
    });

    await act(async () => {
      render(<PoliciesDetailPage />);
    });

    expect(mockManageButton).toHaveBeenCalledWith(
      expect.objectContaining({
        editDisplayNamePermission: false,
        canDelete: true,
      })
    );
  });

  it('grants display-name edit via EditAll when EditDisplayName is not present', async () => {
    // Deliberately NOT merged with a full-fixture spread: a fixture defining every Operation
    // key would make getPrioritizedEditPermission's "key present" check see EditDisplayName
    // as an explicit deny rather than truly absent, masking the EditAll fallback this test
    // exists to cover (SchemaTable.test.tsx precedent).
    setMockPermissions({ ViewBasic: true, EditAll: true } as OperationPermission);

    await act(async () => {
      render(<PoliciesDetailPage />);
    });

    expect(mockManageButton).toHaveBeenCalledWith(
      expect.objectContaining({ editDisplayNamePermission: true })
    );
  });
});
