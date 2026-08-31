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
import { getRoleByName } from '../../../rest/rolesAPIV1';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { ROLE_DATA } from '../Roles.mock';
import RolesDetailPage from './RolesDetailPage';

// RolesDetailPage now fetches its own permissions via useEntityPermissions (Task 8 Batch 9)
// rather than an imperative usePermissionProvider().getEntityPermissionByFqn call — mock the
// hook directly, mirroring TableDetailsPageV1.test.tsx's setMockPermissions helper.
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
  useParams: jest.fn().mockReturnValue({ fqn: 'data-consumer' }),
  Link: jest.fn().mockImplementation(({ to }) => <a href={to}>{to}</a>),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

jest.mock('../../../rest/rolesAPIV1', () => ({
  getRoleByName: jest.fn().mockImplementation(() => Promise.resolve(ROLE_DATA)),
  patchRole: jest.fn().mockImplementation(() => Promise.resolve(ROLE_DATA)),
}));

jest.mock('../../../components/common/EntityDescription/Description', () =>
  jest.fn().mockReturnValue(<div data-testid="description">Description</div>)
);

jest.mock(
  '../../../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () => jest.fn().mockReturnValue(<div data-testid="previewer">Previewer</div>)
);

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () =>
    jest.fn().mockReturnValue(<div data-testid="breadcrumb">Breadcrumb</div>)
);

jest.mock('../../../components/common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock(
  '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component',
  () => jest.fn().mockReturnValue(<div>EntityHeaderTitle</div>)
);

const mockManageButton = jest.fn().mockReturnValue(<div>ManageButton</div>);
jest.mock(
  '../../../components/common/EntityPageInfos/ManageButton/ManageButton',
  () =>
    jest.fn().mockImplementation((props) => mockManageButton(props))
);

jest.mock('../../../constants/constants', () => ({
  ...jest.requireActual('../../../constants/constants'),
  getUserPath: jest.fn(),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn(),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getPolicyWithFqnPath: jest.fn(),
  getSettingPath: jest.fn(),
  getTeamsWithFqnPath: jest.fn(),
}));

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../AddAttributeModal/AddAttributeModal', () =>
  jest.fn().mockReturnValue(<div>AddAttributeModal</div>)
);

jest.mock('./RolesDetailPageList.component', () =>
  jest.fn().mockReturnValue(<div>RolesDetailPageList</div>)
);

describe('Test Roles Details Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions({ ViewBasic: true, EditAll: true, Delete: true });
    (getRoleByName as jest.Mock).mockImplementation(() =>
      Promise.resolve(ROLE_DATA)
    );
  });

  it('Should render the role details component', async () => {
    await act(async () => {
      render(<RolesDetailPage />);
    });

    const container = await screen.findByTestId('role-details-container');

    const description = await screen.findByTestId('description');
    const breadCrumb = await screen.findByTestId('breadcrumb');

    const tabs = await screen.findByTestId('tabs');

    const policiesTab = await screen.findByText('label.policy-plural');
    const teamsTab = await screen.findByText('label.team-plural');
    const usersTab = await screen.findByText('label.user-plural');

    expect(container).toBeInTheDocument();

    expect(description).toBeInTheDocument();
    expect(breadCrumb).toBeInTheDocument();

    expect(tabs).toBeInTheDocument();

    expect(policiesTab).toBeInTheDocument();
    expect(teamsTab).toBeInTheDocument();
    expect(usersTab).toBeInTheDocument();
  });

  it('Should render the no-data component in there is no-data', async () => {
    // No view access — matches the pre-conversion test's implicit setup (the default mock
    // resolved a falsy/null permission, so viewBasicPermission was never granted and
    // fetchRole() was never called): the "no entity found" placeholder comes from the
    // isEmpty(role) branch, not from getRoleByName rejecting.
    setMockPermissions({});

    await act(async () => {
      render(<RolesDetailPage />);
    });

    const container = await screen.findByTestId('role-details-container');

    const noData = await screen.findByTestId('no-data-placeholder');

    expect(container).toBeInTheDocument();

    expect(noData).toBeInTheDocument();
    expect(getRoleByName).not.toHaveBeenCalled();
  });

  it('should call useEntityPermissions with the ROLE resource and current fqn', async () => {
    await act(async () => {
      render(<RolesDetailPage />);
    });

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.ROLE,
      'data-consumer',
      expect.objectContaining({ enabled: true })
    );
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
      render(<RolesDetailPage />);
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
      render(<RolesDetailPage />);
    });

    expect(mockManageButton).toHaveBeenCalledWith(
      expect.objectContaining({ editDisplayNamePermission: true })
    );
  });
});
