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
import React from 'react';
import { ROLES_LIST_WITH_PAGING } from '../Roles.mock';
import RolesListPage from './RolesListPage';

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
  Link: jest.fn().mockImplementation(({ children, to, ...res }) => (
    <a href={to} {...res}>
      {children}
    </a>
  )),
}));

jest.mock('../../../rest/rolesAPIV1', () => ({
  getRoles: jest
    .fn()
    .mockImplementation(() => Promise.resolve(ROLES_LIST_WITH_PAGING)),
}));
jest.mock('../../../components/common/DeleteWidget/DeleteWidgetModal', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="delete-modal">DeletWdigetModal</div>)
);

jest.mock(
  '../../../components/common/rich-text-editor/RichTextEditorPreviewer',
  () => jest.fn().mockReturnValue(<div data-testid="previewer">Previewer</div>)
);

jest.mock('../../../components/common/next-previous/NextPrevious', () =>
  jest.fn().mockReturnValue(<div>NextPrevious</div>)
);
jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('data'),
}));

jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
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

describe('Test Roles List Page', () => {
  it('Should render the list component', async () => {
    render(<RolesListPage />);

    const container = await screen.findByTestId('roles-list-container');
    const addRoleButton = await screen.findByTestId('add-role');

    const rolesList = await screen.findByTestId('roles-list-table');

    expect(container).toBeInTheDocument();
    expect(addRoleButton).toBeInTheDocument();
    expect(rolesList).toBeInTheDocument();
  });

  it('Add role button should work', async () => {
    render(<RolesListPage />);

    const container = await screen.findByTestId('roles-list-container');
    const addRoleButton = await screen.findByTestId('add-role');

    expect(container).toBeInTheDocument();
    expect(addRoleButton).toBeInTheDocument();

    fireEvent.click(addRoleButton);

    expect(mockPush).toHaveBeenCalledWith('/settings/access/roles/add-role');
  });

  it('Should render all table columns', async () => {
    render(<RolesListPage />);

    const container = await screen.findByTestId('roles-list-table');

    const nameCol = await screen.findByText('label.name');
    const descriptionCol = await screen.findByText('label.description');
    const policiesCol = await screen.findByText('label.policy-plural');
    const actionsCol = await screen.findByText('label.action-plural');

    expect(container).toBeInTheDocument();
    expect(nameCol).toBeInTheDocument();
    expect(descriptionCol).toBeInTheDocument();
    expect(policiesCol).toBeInTheDocument();
    expect(actionsCol).toBeInTheDocument();
  });

  it('Should render all table rows', async () => {
    render(<RolesListPage />);

    const container = await screen.findByTestId('roles-list-table');

    const nameRows = await screen.findAllByTestId('role-name');
    const descriptionRows = await screen.findAllByTestId('previewer');
    const policiesRows = await screen.findAllByTestId('policy-link');
    const actionsRows = await screen.findAllByTestId('delete-action-data');

    expect(container).toBeInTheDocument();
    expect(nameRows).toHaveLength(3);
    expect(descriptionRows).toHaveLength(3);
    expect(policiesRows).toHaveLength(3);
    expect(actionsRows).toHaveLength(3);
  });
});
