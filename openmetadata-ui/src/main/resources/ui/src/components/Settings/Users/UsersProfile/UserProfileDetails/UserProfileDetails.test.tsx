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
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../../../generated/settings/settings';
import { useAuth } from '../../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { useFqn } from '../../../../../hooks/useFqn';
import { USER_DATA } from '../../../../../mocks/User.mock';
import { restoreUser } from '../../../../../rest/userAPI';
import UserProfileDetails from './UserProfileDetails.component';
import { UserProfileDetailsProps } from './UserProfileDetails.interface';

const mockPropsData: UserProfileDetailsProps = {
  userData: USER_DATA,
  afterDeleteAction: jest.fn(),
  updateUserDetails: jest.fn(),
};

jest.mock('../../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({
    fqn: 'test',
  })),
}));

jest.mock('../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    authConfig: {
      provider: AuthProvider.Basic,
    },
    currentUser: {
      name: 'test',
    },
    searchCriteria: '',
    theme: {
      primaryColor: '#000000',
      errorColor: '#000000',
    },
  })),
}));

jest.mock('../../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('entityName'),
}));

jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../rest/userAPI', () => ({
  restoreUser: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../UserProfileImage/UserProfileImage.component', () => {
  return jest.fn().mockReturnValue(<p>ProfilePicture</p>);
});

jest.mock('../../../../common/InlineEdit/InlineEdit.component', () => {
  return jest.fn().mockImplementation(({ onSave, onCancel, children }) => (
    <div data-testid="inline-edit">
      <span>InlineEdit</span>
      {children}
      <button data-testid="display-name-save-button" onClick={onSave}>
        DisplayNameButton
      </button>
      <button data-testid="display-name-cancel-button" onClick={onCancel}>
        DisplayNameCancelButton
      </button>
    </div>
  ));
});

jest.mock(
  '../../../../common/EntityPageInfos/ManageButton/ManageButton',
  () => {
    return jest
      .fn()
      .mockImplementation(({ afterDeleteAction, onRestoreEntity }) => (
        <>
          <span>ManageButton</span>
          <button onClick={afterDeleteAction}>AfterDeleteActionButton</button>
          <button onClick={onRestoreEntity}>OnRestoreEntityButton</button>
        </>
      ));
  }
);

jest.mock('../../ChangePasswordForm', () => {
  return jest.fn().mockReturnValue(<p>ChangePasswordForm</p>);
});

jest.mock(
  '../../../../MyData/Persona/PersonaSelectableList/PersonaSelectableList.component',
  () => ({
    PersonaSelectableList: jest.fn().mockImplementation(({ onUpdate }) => (
      <div>
        <span>PersonaSelectableList</span>
        <button
          data-testid="persona-save-button"
          onClick={() => onUpdate(USER_DATA.defaultPersona)}>
          PersonaSaveButton
        </button>
      </div>
    )),
  })
);

jest.mock('../../../../common/Chip/Chip.component', () => {
  return jest.fn().mockReturnValue(<p>Chip</p>);
});

jest.mock('../UserProfileImage/UserProfileImage.component', () => {
  return jest.fn().mockReturnValue(<p>UserProfileImage</p>);
});

