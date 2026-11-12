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

import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { Role } from '../../../generated/entity/teams/role';
import { User } from '../../../generated/entity/teams/user';
import RolesCard from './RolesCard.component';

jest.mock('@openmetadata/ui-core-components', () => {
  const Card = Object.assign(
    ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    {
      Header: ({ extra, title }: { extra?: ReactNode; title?: ReactNode }) => (
        <div>
          {title}
          {extra}
        </div>
      ),
      Content: ({ children }: { children?: ReactNode }) => (
        <div>{children}</div>
      ),
    }
  );

  return {
    Autocomplete: ({
      items,
      selectedItems,
    }: {
      items: { id: string; label: string }[];
      selectedItems: { id: string; label: string }[];
    }) => (
      <div>
        {items.map((item) => (
          <div data-testid={`option-${item.id}`} key={item.id}>
            {item.label}
          </div>
        ))}
        {selectedItems.map((item) => (
          <div data-testid={`selected-${item.id}`} key={item.id}>
            {item.label}
          </div>
        ))}
      </div>
    ),
    Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    ButtonUtility: ({
      onClick,
      onMouseDown,
      ...props
    }: {
      'data-testid'?: string;
      onClick?: () => void;
      onMouseDown?: () => void;
    }) => (
      <button
        aria-label={props['data-testid']}
        data-testid={props['data-testid']}
        type="button"
        onClick={onClick ?? onMouseDown}
      />
    ),
    Card,
  };
});

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Check: () => null,
  Edit01: () => null,
  XClose: () => null,
}));

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true }),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: (entity: { displayName?: string; name?: string }) =>
    entity.displayName ?? entity.name ?? '',
}));

jest.mock('../RolesElement/RolesElement.component', () => ({
  __esModule: true,
  default: () => <div data-testid="roles-element" />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const CUSTOM_ADMIN_ROLE = {
  id: 'custom-admin-role-id',
  name: 'Admin',
} as Role;

const renderEditingRolesCard = (
  selectedRoles: string[],
  updateUserDetails = jest.fn()
) => {
  render(
    <RolesCard
      roles={[CUSTOM_ADMIN_ROLE]}
      searchRolesOptions={jest.fn()}
      selectedRoles={selectedRoles}
      setSelectedRoles={jest.fn()}
      updateUserDetails={updateUserDetails}
      userData={{ id: 'bot-user-id', isAdmin: false } as User}
    />
  );
  fireEvent.click(screen.getByTestId('edit-roles'));

  return updateUserDetails;
};

describe('RolesCard', () => {
  it('labels the admin flag apart from a custom role named Admin', () => {
    renderEditingRolesCard([]);

    expect(
      screen.getByTestId(`option-${CUSTOM_ADMIN_ROLE.id}`)
    ).toHaveTextContent('Admin');
    expect(screen.getByTestId('option-admin')).toHaveTextContent(
      'label.admin-superuser'
    );
  });

  it('saves the admin flag as isAdmin and the custom Admin role as a role', () => {
    const updateUserDetails = renderEditingRolesCard([
      CUSTOM_ADMIN_ROLE.id,
      'admin',
    ]);

    expect(screen.getByTestId('selected-admin')).toHaveTextContent(
      'label.admin-superuser'
    );

    fireEvent.click(screen.getByTestId('save-roles'));

    expect(updateUserDetails).toHaveBeenCalledWith({
      roles: [{ id: CUSTOM_ADMIN_ROLE.id, type: 'role', name: 'Admin' }],
      isAdmin: true,
    });
  });
});
