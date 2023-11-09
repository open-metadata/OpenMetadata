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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../../generated/settings/settings';
import { useAuth } from '../../../../hooks/authHooks';
import { USER_DATA } from '../../../../mocks/User.mock';
import { useAuthContext } from '../../../Auth/AuthProviders/AuthProvider';
import UserProfileDetails from './UserProfileDetails.component';
import { UserProfileDetailsProps } from './UserProfileDetails.interface';

const mockParams = {
  fqn: 'test',
};

const mockPropsData: UserProfileDetailsProps = {
  userData: USER_DATA,
  updateUserDetails: jest.fn(),
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock('../../../Auth/AuthProviders/AuthProvider', () => ({
  useAuthContext: jest.fn(() => ({
    authConfig: {
      provider: AuthProvider.Basic,
    },
    currentUser: {
      name: 'test',
    },
  })),
}));

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('entityName'),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../UserProfileImage/UserProfileImage.component', () => {
  return jest.fn().mockReturnValue(<p>ProfilePicture</p>);
});

jest.mock('../../../../components/InlineEdit/InlineEdit.component', () => {
  return jest.fn().mockReturnValue(<p>InlineEdit</p>);
});

jest.mock('../../../../components/Users/ChangePasswordForm', () => {
  return jest.fn().mockReturnValue(<p>ChangePasswordForm</p>);
});

jest.mock(
  '../../../Persona/PersonaSelectableList/PersonaSelectableList.component',
  () => ({
    PersonaSelectableList: jest
      .fn()
      .mockReturnValue(<p>PersonaSelectableList</p>),
  })
);

jest.mock('../../../common/Chip/Chip.component', () => {
  return jest.fn().mockReturnValue(<p>Chip</p>);
});

jest.mock('../UserProfileImage/UserProfileImage.component', () => {
  return jest.fn().mockReturnValue(<p>UserProfileImage</p>);
});

jest.mock('../../../../rest/auth-API', () => ({
  changePassword: jest.fn(),
}));

describe('Test User Profile Details Component', () => {
  it('Should render user profile details component', async () => {
    render(<UserProfileDetails {...mockPropsData} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('user-profile-details')).toBeInTheDocument();

    expect(screen.getByText('ChangePasswordForm')).toBeInTheDocument();
  });

  it('Should render user data component', async () => {
    render(<UserProfileDetails {...mockPropsData} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('user-profile-details')).toBeInTheDocument();

    // if user doesn't have displayname
    expect(screen.getByTestId('user-name')).toContainHTML('label.add-entity');
    expect(screen.getByTestId('edit-displayName')).toBeInTheDocument();

    // user email
    expect(screen.getByTestId('user-email-label')).toBeInTheDocument();
    expect(screen.getByTestId('user-email-value')).toContainHTML(
      USER_DATA.email
    );

    // user default persona along with edit
    expect(screen.getByTestId('default-persona-label')).toBeInTheDocument();
    expect(screen.getByText('PersonaSelectableList')).toBeInTheDocument();

    expect(screen.getByTestId('change-password-button')).toBeInTheDocument();
  });

  it('should not render change password button and component in case of SSO', async () => {
    (useAuthContext as jest.Mock).mockImplementationOnce(() => ({
      authConfig: jest.fn().mockImplementationOnce(() => ({
        provider: AuthProvider.Google,
      })),
    }));

    render(<UserProfileDetails {...mockPropsData} />, {
      wrapper: MemoryRouter,
    });

    expect(
      screen.queryByTestId('change-password-button')
    ).not.toBeInTheDocument();

    expect(screen.queryByText('ChangePasswordForm')).not.toBeInTheDocument();
  });

  it('should not provide edit access if non admin user and not current user', async () => {
    (useAuth as jest.Mock).mockImplementationOnce(() => ({
      isAdminUser: false,
    }));

    (useAuthContext as jest.Mock).mockImplementationOnce(() => ({
      currentUser: {
        name: 'admin',
        id: '1234',
      },
    }));

    render(<UserProfileDetails {...mockPropsData} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('user-profile-details')).toBeInTheDocument();

    // render user name with no edit if doesn't have edit access
    expect(screen.getByTestId('user-name')).toContainHTML('entityName');
    expect(screen.queryByTestId('edit-displayName')).not.toBeInTheDocument();

    // render chip in case of no default persona to other user
    expect(screen.getByTestId('default-persona-label')).toBeInTheDocument();
    expect(screen.getByText('Chip')).toBeInTheDocument();

    expect(screen.getByText('PersonaSelectableList')).toBeInTheDocument();

    expect(
      screen.queryByTestId('change-password-button')
    ).not.toBeInTheDocument();
  });

  it('should render edit display name input on click', async () => {
    render(<UserProfileDetails {...mockPropsData} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('user-profile-details')).toBeInTheDocument();

    expect(screen.getByTestId('user-name')).toContainHTML('label.add-entity');

    const editButton = screen.getByTestId('edit-displayName');

    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    expect(screen.getByText('InlineEdit')).toBeInTheDocument();
  });
});
