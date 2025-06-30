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
  screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Users from '../../components/Settings/Users/Users.component';
import { ROUTES } from '../../constants/constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { UPDATED_USER_DATA, USER_DATA } from '../../mocks/User.mock';
import { getUserByName, updateUserDetail } from '../../rest/userAPI';
import UserPage from './UserPage.component';

jest.mock('../../components/MyData/LeftSidebar/LeftSidebar.component', () =>
  jest.fn().mockReturnValue(<p>Sidebar</p>)
);

const mockUpdateCurrentUser = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../hooks/useApplicationStore', () => {
  return {
    useApplicationStore: jest.fn(() => ({
      currentUser: USER_DATA,
      updateCurrentUser: mockUpdateCurrentUser,
    })),
  };
});

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({
    fqn: 'xyz',
  })),
}));

jest.mock('../../rest/userAPI', () => ({
  getUserByName: jest.fn().mockImplementation(() => Promise.resolve(USER_DATA)),
  updateUserDetail: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ ...USER_DATA, defaultPersona: undefined })
    ),
}));

jest.mock('../../rest/feedsAPI', () => ({
  getFeedsWithFilter: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        data: [],
      },
    })
  ),
  postFeedById: jest.fn(),
}));

describe.skip('Test the User Page', () => {
  it('Should call getUserByName  API on load', async () => {
    render(<UserPage />, { wrapper: MemoryRouter });

    expect(getUserByName).toHaveBeenCalledWith('xyz', {
      fields: [
        'profile',
        'roles',
        'teams',
        'personas',
        'defaultPersona',
        'domains',
      ],
      include: 'all',
    });
  });

  it('Should render the user component', async () => {
    const { container } = render(<UserPage />, { wrapper: MemoryRouter });

    const userComponent = await findByText(container, /User Component/i);

    expect(userComponent).toBeInTheDocument();
  });

  it('Should render error placeholder if api fails', async () => {
    (getUserByName as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: {
            message: 'Error',
          },
        },
      })
    );
    const { container } = render(<UserPage />, { wrapper: MemoryRouter });

    const errorPlaceholder = await findByTestId(container, 'error');

    expect(errorPlaceholder).toBeInTheDocument();
  });

  it('Should call and update state data with patch api for defaultPersona', async () => {
    const userData = { ...USER_DATA };
    delete userData.defaultPersona;

    await act(async () => {
      render(<UserPage />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('UserComponentSaveButton'));
    });

    expect(updateUserDetail).toHaveBeenCalledWith(USER_DATA.id, [
      {
        op: 'remove',
        path: '/defaultPersona',
      },
    ]);

    expect(mockUpdateCurrentUser).toHaveBeenCalledWith(userData);
  });

  it('Should call updateCurrentUser if user is currentUser logged in', async () => {
    await act(async () => {
      render(<UserPage />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('UserComponentSaveButton'));
    });

    expect(mockUpdateCurrentUser).toHaveBeenCalled();
  });

  it('should update user isAdmin details if changes along with user', async () => {
    (Users as jest.Mock).mockImplementationOnce(({ updateUserDetails }) => (
      <div>
        <button
          onClick={() =>
            updateUserDetails(
              {
                isAdmin: false,
                roles: [
                  {
                    id: '7f8de4ae-8b08-431c-9911-8a355aa2976e',
                    name: 'ProfilerBotRole',
                    type: 'role',
                  },
                ],
              },
              'roles'
            )
          }>
          UserComponentSaveButton
        </button>
      </div>
    ));

    (updateUserDetail as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(UPDATED_USER_DATA)
    );

    await act(async () => {
      render(<UserPage />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('UserComponentSaveButton'));
    });

    expect(mockUpdateCurrentUser).toHaveBeenCalledWith(UPDATED_USER_DATA);
  });

  it('Should not call updateCurrentUser if user is not currentUser logged in', async () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
      currentUser: { ...USER_DATA, id: '123' },
      updateCurrentUser: mockUpdateCurrentUser,
    }));

    await act(async () => {
      render(<UserPage />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('UserComponentSaveButton'));
    });

    expect(mockUpdateCurrentUser).not.toHaveBeenCalled();
  });

  it('Should trigger routeChange to landingPage on afterDeleteAction if hardDeleted', async () => {
    await act(async () => {
      render(<UserPage />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('UserComponentAfterDeleteActionButton'));
    });

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.HOME);
  });
});

describe('UserPage - Activity Time Fields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should fetch lastActivityTime and lastLoginTime fields', async () => {
    render(<UserPage />, { wrapper: MemoryRouter });

    expect(getUserByName).toHaveBeenCalledWith('xyz', {
      fields: [
        'profile',
        'roles',
        'teams',
        'personas',
        'lastActivityTime',
        'lastLoginTime',
        'defaultPersona',
        'domains',
      ],
      include: 'all',
    });
  });

  it('Should pass user data with activity times to Users component', async () => {
    const userDataWithActivityTime = {
      ...USER_DATA,
      lastActivityTime: 1234567890,
      lastLoginTime: 1234567880,
    };

    (getUserByName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(userDataWithActivityTime)
    );

    (Users as jest.Mock).mockImplementationOnce(({ userData }) => (
      <div data-testid="user-data">{JSON.stringify(userData)}</div>
    ));

    await act(async () => {
      render(<UserPage />, { wrapper: MemoryRouter });
    });

    const userData = JSON.parse(
      screen.getByTestId('user-data').textContent || '{}'
    );

    expect(userData.lastActivityTime).toBe(1234567890);
    expect(userData.lastLoginTime).toBe(1234567880);
  });
});