jest.mock('../../../../../rest/auth-API', () => ({
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
    expect(screen.queryByTestId('user-name')).not.toBeInTheDocument();
    expect(screen.getByTestId('edit-displayName')).toBeInTheDocument();

    // user email
    expect(screen.getByTestId('user-email-label')).toBeInTheDocument();
    expect(screen.getByTestId('user-email-value')).toContainHTML(
      USER_DATA.email
    );

    // user default persona along with edit
    expect(screen.getByTestId('default-persona-label')).toBeInTheDocument();
    expect(screen.getByText('PersonaSelectableList')).toBeInTheDocument();

    // user domain
    expect(screen.getByTestId('user-domain-label')).toContainHTML(
      'label.domain'
    );
    expect(screen.getByTestId('domain-link')).toBeInTheDocument();
    expect(screen.getByTestId('domain-link')).toHaveAttribute(
      'href',
      '/domain/Engineering'
    );

    // change password button
    expect(screen.getByTestId('change-password-button')).toBeInTheDocument();

    // manage button
    expect(screen.getByText('ManageButton')).toBeInTheDocument();

    // delete badge
    expect(screen.queryByTestId('deleted-badge')).not.toBeInTheDocument();
  });

  it('should not render change password button and component in case of SSO', async () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementationOnce(
      () => ({
        authConfig: jest.fn().mockImplementationOnce(() => ({
          provider: AuthProvider.Google,
        })),
      })
    );

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

    (useApplicationStore as unknown as jest.Mock).mockImplementationOnce(
      () => ({
        currentUser: {
          name: 'admin',
          id: '1234',
        },
      })
    );

    render(
      <UserProfileDetails
        {...mockPropsData}
        userData={{ ...USER_DATA, displayName: 'Test User' }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(screen.getByTestId('user-profile-details')).toBeInTheDocument();

    // render user name with no edit if doesn't have edit access
    expect(screen.getByTestId('user-name')).toContainHTML('Test User');
    expect(screen.queryByTestId('edit-displayName')).not.toBeInTheDocument();

    // render chip in case of no default persona to other user
    expect(screen.getByTestId('default-persona-label')).toBeInTheDocument();
    expect(screen.getByText('Chip')).toBeInTheDocument();

    expect(screen.getByText('PersonaSelectableList')).toBeInTheDocument();

    expect(
      screen.queryByTestId('change-password-button')
    ).not.toBeInTheDocument();
  });

  it('should not render edit button in case of user deleted', async () => {
    render(
      <UserProfileDetails
        {...mockPropsData}
        userData={{ ...USER_DATA, deleted: true }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const editButton = screen.queryByTestId('edit-displayName');

    expect(editButton).not.toBeInTheDocument();
  });

  it('should render delete badge in case of deleted user', async () => {
    render(
      <UserProfileDetails
        {...mockPropsData}
        userData={{ ...USER_DATA, deleted: true }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(screen.getByTestId('deleted-badge')).toBeInTheDocument();
  });

  it('should render edit display name input on click', async () => {
    render(<UserProfileDetails {...mockPropsData} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('user-profile-details')).toBeInTheDocument();

    expect(screen.queryByTestId('user-name')).not.toBeInTheDocument();

    const editButton = screen.getByTestId('edit-displayName');

    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    expect(screen.getByText('InlineEdit')).toBeInTheDocument();
  });

  it('should not render changed displayName in input if not saved', async () => {
    render(<UserProfileDetails {...mockPropsData} />, {
      wrapper: MemoryRouter,
    });

    fireEvent.click(screen.getByTestId('edit-displayName'));

    act(() => {
      fireEvent.change(screen.getByTestId('displayName'), {
        target: { value: 'data-test' },
      });
    });

    act(() => {
      fireEvent.click(screen.getByTestId('display-name-cancel-button'));
    });

    fireEvent.click(screen.getByTestId('edit-displayName'));

    expect(screen.getByTestId('displayName')).toHaveValue('');
  });

  it('should call updateUserDetails on click of DisplayNameButton', async () => {
    await act(async () => {
      render(<UserProfileDetails {...mockPropsData} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-displayName'));
    });

    expect(screen.getByText('InlineEdit')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByTestId('displayName'), {
        target: { value: 'test' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('display-name-save-button'));
    });

    expect(mockPropsData.updateUserDetails).toHaveBeenCalledWith(
      { displayName: 'test' },
      'displayName'
    );
  });

  it('should pass displayName undefined to the updateUserDetails in case of empty string', async () => {
    await act(async () => {
      render(
        <UserProfileDetails
          {...mockPropsData}
          userData={{ ...mockPropsData.userData, displayName: 'Test' }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    fireEvent.click(screen.getByTestId('edit-displayName'));

    expect(screen.getByText('InlineEdit')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByTestId('displayName'), {
        target: {
          value: '',
        },
      });
    });

    fireEvent.click(screen.getByTestId('display-name-save-button'));

    expect(mockPropsData.updateUserDetails).toHaveBeenCalledWith(
      { displayName: undefined },
      'displayName'
    );
  });

  it('should call updateUserDetails on click of PersonaSaveButton', async () => {
    render(<UserProfileDetails {...mockPropsData} />, {
      wrapper: MemoryRouter,
    });

    fireEvent.click(screen.getByTestId('persona-save-button'));

    expect(mockPropsData.updateUserDetails).toHaveBeenCalledWith(
      { defaultPersona: USER_DATA.defaultPersona },
      'defaultPersona'
    );
  });

  it('should trigger afterDeleteAction props from ManageButton', async () => {
    render(<UserProfileDetails {...mockPropsData} />, {
      wrapper: MemoryRouter,
    });

    fireEvent.click(screen.getByText('AfterDeleteActionButton'));

    expect(mockPropsData.afterDeleteAction).toHaveBeenCalled();
  });

  it('should call restore API after restoreButton click from ManageButton', async () => {
    render(<UserProfileDetails {...mockPropsData} />, {
      wrapper: MemoryRouter,
    });

    await act(async () => {
      fireEvent.click(screen.getByText('OnRestoreEntityButton'));
    });

    expect(restoreUser).toHaveBeenCalledWith(USER_DATA.id);

    expect(mockPropsData.afterDeleteAction).toHaveBeenCalled();
  });

  it('should not show edit display name button for admins in user profile page', async () => {
    (useFqn as jest.Mock).mockImplementationOnce(() => ({
      fqn: 'test1', // fqn is not equal to current logged in admin user
    }));
    render(<UserProfileDetails {...mockPropsData} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.queryByTestId('edit-displayName')).toBeNull();
  });

  it('should show edit display name button on non admin logged in user profile', async () => {
    (useAuth as jest.Mock).mockImplementationOnce(() => ({
      isAdminUser: false,
    }));
    render(<UserProfileDetails {...mockPropsData} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('edit-displayName')).toBeInTheDocument();
  });
});
