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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { Policy } from '../../../generated/entity/policies/policy';
import { POLICY_LIST_WITH_PAGING } from '../../RolesPage/Roles.mock';
import PoliciesList from './PoliciesList';

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children, to, ...res }) => (
    <a href={to} {...res}>
      {children}
    </a>
  )),
}));

jest.mock('components/common/DeleteWidget/DeleteWidgetModal', () =>
  jest.fn().mockReturnValue(<div>Delete Widget</div>)
);

jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () =>
  jest.fn().mockReturnValue(<div data-testid="previewer">Previewer</div>)
);

jest.mock('components/PermissionProvider/PermissionProvider', () => ({
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

jest.mock('../../../constants/HelperTextUtil', () => ({
  NO_PERMISSION_FOR_ACTION: '',
  NO_PERMISSION_TO_VIEW: '',
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getEntityName: jest.fn().mockReturnValue(''),
}));

jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
  LIST_CAP: 1,
  userPermissions: {
    hasViewPermissions: jest.fn(),
  },
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getPolicyWithFqnPath: jest.fn(),
  getRoleWithFqnPath: jest.fn(),
}));

const mockProps = {
  policies: POLICY_LIST_WITH_PAGING.data as Policy[],
  fetchPolicies: jest.fn(),
};

describe('Test Roles List Component', () => {
  it('Should render the list component', async () => {
    render(<PoliciesList {...mockProps} />);

    const container = await screen.findByTestId('policies-list-table');

    expect(container).toBeInTheDocument();
  });

  it('Should render all table columns', async () => {
    render(<PoliciesList {...mockProps} />);

    const container = await screen.findByTestId('policies-list-table');

    const nameCol = await screen.findByText('Name');
    const descriptionCol = await screen.findByText('Description');
    const rolesCol = await screen.findByText('Roles');
    const actionsCol = await screen.findByText('Actions');

    expect(container).toBeInTheDocument();
    expect(nameCol).toBeInTheDocument();
    expect(descriptionCol).toBeInTheDocument();
    expect(rolesCol).toBeInTheDocument();
    expect(actionsCol).toBeInTheDocument();
  });
});
