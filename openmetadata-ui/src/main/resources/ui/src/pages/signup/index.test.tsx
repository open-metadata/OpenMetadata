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

import { act, fireEvent, render } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { createUser } from 'rest/userAPI';
import Signup from '.';
import AppState from '../../AppState';
import { getImages } from '../../utils/CommonUtils';
import { mockCreateUser } from './mocks/signup.mock';

let letExpectedUserName = { name: 'sample123', email: 'sample123@sample.com' };

const mockChangeHandler = jest.fn();
const mockSubmitHandler = jest.fn();
const mockShowErrorToast = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockReturnValue({
    push: jest.fn(),
  }),
}));

jest.mock('components/authentication/auth-provider/AuthProvider', () => ({
  useAuthContext: jest.fn(() => ({
    setIsSigningIn: jest.fn(),
  })),
}));

jest.mock('components/TeamsSelectable/TeamsSelectable', () => {
  return jest.fn().mockImplementation(() => <div>TeamSelectable</div>);
});

jest.mock('components/buttons/Button/Button', () => ({
  Button: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="create-button">{children}</div>
    )),
}));

jest.mock('components/containers/PageContainer', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainer">{children}</div>
    ));
});

jest.mock('rest/userAPI', () => ({
  createUser: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockCreateUser)),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockImplementation(() => mockShowErrorToast),
}));

jest.mock('../../AppState', () => ({
  ...jest.requireActual('../../AppState'),
  newUser: {
    name: 'Sample Name',
    email: 'sample123@sample.com',
    picture: 'Profile Picture',
  },
  updateUserDetails: jest.fn(),
  updateUserPermissions: jest.fn(),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getImages: jest
    .fn()
    .mockResolvedValue(
      'https://lh3.googleusercontent.com/a/ALm5wu0HwEPhAbyRha16cUHrEum-zxTDzj6KZiqYsT5Y=s96-c'
    ),
}));

jest.mock('utils/AuthProvider.util', () => ({
  getNameFromUserData: jest.fn().mockImplementation(() => letExpectedUserName),
}));

describe('Signup page', () => {
  it('Component should render properly', async () => {
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

      expect(mockSubmitHandler).toHaveBeenCalledTimes(1);
    });
  });

  it('Handlers in forms for change and submit should work properly', async () => {
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

      expect(mockChangeHandler).toHaveBeenCalledTimes(3);

      form.onsubmit = mockSubmitHandler;

      fireEvent.submit(form);

      expect(mockSubmitHandler).toHaveBeenCalledTimes(1);
    });
  });

  it('Error should be thrown if createUser API fails', async () => {
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

    expect(mockChangeHandler).toHaveBeenCalledTimes(3);

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
    letExpectedUserName = { name: '', email: '' };

    AppState.newUser = {
      name: '',
      email: '',
      picture: '',
    };

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

    expect(mockChangeHandler).not.toHaveBeenCalled();

    form.onsubmit = mockSubmitHandler;

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(createUser as jest.Mock).toHaveBeenCalledTimes(0);
  });
});
