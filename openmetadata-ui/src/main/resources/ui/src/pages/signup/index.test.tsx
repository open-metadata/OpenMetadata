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

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
const mockAppState = AppState as any;

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
}));

jest.mock('../../components/containers/PageContainer', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainer">{children}</div>
    ));
});

jest.mock('../../AppState', () => ({
  __esModule: true,
  default: null,
}));

jest.mock('../../axiosAPIs/miscAPI', () => ({
  getLoggedInUserPermissions: jest.fn().mockResolvedValue({ data: {} }),
}));

jest.mock('../../axiosAPIs/userAPI', () => ({
  createUser: jest.fn().mockResolvedValue({
    data: {},
  }),
}));

jest.mock('../../utils/UserDataUtils', () => ({
  fetchAllUsers: jest.fn(),
}));

describe('Test for Signup page', () => {
  it('Component should render properly', async () => {
    mockAppState.default = {
      newUser: {
        name: '',
        email: '',
      },
      updateUserDetails: jest.fn(),
    };
    await act(async () => {
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

      const onChangeHandler = jest.fn();

      fullNameInput.onchange = onChangeHandler;
      usernameInput.onchange = onChangeHandler;
      emailInput.onchange = onChangeHandler;

      fireEvent.change(fullNameInput, {
        target: { name: 'displayName', value: 'Fname Mname Lname' },
      });

      fireEvent.change(usernameInput, {
        target: { name: 'displayName', value: 'mockUserName' },
      });
      fireEvent.change(emailInput, {
        target: { name: 'displayName', value: 'sample@sample.com' },
      });

      expect(onChangeHandler).toBeCalledTimes(3);

      const onSubmitHandler = jest.fn();

      form.onsubmit = onSubmitHandler;

      fireEvent.submit(form);

      expect(onSubmitHandler).toBeCalledTimes(1);
    });
  });

  it('handlers in forms for change and submit should work properly', async () => {
    mockAppState.default = {
      newUser: {
        name: 'Sample Name',
        email: 'sample123@sample.com',
        picture: 'Profile Picture',
      },
      updateUserPermissions: jest.fn(),
      updateUserDetails: jest.fn(),
    };
    await act(async () => {
      const { getByTestId } = render(<Signup />);

      const form = getByTestId('create-user-form');
      const fullNameInput = getByTestId('full-name-input');
      const usernameInput = getByTestId('username-input');
      const emailInput = getByTestId('email-input');
      const createButton = getByTestId('create-button');

      expect(form).toBeInTheDocument();
      expect(fullNameInput).toHaveValue('Sample Name');
      expect(usernameInput).toHaveValue('sample123');
      expect(emailInput).toHaveValue('sample123@sample.com');
      expect(createButton).toBeInTheDocument();

      const onChangeHandler = jest.fn();

      fullNameInput.onchange = onChangeHandler;
      usernameInput.onchange = onChangeHandler;
      emailInput.onchange = onChangeHandler;

      fireEvent.change(fullNameInput, {
        target: { name: 'displayName', value: 'Fname Mname Lname' },
      });

      fireEvent.change(usernameInput, {
        target: { name: 'displayName', value: 'mockUserName' },
      });
      fireEvent.change(emailInput, {
        target: { name: 'displayName', value: 'sample@sample.com' },
      });

      expect(onChangeHandler).toBeCalledTimes(3);

      const onSubmitHandler = jest.fn();

      form.onsubmit = onSubmitHandler;

      fireEvent.submit(form);

      expect(onSubmitHandler).toBeCalledTimes(1);
    });
  });

  it('handlers in forms for change and submit should work properly for no data in AppState', async () => {
    mockAppState.default = {
      newUser: {
        name: '',
        email: '',
      },
    };
    await act(async () => {
      const { getByTestId } = render(<Signup />);

      const pageContainer = getByTestId('PageContainer');
      const form = getByTestId('create-user-form');
      const fullNameInput = getByTestId('full-name-input');
      const usernameInput = getByTestId('username-input');
      const emailInput = getByTestId('email-input');
      const selectTeamLabel = getByTestId('select-team-label');
      const createButton = getByTestId('create-button');

      expect(pageContainer).toBeInTheDocument();
      expect(form).toBeInTheDocument();
      expect(fullNameInput).toHaveValue('');
      expect(usernameInput).toHaveValue('');
      expect(emailInput).toHaveValue('');
      expect(selectTeamLabel).toBeInTheDocument();
      expect(createButton).toBeInTheDocument();

      const onChangeHandler = jest.fn();

      fullNameInput.onchange = onChangeHandler;
      usernameInput.onchange = onChangeHandler;
      emailInput.onchange = onChangeHandler;

      fireEvent.change(fullNameInput, {
        target: { name: 'displayName', value: 'Fname Mname Lname' },
      });

      fireEvent.change(usernameInput, {
        target: { name: 'displayName', value: 'mockUserName' },
      });
      fireEvent.change(emailInput, {
        target: { name: 'displayName', value: 'sample@sample.com' },
      });

      expect(onChangeHandler).toBeCalledTimes(3);

      const onSubmitHandler = jest.fn();

      form.onsubmit = onSubmitHandler;

      fireEvent.submit(form);

      expect(onSubmitHandler).toBeCalledTimes(1);
    });
  });
});
