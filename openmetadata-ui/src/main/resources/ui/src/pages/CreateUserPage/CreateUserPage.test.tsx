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
  act,
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createUser } from '../../axiosAPIs/userAPI';
import AddUserPageComponent from './CreateUserPage.component';

jest.mock('../../components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainerV1">{children}</div>
    ));
});

jest.mock('../../authentication/auth-provider/AuthProvider', () => ({
  useAuthContext: jest.fn().mockReturnValue({ isAuthDisabled: true }),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../components/CreateUser/CreateUser.component', () => {
  return jest
    .fn()
    .mockImplementation(({ onSave }) => (
      <div onClick={onSave}>CreateUser component</div>
    ));
});

jest.mock('../../axiosAPIs/userAPI', () => ({
  createUser: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../AppState', () =>
  jest.fn().mockReturnValue({
    userRoles: [],
    userTeams: [],
  })
);

const mockCreateUser = jest.fn(() => Promise.resolve({}));

describe('Test AddUserPage component', () => {
  it('AddUserPage component should render properly', async () => {
    const { container } = render(<AddUserPageComponent />, {
      wrapper: MemoryRouter,
    });

    const pageContainerV1 = await findByTestId(container, 'PageContainerV1');
    const createUserComponent = await findByText(
      container,
      /CreateUser component/i
    );

    expect(pageContainerV1).toBeInTheDocument();
    expect(createUserComponent).toBeInTheDocument();
  });

  it('should create user', async () => {
    (createUser as jest.Mock).mockImplementationOnce(mockCreateUser);

    const { container } = render(<AddUserPageComponent />, {
      wrapper: MemoryRouter,
    });

    await act(async () => {
      fireEvent.click(await findByText(container, /CreateUser component/i));
    });

    expect(mockCreateUser).toBeCalled();
  });
});
