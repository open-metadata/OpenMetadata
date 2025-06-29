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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  MOCK_CURRENT_TEAM,
  MOCK_TABLE_DATA,
} from '../../../../mocks/Teams.mock';
import { TeamHierarchyProps } from './team.interface';
import TeamHierarchy from './TeamHierarchy';

const teamHierarchyPropsData: TeamHierarchyProps = {
  data: MOCK_TABLE_DATA,
  currentTeam: MOCK_CURRENT_TEAM,
  onTeamExpand: jest.fn(),
  isFetchingAllTeamAdvancedDetails: false,
  showDeletedTeam: false,
  onShowDeletedTeamChange: jest.fn(),
  handleAddTeamButtonClick: jest.fn(),
  createTeamPermission: true,
  isTeamDeleted: false,
  handleTeamSearch: jest.fn(),
};

const mockShowErrorToast = jest.fn();

// mock library imports
jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }) => <a href="#">{children}</a>),
}));

jest.mock('../../../../utils/TeamUtils', () => ({
  getMovedTeamData: jest.fn().mockReturnValue([]),
  isDropRestricted: jest.fn().mockReturnValue(false),
}));

jest.mock('../../../../rest/teamsAPI', () => ({
  updateTeam: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_CURRENT_TEAM)),
  getTeamByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_CURRENT_TEAM)),
}));

jest.mock('../../../../utils/StringsUtils', () => ({
  ...jest.requireActual('../../../../utils/StringsUtils'),
  stringToHTML: jest.fn((text) => text),
}));

jest.mock('../../../../utils/EntityUtils', () => {
  return {
    getEntityName: jest.fn().mockReturnValue('entityName'),
    highlightSearchText: jest.fn((text) => text),
  };
});

jest.mock('../../../../utils/RouterUtils', () => ({
  getTeamsWithFqnPath: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockImplementation(() => mockShowErrorToast),
}));

jest.mock('../../../common/SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockImplementation(() => <div>SearchBar</div>)
);

describe('Team Hierarchy page', () => {
  it('Initially, Table should load', async () => {
    await act(async () => {
      render(<TeamHierarchy {...teamHierarchyPropsData} />, {
        wrapper: MemoryRouter,
      });
    });

    const table = await screen.findByTestId('team-hierarchy-table');

    expect(table).toBeInTheDocument();
  });

  it('Should render all table columns', async () => {
    await act(async () => {
      render(<TeamHierarchy {...teamHierarchyPropsData} />, {
        wrapper: MemoryRouter,
      });
    });

    const table = await screen.findByTestId('team-hierarchy-table');
    const teamsColumn = await screen.findByText('label.team-plural');
    const typeColumn = await screen.findByText('label.type');
    const subTeamsColumn = await screen.findByText('label.sub-team-plural');
    const usersColumn = await screen.findByText('label.user-plural');
    const assetCountColumn = await screen.findByText('label.entity-count');
    const descriptionColumn = await screen.findByText('label.description');
    const rows = await screen.findAllByRole('row');

    expect(table).toBeInTheDocument();
    expect(teamsColumn).toBeInTheDocument();
    expect(typeColumn).toBeInTheDocument();
    expect(subTeamsColumn).toBeInTheDocument();
    expect(usersColumn).toBeInTheDocument();
    expect(assetCountColumn).toBeInTheDocument();
    expect(descriptionColumn).toBeInTheDocument();

    expect(rows).toHaveLength(MOCK_TABLE_DATA.length + 1);
  });

  it('Should render child row in table', async () => {
    await act(async () => {
      render(<TeamHierarchy {...teamHierarchyPropsData} />, {
        wrapper: MemoryRouter,
      });
    });

    const table = await screen.findByTestId('team-hierarchy-table');

    expect(table).toBeInTheDocument();

    const expandableTableRow = await screen.getAllByTestId('expand-icon');
    fireEvent.click(expandableTableRow[0]);

    const totalRows = await screen.findAllByText('entityName');

    expect(totalRows).toHaveLength(5);
  });
});
