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

import { act, findByText, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createUser } from '../../rest/userAPI';
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

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockReturnValue({
    state: { isAdminPage: false },
  }),
  useParams: jest.fn().mockReturnValue({
    bot: undefined,
  }),
  useNavigate: jest.fn(),
}));

jest.mock('../../rest/rolesAPIV1', () => ({
  getRoles: jest.fn().mockImplementation(() => Promise.resolve(mockUserRole)),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock(
  '../../components/Settings/Users/CreateUser/CreateUser.component',
  () => {
    return jest
      .fn()
      .mockImplementation(({ onSave }) => (
        <div onClick={onSave}>CreateUser component</div>
      ));
  }
);

jest.mock('../../rest/userAPI', () => ({
  createUser: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <>{children}</>);
});

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <p>TitleBreadcrumb</p>);
  }
);

const mockCreateUser = jest.fn(() => Promise.resolve({}));

describe('Test AddUserPage component', () => {
  it('AddUserPage component should render properly', async () => {
    const { container } = render(<AddUserPageComponent />, {
      wrapper: MemoryRouter,
    });

    const createUserComponent = await findByText(
      container,
      /CreateUser component/i
    );

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
