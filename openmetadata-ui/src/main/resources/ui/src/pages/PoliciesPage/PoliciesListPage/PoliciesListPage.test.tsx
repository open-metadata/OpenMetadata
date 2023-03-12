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
import { POLICY_LIST_WITH_PAGING } from '../../RolesPage/Roles.mock';
import PoliciesListPage from './PoliciesListPage';

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
}));

jest.mock('rest/rolesAPIV1', () => ({
  getPolicies: jest
    .fn()
    .mockImplementation(() => Promise.resolve(POLICY_LIST_WITH_PAGING)),
}));

jest.mock('components/common/next-previous/NextPrevious', () =>
  jest.fn().mockReturnValue(<div>NextPrevious</div>)
);

jest.mock('components/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock('./PoliciesList', () =>
  jest.fn().mockReturnValue(<div data-testid="policies-list">PoliciesList</div>)
);

jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

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
    },
  }),
}));

describe('Test Policies List Page', () => {
  it('Should render the list component', async () => {
    render(<PoliciesListPage />);

    const container = await screen.findByTestId('policies-list-container');
    const addPolicyButton = await screen.findByTestId('add-policy');

    const policyList = await screen.findByTestId('policies-list');

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

    expect(mockPush).toHaveBeenCalledWith(
      '/settings/access/policies/add-policy'
    );
  });
});
