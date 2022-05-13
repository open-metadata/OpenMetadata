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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ReactNode } from 'react';
import {
  getTeamByName,
  getTeams,
  patchTeamDetail,
} from '../../axiosAPIs/teamsAPI';
import TeamsAndUsersPageComponent from './TeamsAndUsersPage.component';
import {
  getMockTeamByName,
  getMockTeams,
  getMockUsers,
} from './TeamsAndUsersPage.mock';

const MOCK_TEAM = 'Cloud_Infra';
const MOCK_USER = 'users';
const MOCK_ADMIN = 'admins';
const MOCK_BOTS = 'bots';
const PARAMS_VALUE: {
  teamAndUser: string | undefined;
} = { teamAndUser: MOCK_TEAM };
const MOCK_HISTORY = {
  push: jest.fn(),
};

jest.mock('../../components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainerV1">{children}</div>
    ));
});

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
    })),
  };
});

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => MOCK_HISTORY),
  useParams: jest.fn().mockImplementation(() => PARAMS_VALUE),
}));

jest.mock('../../axiosAPIs/teamsAPI', () => ({
  createTeam: jest.fn(),
  getTeamByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: getMockTeamByName })),
  getTeams: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: getMockTeams })),
  patchTeamDetail: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: getMockTeamByName })),
}));

jest.mock('../../axiosAPIs/userAPI', () => ({
  deleteUser: jest.fn(),
  updateUserDetail: jest.fn(),
  getUsers: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: getMockUsers })),
}));

jest.mock('../../axiosAPIs/miscAPI', () => ({
  searchData: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: getMockUsers })),
}));

jest.mock('../../components/TeamsAndUsers/TeamsAndUsers.component', () => {
  return jest
    .fn()
    .mockImplementation(
      ({
        activeUserTabHandler,
        handleAddUser,
        handleAddTeam,
        descriptionHandler,
        addUsersToTeam,
        afterDeleteAction,
        handleUserSearchTerm,
        handleAddNewUser,
        changeCurrentTeam,
      }) => (
        <div data-testid="teamsAndUsers-component">
          <button onClick={afterDeleteAction}>afterDeleteAction</button>
          <button onClick={() => changeCurrentTeam('test')}>
            changeCurrentTeam
          </button>
          <button onClick={activeUserTabHandler}>activeUserTabHandler</button>
          <button onClick={handleAddUser}>handleAddUser</button>
          <button onClick={handleAddTeam}>handleAddTeam</button>
          <button onClick={descriptionHandler}>descriptionHandler</button>
          <button onClick={() => addUsersToTeam([])}>addUsersToTeam</button>
          <button onClick={handleAddNewUser}>handleAddNewUser</button>

          <input
            data-testid="search-box"
            type="text"
            onChange={(e) => handleUserSearchTerm(e.target.value)}
          />
        </div>
      )
    );
});

