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

import { act, fireEvent, render } from '@testing-library/react';
import React, { ReactNode } from 'react';
import Signup from '.';
import * as AppState from '../../AppState';
import { createUser } from '../../axiosAPIs/userAPI';
import { getImages } from '../../utils/CommonUtils';

const mockChangeHandler = jest.fn();
const mockSubmitHandler = jest.fn();
const mockShowErrorToast = jest.fn();

const mockCreateUser = {
  data: {
    id: '911d4be4-6ebf-48a0-9016-43a2cf716428',
    name: 'test.user',
    fullyQualifiedName: 'test.user',
    displayName: 'Test User',
    version: 0.1,
    updatedAt: 1665145804919,
    updatedBy: 'test.user',
    email: 'test.user@test.com',
    href: 'http://sandbox-beta.open-metadata.org/api/v1/users/911d4be4-6ebf-48a0-9016-43a2cf716428',
    isAdmin: false,
    profile: {
      images: {
        image:
          'https://lh3.googleusercontent.com/a/ALm5wu0HwEPhAbyRha16cUHrEum-zxTDzj6KZiqYsT5Y=s96-c',
        image24:
          'https://lh3.googleusercontent.com/a/ALm5wu0HwEPhAbyRha16cUHrEum-zxTDzj6KZiqYsT5Y=s24-c',
        image32:
          'https://lh3.googleusercontent.com/a/ALm5wu0HwEPhAbyRha16cUHrEum-zxTDzj6KZiqYsT5Y=s32-c',
        image48:
          'https://lh3.googleusercontent.com/a/ALm5wu0HwEPhAbyRha16cUHrEum-zxTDzj6KZiqYsT5Y=s48-c',
        image72:
          'https://lh3.googleusercontent.com/a/ALm5wu0HwEPhAbyRha16cUHrEum-zxTDzj6KZiqYsT5Y=s72-c',
        image192:
          'https://lh3.googleusercontent.com/a/ALm5wu0HwEPhAbyRha16cUHrEum-zxTDzj6KZiqYsT5Y=s192-c',
        image512:
          'https://lh3.googleusercontent.com/a/ALm5wu0HwEPhAbyRha16cUHrEum-zxTDzj6KZiqYsT5Y=s512-c',
      },
    },
    teams: [
      {
        id: '606c1d33-213b-4626-a619-0e4cef9f5069',
        type: 'team',
        name: 'Engineering',
        fullyQualifiedName: 'Engineering',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/teams/606c1d33-213b-4626-a619-0e4cef9f5069',
      },
    ],
    deleted: false,
    inheritedRoles: [
      {
        id: '4509b668-2882-45c3-90e1-4551043f8cbd',
        type: 'role',
        name: 'DataConsumer',
        fullyQualifiedName: 'DataConsumer',
        description:
          'Users with Data Consumer role use different data assets for their day to day work.',
        displayName: 'Data Consumer',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/roles/4509b668-2882-45c3-90e1-4551043f8cbd',
      },
    ],
  },
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockReturnValue({
    push: jest.fn(),
  }),
}));

jest.mock('../../authentication/auth-provider/AuthProvider', () => ({
  useAuthContext: jest.fn(() => ({
    setIsSigningIn: jest.fn(),
  })),
}));

jest.mock('../../components/TeamsSelectable/TeamsSelectable', () => {
  return jest.fn().mockImplementation(() => <div>TeamSelectable</div>);
});

jest.mock('../../components/buttons/Button/Button', () => ({
  Button: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="create-button">{children}</div>
    )),
}));

jest.mock('../../components/containers/PageContainer', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainer">{children}</div>
    ));
});

jest.mock('../../axiosAPIs/userAPI', () => ({
  createUser: jest.fn().mockResolvedValue(mockCreateUser),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockImplementation(() => mockShowErrorToast),
}));

jest.mock('../../AppState', () => ({
  ...jest.requireActual('../../AppState'),
  updateUserDetails: jest.fn(),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getImages: jest
    .fn()
    .mockResolvedValue(
      'https://lh3.googleusercontent.com/a/ALm5wu0HwEPhAbyRha16cUHrEum-zxTDzj6KZiqYsT5Y=s96-c'
    ),
}));

