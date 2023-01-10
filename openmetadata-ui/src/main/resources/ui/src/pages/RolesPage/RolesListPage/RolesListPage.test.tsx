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
}));

jest.mock('rest/rolesAPIV1', () => ({
  getRoles: jest
    .fn()
    .mockImplementation(() => Promise.resolve(ROLES_LIST_WITH_PAGING)),
}));

jest.mock('components/common/next-previous/NextPrevious', () =>
  jest.fn().mockReturnValue(<div>NextPrevious</div>)
);

jest.mock('components/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock('./RolesList', () =>
  jest.fn().mockReturnValue(<div data-testid="roles-list">RolesList</div>)
);

jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('components/PermissionProvider/PermissionProvider', () => ({
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

    const rolesList = await screen.findByTestId('roles-list');

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
});