describe('TeamsAndUsersPage component test', () => {
  it('TeamsAndUsersPage should render', async () => {
    await act(async () => {
      render(<TeamsAndUsersPageComponent />);

      const PageContainerV1 = await screen.findByTestId('PageContainerV1');
      const teamsAndUsersComponent = await screen.findByTestId(
        'teamsAndUsers-component'
      );

      expect(PageContainerV1).toBeInTheDocument();
      expect(teamsAndUsersComponent).toBeInTheDocument();
    });
  });

  it('Function calls should work properly', async () => {
    PARAMS_VALUE.teamAndUser = MOCK_TEAM;
    await act(async () => {
      render(<TeamsAndUsersPageComponent />);

      const PageContainerV1 = await screen.findByTestId('PageContainerV1');
      const teamsAndUsersComponent = await screen.findByTestId(
        'teamsAndUsers-component'
      );
      const activeUserTabHandler = await screen.findByText(
        'activeUserTabHandler'
      );
      const handleAddUser = await screen.findByText('handleAddUser');
      const handleAddTeam = await screen.findByText('handleAddTeam');
      const descriptionHandler = await screen.findByText('descriptionHandler');
      const addUsersToTeam = await screen.findByText('addUsersToTeam');
      const afterDeleteAction = await screen.findByText('afterDeleteAction');
      const handleAddNewUser = await screen.findByText('handleAddNewUser');
      const changeCurrentTeam = await screen.findByText('changeCurrentTeam');

      expect(PageContainerV1).toBeInTheDocument();
      expect(teamsAndUsersComponent).toBeInTheDocument();

      expect(activeUserTabHandler).toBeInTheDocument();
      expect(handleAddUser).toBeInTheDocument();
      expect(handleAddTeam).toBeInTheDocument();
      expect(descriptionHandler).toBeInTheDocument();
      expect(addUsersToTeam).toBeInTheDocument();
      expect(afterDeleteAction).toBeInTheDocument();
      expect(handleAddNewUser).toBeInTheDocument();
      expect(changeCurrentTeam).toBeInTheDocument();

      userEvent.click(activeUserTabHandler);
      userEvent.click(handleAddUser);
      userEvent.click(changeCurrentTeam);
      userEvent.click(handleAddTeam);
      userEvent.click(descriptionHandler);
      userEvent.click(addUsersToTeam);
      userEvent.click(handleAddNewUser);
      userEvent.click(afterDeleteAction);
    });
  });

  it('TeamsAndUsersPage should render properly if provided users param', async () => {
    PARAMS_VALUE.teamAndUser = MOCK_USER;
    await act(async () => {
      render(<TeamsAndUsersPageComponent />);

      const PageContainerV1 = await screen.findByTestId('PageContainerV1');
      const teamsAndUsersComponent = await screen.findByTestId(
        'teamsAndUsers-component'
      );

      expect(PageContainerV1).toBeInTheDocument();
      expect(teamsAndUsersComponent).toBeInTheDocument();
    });
  });

  it('TeamsAndUsersPage should render properly if provided admin param', async () => {
    PARAMS_VALUE.teamAndUser = MOCK_ADMIN;
    await act(async () => {
      render(<TeamsAndUsersPageComponent />);

      const PageContainerV1 = await screen.findByTestId('PageContainerV1');
      const teamsAndUsersComponent = await screen.findByTestId(
        'teamsAndUsers-component'
      );

      expect(PageContainerV1).toBeInTheDocument();
      expect(teamsAndUsersComponent).toBeInTheDocument();
    });
  });

  it('TeamsAndUsersPage should render properly if provided bots param', async () => {
    PARAMS_VALUE.teamAndUser = MOCK_BOTS;
    await act(async () => {
      render(<TeamsAndUsersPageComponent />);

      const PageContainerV1 = await screen.findByTestId('PageContainerV1');
      const teamsAndUsersComponent = await screen.findByTestId(
        'teamsAndUsers-component'
      );

      expect(PageContainerV1).toBeInTheDocument();
      expect(teamsAndUsersComponent).toBeInTheDocument();
    });
  });

  it('TeamsAndUsersPage should render properly if provided no param', async () => {
    PARAMS_VALUE.teamAndUser = undefined;
    await act(async () => {
      render(<TeamsAndUsersPageComponent />);

      const PageContainerV1 = await screen.findByTestId('PageContainerV1');
      const teamsAndUsersComponent = await screen.findByTestId(
        'teamsAndUsers-component'
      );

      expect(PageContainerV1).toBeInTheDocument();
      expect(teamsAndUsersComponent).toBeInTheDocument();
    });
  });

  it('Search action function should work for usears page', async () => {
    PARAMS_VALUE.teamAndUser = MOCK_USER;
    await act(async () => {
      render(<TeamsAndUsersPageComponent />);

      const PageContainerV1 = await screen.findByTestId('PageContainerV1');
      const teamsAndUsersComponent = await screen.findByTestId(
        'teamsAndUsers-component'
      );
      const searchBox = await screen.findByTestId('search-box');
      userEvent.type(searchBox, 'test');

      expect(PageContainerV1).toBeInTheDocument();
      expect(teamsAndUsersComponent).toBeInTheDocument();
    });
  });

  it('Search action function should work for admin page', async () => {
    PARAMS_VALUE.teamAndUser = MOCK_ADMIN;
    await act(async () => {
      render(<TeamsAndUsersPageComponent />);

      const PageContainerV1 = await screen.findByTestId('PageContainerV1');
      const teamsAndUsersComponent = await screen.findByTestId(
        'teamsAndUsers-component'
      );
      const searchBox = await screen.findByTestId('search-box');
      userEvent.type(searchBox, 'test');

      expect(PageContainerV1).toBeInTheDocument();
      expect(teamsAndUsersComponent).toBeInTheDocument();
    });
  });

  describe('render Sad Paths', () => {
    it('should render component if patchTeamDetail api fails', async () => {
      PARAMS_VALUE.teamAndUser = MOCK_TEAM;
      (patchTeamDetail as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' } },
        })
      );
      await act(async () => {
        render(<TeamsAndUsersPageComponent />);

        const PageContainerV1 = await screen.findByTestId('PageContainerV1');
        const teamsAndUsersComponent = await screen.findByTestId(
          'teamsAndUsers-component'
        );

        const addUsersToTeam = await screen.findByText('addUsersToTeam');

        expect(addUsersToTeam).toBeInTheDocument();

        userEvent.click(addUsersToTeam);

        expect(PageContainerV1).toBeInTheDocument();
        expect(teamsAndUsersComponent).toBeInTheDocument();
      });
    });

    it('should render component if patchTeamDetail api has no data', async () => {
      PARAMS_VALUE.teamAndUser = MOCK_TEAM;
      (patchTeamDetail as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          response: { data: '' },
        })
      );
      await act(async () => {
        render(<TeamsAndUsersPageComponent />);

        const PageContainerV1 = await screen.findByTestId('PageContainerV1');
        const teamsAndUsersComponent = await screen.findByTestId(
          'teamsAndUsers-component'
        );

        const addUsersToTeam = await screen.findByText('addUsersToTeam');

        expect(addUsersToTeam).toBeInTheDocument();

        userEvent.click(addUsersToTeam);

        expect(PageContainerV1).toBeInTheDocument();
        expect(teamsAndUsersComponent).toBeInTheDocument();
      });
    });

    it('should render component if getTeams api fails', async () => {
      PARAMS_VALUE.teamAndUser = MOCK_TEAM;
      (getTeams as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' } },
        })
      );
      await act(async () => {
        render(<TeamsAndUsersPageComponent />);

        const PageContainerV1 = await screen.findByTestId('PageContainerV1');
        const teamsAndUsersComponent = await screen.findByTestId(
          'teamsAndUsers-component'
        );

        const addUsersToTeam = await screen.findByText('addUsersToTeam');

        expect(addUsersToTeam).toBeInTheDocument();

        userEvent.click(addUsersToTeam);

        expect(PageContainerV1).toBeInTheDocument();
        expect(teamsAndUsersComponent).toBeInTheDocument();
      });
    });

    it('should render component if getTeams api has no data', async () => {
      PARAMS_VALUE.teamAndUser = MOCK_TEAM;
      (getTeams as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          response: { data: '' },
        })
      );
      await act(async () => {
        render(<TeamsAndUsersPageComponent />);

        const PageContainerV1 = await screen.findByTestId('PageContainerV1');
        const teamsAndUsersComponent = await screen.findByTestId(
          'teamsAndUsers-component'
        );

        const addUsersToTeam = await screen.findByText('addUsersToTeam');

        expect(addUsersToTeam).toBeInTheDocument();

        userEvent.click(addUsersToTeam);

        expect(PageContainerV1).toBeInTheDocument();
        expect(teamsAndUsersComponent).toBeInTheDocument();
      });
    });

    it('should render component if getTeamByName api fails', async () => {
      PARAMS_VALUE.teamAndUser = MOCK_TEAM;
      (getTeamByName as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' } },
        })
      );
      await act(async () => {
        render(<TeamsAndUsersPageComponent />);

        const PageContainerV1 = await screen.findByTestId('PageContainerV1');
        const teamsAndUsersComponent = await screen.findByTestId(
          'teamsAndUsers-component'
        );

        const addUsersToTeam = await screen.findByText('addUsersToTeam');

        expect(addUsersToTeam).toBeInTheDocument();

        userEvent.click(addUsersToTeam);

        expect(PageContainerV1).toBeInTheDocument();
        expect(teamsAndUsersComponent).toBeInTheDocument();
      });
    });

    it('should render component if getTeamByName api has no data', async () => {
      PARAMS_VALUE.teamAndUser = MOCK_TEAM;
      (getTeamByName as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          response: { data: '' },
        })
      );
      await act(async () => {
        render(<TeamsAndUsersPageComponent />);

        const PageContainerV1 = await screen.findByTestId('PageContainerV1');
        const teamsAndUsersComponent = await screen.findByTestId(
          'teamsAndUsers-component'
        );

        const addUsersToTeam = await screen.findByText('addUsersToTeam');

        expect(addUsersToTeam).toBeInTheDocument();

        userEvent.click(addUsersToTeam);

        expect(PageContainerV1).toBeInTheDocument();
        expect(teamsAndUsersComponent).toBeInTheDocument();
      });
    });
  });
});
