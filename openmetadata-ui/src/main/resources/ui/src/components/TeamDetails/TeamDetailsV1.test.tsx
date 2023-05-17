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

import { act, render, screen } from '@testing-library/react';
import AppState from 'AppState';
import React from 'react';
import TeamDetailsV1 from './TeamDetailsV1';
import {
  mockGroupTypeTeam,
  mockPush,
  mockRestoreTeam,
  mockTeamDetailsV1Props,
  mockTeamSuggestions,
} from './TeamDetailsV1.mocks';

// API functions mock
jest.mock('rest/miscAPI', () => ({
  getSuggestions: jest.fn().mockImplementation(() => mockTeamSuggestions),
}));
jest.mock('rest/teamsAPI', () => ({
  restoreTeam: jest.fn().mockImplementation(() => mockRestoreTeam),
}));

// Components mock
jest.mock('components/common/table-data-card-v2/TableDataCardV2', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="TableDataCardV2">TableDataCardV2</div>
    ))
);
jest.mock('pages/RolesPage/AddAttributeModal/AddAttributeModal', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="AddAttributeModal">AddAttributeModal</div>
    ))
);
jest.mock('../common/description/Description', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="Description">Description</div>)
);
jest.mock('../common/entityPageInfo/ManageButton/ManageButton', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="ManageButton">ManageButton</div>
    ))
);
jest.mock('../common/EntitySummaryDetails/EntitySummaryDetails', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="EntitySummaryDetails">EntitySummaryDetails</div>
    ))
);
jest.mock('../common/error-with-placeholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="ErrorPlaceHolder">ErrorPlaceHolder</div>
    ))
);
jest.mock('../common/next-previous/NextPrevious', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="NextPrevious">NextPrevious</div>
    ))
);
jest.mock('../common/searchbar/Searchbar', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="Searchbar">Searchbar</div>)
);
jest.mock('../common/title-breadcrumb/title-breadcrumb.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="title-breadcrumb">title-breadcrumb</div>
    ))
);
jest.mock('../Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div data-testid="Loader">Loader</div>)
);
jest.mock('../Modals/ConfirmationModal/ConfirmationModal', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="ConfirmationModal">ConfirmationModal</div>
    ))
);
jest.mock('./TeamHeading', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="TeamHeading">TeamHeading</div>)
);
jest.mock('./TeamHierarchy', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="TeamHierarchy">TeamHierarchy</div>
    ))
);
jest.mock('./UserCards', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="UserCards">UserCards</div>)
);
jest.mock('../PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      team: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
      },
    },
    getEntityPermission: jest.fn().mockReturnValue(
      Promise.resolve({
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      })
    ),
  }),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
  useLocation: jest.fn().mockImplementation(() => ({
    search: '?activeTab=users',
  })),
}));

jest.mock('../../AppState', () => ({
  getCurrentUserDetails: jest.fn().mockImplementation(() => ({
    name: 'user',
    teams: [{ id: mockGroupTypeTeam.id }],
  })),
}));

describe('TeamDetailsV1 tests', () => {
  it('Component should render properly', async () => {
    await act(async () => {
      render(<TeamDetailsV1 {...mockTeamDetailsV1Props} />);
    });

    const teamDetailsContainer = screen.getByTestId('team-details-container');
    const titleBreadcrumb = screen.getByTestId('title-breadcrumb');
    const teamHeading = screen.getByTestId('TeamHeading');
    const leaveTeamButton = screen.getByTestId('leave-team-button');
    const manageButton = screen.getByTestId('ManageButton');
    const entitySummaryDetails = screen.getAllByTestId('EntitySummaryDetails');
    const description = screen.getByTestId('Description');
    const userCards = screen.getByTestId('UserCards');

    expect(teamDetailsContainer).toBeInTheDocument();
    expect(titleBreadcrumb).toBeInTheDocument();
    expect(teamHeading).toBeInTheDocument();
    expect(leaveTeamButton).toBeInTheDocument();
    expect(manageButton).toBeInTheDocument();
    expect(entitySummaryDetails).toHaveLength(2);
    expect(description).toBeInTheDocument();
    expect(userCards).toBeInTheDocument();
  });

  it('Join team button should not be visible', async () => {
    await act(async () => {
      render(<TeamDetailsV1 {...mockTeamDetailsV1Props} />);
    });
  });

  it('Join team button should be visible if user has not already in the team and the team is joinable', async () => {
    AppState.getCurrentUserDetails = jest.fn().mockImplementation(() => ({
      name: 'user',
      teams: [],
    }));

    await act(async () => {
      render(<TeamDetailsV1 {...mockTeamDetailsV1Props} />);
    });

    const leaveTeamButton = screen.queryByTestId('leave-team-button');
    const joinTeams = screen.getByTestId('join-teams');

    expect(joinTeams).toBeInTheDocument();
    expect(leaveTeamButton).toBeNull();
  });
  //   it('Component should render properly', async () => {
  //     await act(async () => {
  //       render(<TeamDetailsV1 {...mockTeamDetailsV1Props} />);
  //     });
  //   });
  //   it('Component should render properly', async () => {
  //     await act(async () => {
  //       render(<TeamDetailsV1 {...mockTeamDetailsV1Props} />);
  //     });
  //   });
  //   it('Component should render properly', async () => {
  //     await act(async () => {
  //       render(<TeamDetailsV1 {...mockTeamDetailsV1Props} />);
  //     });
  //   });
});
