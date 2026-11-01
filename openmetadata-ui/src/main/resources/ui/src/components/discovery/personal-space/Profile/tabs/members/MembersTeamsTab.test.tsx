/*
 *  Copyright 2026 Collate.
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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Team } from '../../../../../../generated/entity/teams/team';
import MembersTeamsTab from './MembersTeamsTab';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

// Render only the filter slot of the table so the toggle/add-team button the
// component owns are exercised without TableV2 internals.
jest.mock('../../../../../common/Table/TableV2', () => ({
  __esModule: true,
  default: ({ extraTableFilters }: { extraTableFilters: React.ReactNode }) => (
    <div data-testid="table">{extraTableFilters}</div>
  ),
}));

const team = { name: 'Engineering', fullyQualifiedName: 'Engineering' } as Team;

const baseProps = {
  team,
  childTeamColumns: [],
  childTeamExpandable: {},
  filteredChildTeams: [],
  dragAndDropHooks: undefined,
  draggedTeamRef: { current: undefined },
  isTableHovered: false,
  isChildTeamsLoading: false,
  showDeletedTeam: false,
  searchTerm: '',
  canCreateTeam: true,
  movedTeam: undefined,
  teamsPage: 1,
  teamsPageSize: 10,
  teamsTotal: 0,
  onShowDeletedTeamChange: jest.fn(),
  onSearchTermChange: jest.fn(),
  onNavigate: jest.fn(),
  onSetMovedTeam: jest.fn(),
  onMoveConfirm: jest.fn(),
  onTeamsPageChange: jest.fn(),
  onTeamsPageSizeChange: jest.fn(),
} as unknown as React.ComponentProps<typeof MembersTeamsTab>;

const pageInput = () =>
  screen.queryByRole('textbox', { name: /current page|label.current-page/i });

describe('MembersTeamsTab', () => {
  it('navigates to the add-team form scoped to the parent team', () => {
    const onNavigate = jest.fn();
    render(<MembersTeamsTab {...baseProps} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByTestId('add-team'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'teams-add',
      parentFqn: 'Engineering',
    });
  });

  it('hides the add-team button without create permission', () => {
    render(<MembersTeamsTab {...baseProps} canCreateTeam={false} />);

    expect(screen.queryByTestId('add-team')).not.toBeInTheDocument();
  });

  it('reports show-deleted toggle changes', () => {
    const onShowDeletedTeamChange = jest.fn();
    render(
      <MembersTeamsTab
        {...baseProps}
        onShowDeletedTeamChange={onShowDeletedTeamChange}
      />
    );

    fireEvent.click(screen.getByTestId('show-deleted-teams'));

    expect(onShowDeletedTeamChange).toHaveBeenCalledWith(true);
  });

  it('confirms and cancels a pending team move from the modal', () => {
    const onMoveConfirm = jest.fn();
    const onSetMovedTeam = jest.fn();
    render(
      <MembersTeamsTab
        {...baseProps}
        movedTeam={{ from: team, to: undefined }}
        onMoveConfirm={onMoveConfirm}
        onSetMovedTeam={onSetMovedTeam}
      />
    );

    fireEvent.click(screen.getByTestId('confirm-button'));

    expect(onMoveConfirm).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onSetMovedTeam).toHaveBeenCalledWith(undefined);
  });

  it('hides the pager when every sub-team fits on one page', () => {
    render(<MembersTeamsTab {...baseProps} teamsTotal={8} />);

    expect(screen.queryByTestId('next')).not.toBeInTheDocument();
  });

  it('steps through pages with a minimal pager while browsing', () => {
    const onTeamsPageChange = jest.fn();
    render(
      <MembersTeamsTab
        {...baseProps}
        teamsTotal={25}
        onTeamsPageChange={onTeamsPageChange}
      />
    );

    fireEvent.click(screen.getByTestId('next'));

    expect(onTeamsPageChange).toHaveBeenCalledWith(2);
    // Cursor paging can only step, so no page number is offered to jump to.
    expect(pageInput()).not.toBeInTheDocument();
  });

  it('offers page jumps while searching', () => {
    render(
      <MembersTeamsTab {...baseProps} searchTerm="sales" teamsTotal={25} />
    );

    expect(pageInput()).toBeInTheDocument();
  });
});
