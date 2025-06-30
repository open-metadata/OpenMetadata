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

import { fireEvent, render, screen } from '@testing-library/react';
import { ROUTES } from '../../../constants/constants';
import { POLICY_LIST_WITH_PAGING } from '../../RolesPage/Roles.mock';
import PoliciesListPage from './PoliciesListPage';

const mockNavigate = jest.fn();
const mockLocationPathname = '/mock-path';
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: mockLocationPathname,
  })),
  Link: jest.fn().mockImplementation(({ children, to, ...res }) => (
    <a href={to} {...res}>
      {children}
    </a>
  )),
}));
jest.mock('../../../components/common/DeleteWidget/DeleteWidgetModal', () =>
  jest.fn().mockReturnValue(<div>Delete Widget</div>)
);
jest.mock(
  '../../../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () => jest.fn().mockReturnValue(<div data-testid="previewer">Previewer</div>)
);

jest.mock('../../../rest/rolesAPIV1', () => ({
  getPolicies: jest
    .fn()
    .mockImplementation(() => Promise.resolve(POLICY_LIST_WITH_PAGING)),
}));

jest.mock('../../../components/common/NextPrevious/NextPrevious', () =>
  jest.fn().mockReturnValue(<div>NextPrevious</div>)
);

jest.mock('../../../components/common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      policy: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      role: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
    },
  }),
}));
jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
  LIST_CAP: 1,
  userPermissions: {
    hasViewPermissions: jest.fn(),
  },
}));

jest.mock('../../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn().mockImplementation(() => [
    {
      name: 'setting',
      url: ROUTES.SETTINGS,
    },
  ]),
}));

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <p>TitleBreadcrumb</p>);
  }
);

describe('Test Policies List Page', () => {
  it('Should render the list component', async () => {
    render(<PoliciesListPage />);

    const container = await screen.findByTestId('policies-list-container');
    const addPolicyButton = await screen.findByTestId('add-policy');

    const policyList = await screen.findByTestId('policies-list-table');

    expect(container).toBeInTheDocument();
    expect(addPolicyButton).toBeInTheDocument();
    expect(policyList).toBeInTheDocument();
  });

  it('Add policy button should work', async () => {
    render(<PoliciesListPage />);

    const container = await screen.findByTestId('policies-list-container');
    const addPolicyButton = await screen.findByTestId('add-policy');

    expect(container).toBeInTheDocument();
    expect(addPolicyButton).toBeInTheDocument();

    fireEvent.click(addPolicyButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/settings/access/policies/add-policy'
    );
  });

  it('Should render all table columns', async () => {
    render(<PoliciesListPage />);

    const container = await screen.findByTestId('policies-list-table');

    const nameCol = await screen.findByText('label.name');
    const descriptionCol = await screen.findByText('label.description');
    const rolesCol = await screen.findByText('label.role-plural');
    const actionsCol = await screen.findByText('label.action-plural');

    expect(container).toBeInTheDocument();
    expect(nameCol).toBeInTheDocument();
    expect(descriptionCol).toBeInTheDocument();
    expect(rolesCol).toBeInTheDocument();
    expect(actionsCol).toBeInTheDocument();
  });
});
