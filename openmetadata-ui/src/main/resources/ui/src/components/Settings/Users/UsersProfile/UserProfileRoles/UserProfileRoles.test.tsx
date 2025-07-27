/*
 *  Copyright 2023 Collate.
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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useAuth } from '../../../../../hooks/authHooks';
import { MOCK_USER_ROLE } from '../../../../../mocks/User.mock';
import { getRoles } from '../../../../../rest/rolesAPIV1';
import { mockUserRole } from '../../mocks/User.mocks';
import UserProfileRoles from './UserProfileRoles.component';
import { UserProfileRolesProps } from './UserProfileRoles.interface';

const mockPropsData: UserProfileRolesProps = {
  userRoles: [],
  isDeletedUser: false,
  updateUserDetails: jest.fn(),
};

jest.mock('../../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: false }),
}));

jest.mock('../../../../common/InlineEdit/InlineEdit.component', () => {
  return jest.fn().mockImplementation(({ children, onCancel, onSave }) => (
    <div data-testid="inline-edit">
      <span>InlineEdit</span>
      {children}
      <button data-testid="save" onClick={onSave}>
        save
      </button>
      <button data-testid="cancel" onClick={onCancel}>
        cancel
      </button>
    </div>
  ));
});

jest.mock('../../../../common/Chip/Chip.component', () => {
  return jest.fn().mockReturnValue(<p>Chip</p>);
});

jest.mock('../../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('roleName'),
}));

jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../../rest/rolesAPIV1', () => ({
  getRoles: jest.fn().mockImplementation(() => Promise.resolve(mockUserRole)),
}));

describe('Test User Profile Roles Component', () => {
  it('should render user profile roles component', async () => {
    render(<UserProfileRoles {...mockPropsData} />);

    expect(screen.getByTestId('user-profile-roles')).toBeInTheDocument();
  });

  it('should render chip component', async () => {
    render(<UserProfileRoles {...mockPropsData} />);

    expect(screen.getByTestId('user-profile-roles')).toBeInTheDocument();

    expect(await screen.findAllByText('Chip')).toHaveLength(2);
  });

  it('should not render roles edit button if non admin user', async () => {
    render(<UserProfileRoles {...mockPropsData} />);

    expect(screen.getByTestId('user-profile-roles')).toBeInTheDocument();

    expect(screen.queryByTestId('edit-roles-button')).not.toBeInTheDocument();
  });

  it('should not render roles edit button if user is deleted', async () => {
    render(<UserProfileRoles {...mockPropsData} isDeletedUser />);

    expect(screen.getByTestId('user-profile-roles')).toBeInTheDocument();

    expect(screen.queryByTestId('edit-roles-button')).not.toBeInTheDocument();
  });

  it('should render edit button if admin user', async () => {
    (useAuth as jest.Mock).mockImplementation(() => ({
      isAdminUser: true,
    }));

    render(<UserProfileRoles {...mockPropsData} />);

    expect(screen.getByTestId('user-profile-roles')).toBeInTheDocument();

    expect(screen.getByTestId('edit-roles-button')).toBeInTheDocument();
  });

  it('should render edit popover on edit button action', async () => {
    (useAuth as jest.Mock).mockImplementation(() => ({
      isAdminUser: true,
    }));

    render(<UserProfileRoles {...mockPropsData} />);

    expect(screen.getByTestId('user-profile-roles')).toBeInTheDocument();

    const editButton = screen.getByTestId('edit-roles-button');

    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    expect(screen.getByTestId('user-profile-edit-popover')).toBeInTheDocument();
  });

  it('should call updateUserDetails on click save', async () => {
    (useAuth as jest.Mock).mockImplementation(() => ({
      isAdminUser: true,
    }));
    render(<UserProfileRoles {...mockPropsData} />);

    fireEvent.click(screen.getByTestId('edit-roles-button'));

    expect(screen.getByTestId('user-profile-edit-popover')).toBeInTheDocument();

    act(() => {
      fireEvent.click(
        screen.getByTestId('user-profile-edit-roles-save-button')
      );
    });

    expect(mockPropsData.updateUserDetails).toHaveBeenCalledWith(
      { roles: [], isAdmin: false },
      'roles'
    );
  });

  it('should call roles api on edit button action', async () => {
    (useAuth as jest.Mock).mockImplementation(() => ({
      isAdminUser: true,
    }));

    render(<UserProfileRoles {...mockPropsData} />);

    expect(screen.getByTestId('user-profile-roles')).toBeInTheDocument();

    const editButton = screen.getByTestId('edit-roles-button');

    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    expect(getRoles).toHaveBeenCalledWith('', undefined, undefined, false, 50);

    expect(screen.getByTestId('user-profile-edit-popover')).toBeInTheDocument();
  });

  it('should maintain initial state if edit is close without save', async () => {
    (useAuth as jest.Mock).mockImplementation(() => ({
      isAdminUser: true,
    }));

    render(
      <UserProfileRoles
        {...mockPropsData}
        userRoles={MOCK_USER_ROLE.slice(0, 2)}
      />
    );

    fireEvent.click(screen.getByTestId('edit-roles-button'));

    const selectInput = screen.getByTestId('profile-edit-roles-select');
    fireEvent.click(selectInput);
    fireEvent.click(
      screen.getByTestId('user-profile-edit-roles-cancel-button')
    );

    expect(screen.getByText('37a00e0b-383...')).toBeInTheDocument();
    expect(screen.getByText('afc5583c-e26...')).toBeInTheDocument();

    expect(screen.queryByText('admin')).not.toBeInTheDocument();
  });
});
