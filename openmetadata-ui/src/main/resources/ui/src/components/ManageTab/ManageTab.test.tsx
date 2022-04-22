/*
 *  Copyright 2021 Collate
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

import {
  findAllByTestId,
  findByTestId,
  findByText,
  render,
} from '@testing-library/react';
import React from 'react';
import ManageTab from './ManageTab.component';

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({
    isAdminUser: true,
    userPermissions: {
      UpdateTeam: true,
    },
  }),
}));

jest.mock('../common/toggle-switch/ToggleSwitchV1', () => {
  return jest.fn().mockImplementation(() => <p>ToggleSwitchV1.Component</p>);
});

jest.mock('../common/DeleteWidget/DeleteWidget', () => {
  return jest.fn().mockImplementation(() => <p>DeleteWidget.Component</p>);
});

const mockTierData = {
  children: [
    {
      fullyQualifiedName: 'Tier:Tier1',
      description: 'description for card 1',
    },
    {
      fullyQualifiedName: 'Tier:Tier2',
      description: 'description for card 2',
    },
    {
      fullyQualifiedName: 'Tier:Tier3',
      description: 'description for card 3',
    },
  ],
};

const mockFunction = jest.fn().mockImplementation(() => Promise.resolve());

jest.mock('../card-list/CardListItem/CardWithListItems', () => {
  return jest.fn().mockReturnValue(<p data-testid="card">CardWithListItems</p>);
});

jest.mock('../../axiosAPIs/tagAPI', () => ({
  getCategory: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockTierData })),
}));

describe('Test Manage tab Component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <ManageTab hasEditAccess onSave={mockFunction} />
    );
    const manageTab = await findByTestId(container, 'manage-tab');
    const ownerDropdown = await findByTestId(container, 'owner-dropdown');

    expect(manageTab).toBeInTheDocument();
    expect(ownerDropdown).toBeInTheDocument();
  });

  it('Number of card visible is same as data', async () => {
    const { container } = render(
      <ManageTab hasEditAccess onSave={mockFunction} />
    );
    const card = await findAllByTestId(container, 'card');

    expect(card.length).toBe(3);
  });

  it('Should render switch if isJoinable is present', async () => {
    const { container } = render(
      <ManageTab hasEditAccess isJoinable onSave={mockFunction} />
    );

    const isJoinableSwitch = await findByText(
      container,
      'ToggleSwitchV1.Component'
    );

    expect(isJoinableSwitch).toBeInTheDocument();
  });

  it('Should render danger zone if allowDelete, entityId, entityName and entityType is present', async () => {
    const { container } = render(
      <ManageTab
        allowDelete
        hasEditAccess
        entityId="testid"
        entityName="testEntity"
        entityType="testType"
        onSave={mockFunction}
      />
    );

    const dangerZone = await findByTestId(container, 'danger-zone');
    const DeleteWidget = await findByText(container, 'DeleteWidget.Component');

    expect(dangerZone).toBeInTheDocument();
    expect(DeleteWidget).toBeInTheDocument();
  });
});