describe('Signup page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Component should render properly', async () => {
    AppState.default.newUser = {
      name: 'Sample Name',
      email: 'sample123@sample.com',
      picture: 'Profile Picture',
    };
    AppState.default.updateUserDetails = jest.fn();

    (createUser as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: {} })
    );

    const { getByTestId, queryByTestId } = render(<Signup />);

    const logo = getByTestId('om-logo');
    const heading = getByTestId('om-heading');
    const form = getByTestId('create-user-form');
    const fullNameLabel = getByTestId('full-name-label');
    const fullNameInput = getByTestId('full-name-input');
    const usernameLabel = getByTestId('username-label');
    const usernameInput = getByTestId('username-input');
    const emailLabel = getByTestId('email-label');
    const emailInput = getByTestId('email-input');
    const selectTeamLabel = getByTestId('select-team-label');
    const createButton = getByTestId('create-button');
    const loadingContent = await queryByTestId('loading-content');

    expect(logo).toBeInTheDocument();
    expect(heading).toBeInTheDocument();
    expect(form).toBeInTheDocument();
    expect(fullNameLabel).toBeInTheDocument();
    expect(fullNameInput).toBeInTheDocument();
    expect(usernameLabel).toBeInTheDocument();
    expect(usernameInput).toBeInTheDocument();
    expect(emailLabel).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(selectTeamLabel).toBeInTheDocument();
    expect(createButton).toBeInTheDocument();
    expect(loadingContent).toBeNull();

    await act(async () => {
      form.onsubmit = mockSubmitHandler;

      fireEvent.submit(form);

      expect(mockSubmitHandler).toBeCalledTimes(1);
    });
  });

  it('Handlers in forms for change and submit should work properly', async () => {
    AppState.default.newUser = {
      name: 'Sample Name',
      email: 'sample123@sample.com',
      picture: 'Profile Picture',
    };
    AppState.default.updateUserPermissions = jest.fn();
    AppState.default.updateUserDetails = jest.fn();

    (createUser as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(undefined)
    );

    const { getByTestId } = render(<Signup />);

    const form = getByTestId('create-user-form');
    const fullNameInput = getByTestId('full-name-input');
    const usernameInput = getByTestId('username-input');
    const emailInput = getByTestId('email-input');

    expect(form).toBeInTheDocument();
    expect(fullNameInput).toHaveValue('Sample Name');
    expect(usernameInput).toHaveValue('sample123');
    expect(emailInput).toHaveValue('sample123@sample.com');

    fullNameInput.onchange = mockChangeHandler;
    usernameInput.onchange = mockChangeHandler;
    emailInput.onchange = mockChangeHandler;

    await act(async () => {
      fireEvent.change(fullNameInput, {
        target: { name: 'displayName', value: 'Fname Mname Lname' },
      });

      fireEvent.change(usernameInput, {
        target: { name: 'displayName', value: 'mockUserName' },
      });
      fireEvent.change(emailInput, {
        target: { name: 'displayName', value: 'sample@sample.com' },
      });

      expect(mockChangeHandler).toBeCalledTimes(3);

      form.onsubmit = mockSubmitHandler;

      fireEvent.submit(form);

      expect(mockSubmitHandler).toBeCalledTimes(1);
    });
  });

  it('Error should be thrown if createUser API fails', async () => {
    AppState.default.newUser = {
      name: 'Sample Name',
      email: 'sample123@sample.com',
      picture: 'Profile Picture',
    };
    AppState.default.updateUserPermissions = jest.fn();
    AppState.default.updateUserDetails = jest.fn();

    const { getByTestId } = render(<Signup />);

    const form = getByTestId('create-user-form');
    const fullNameInput = getByTestId('full-name-input');
    const usernameInput = getByTestId('username-input');
    const emailInput = getByTestId('email-input');

    expect(form).toBeInTheDocument();
    expect(fullNameInput).toHaveValue('Sample Name');
    expect(usernameInput).toHaveValue('sample123');
    expect(emailInput).toHaveValue('sample123@sample.com');

    fullNameInput.onchange = mockChangeHandler;
    usernameInput.onchange = mockChangeHandler;
    emailInput.onchange = mockChangeHandler;

    await act(async () => {
      fireEvent.change(fullNameInput, {
        target: { name: 'displayName', value: 'Fname Mname Lname' },
      });

      fireEvent.change(usernameInput, {
        target: { name: 'displayName', value: 'mockUserName' },
      });
      fireEvent.change(emailInput, {
        target: { name: 'displayName', value: '' },
      });
    });

    expect(mockChangeHandler).toBeCalledTimes(3);

    form.onsubmit = mockSubmitHandler;

    await act(async () => {
      (createUser as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'error' } },
        })
      );
      fireEvent.submit(form);
    });

    expect(createUser as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('Handlers in form should work if data is empty', async () => {
    (getImages as jest.Mock).mockImplementationOnce(() => Promise.reject(''));

    AppState.default.newUser = {
      name: '',
      email: '',
      picture: '',
    };
    AppState.default.updateUserPermissions = jest.fn();
    AppState.default.updateUserDetails = jest.fn();

    const { getByTestId } = render(<Signup />);

    const form = getByTestId('create-user-form');
    const fullNameInput = getByTestId('full-name-input');
    const usernameInput = getByTestId('username-input');
    const emailInput = getByTestId('email-input');

    expect(form).toBeInTheDocument();
    expect(fullNameInput).toHaveValue('');
    expect(usernameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');

    fullNameInput.onchange = mockChangeHandler;
    usernameInput.onchange = mockChangeHandler;
    emailInput.onchange = mockChangeHandler;

    expect(mockChangeHandler).not.toBeCalled();

    form.onsubmit = mockSubmitHandler;

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(createUser as jest.Mock).toHaveBeenCalledTimes(0);
  });
});
