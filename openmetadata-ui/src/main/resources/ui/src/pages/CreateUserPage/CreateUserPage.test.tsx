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

import {
  act,
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createUser } from 'rest/userAPI';
import AddUserPageComponent from './CreateUserPage.component';

const mockUserRole = {
  data: [
    {
      id: '3ed7b995-ce8b-4720-9beb-6f4a9c626920',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      displayName: 'Data Consumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      version: 0.1,
      updatedAt: 1663825430544,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/roles/3ed7b995-ce8b-4720-9beb-6f4a9c626920',
      allowDelete: false,
      deleted: false,
    },
  ],
  paging: {
    total: 1,
  },
};

jest.mock('rest/rolesAPIV1', () => ({
  getRoles: jest.fn().mockImplementation(() => Promise.resolve(mockUserRole)),
}));

jest.mock('components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainerV1">{children}</div>
    ));
});

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('components/CreateUser/CreateUser.component', () => {
  return jest
    .fn()
    .mockImplementation(({ onSave }) => (
      <div onClick={onSave}>CreateUser component</div>
    ));
});

jest.mock('rest/userAPI', () => ({
  createUser: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../AppState', () =>
  jest.fn().mockReturnValue({
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

    expect(mockCreateUser).toHaveBeenCalled();
  });
});
