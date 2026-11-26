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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Team } from '../../../../../../generated/entity/teams/team';
import MembersTeamsTab from './MembersTeamsTab';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

// Render the filter slot and bare keyed rows so the toggle/add-team button and
// the move anchor are exercised without TableV2 internals.
jest.mock('../../../../../common/Table/TableV2', () => ({
  __esModule: true,
  default: ({
    extraTableFilters,
    dataSource,
  }: {
    extraTableFilters: React.ReactNode;
    dataSource: Team[];
  }) => (
    <div data-testid="table">
      {extraTableFilters}
      {dataSource.map((row) => (
        <div data-row-key={row.fullyQualifiedName} key={row.name} />
      ))}
    </div>
  ),
}));

// jsdom has no layout, so expose which element the popover is anchored to.
jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');

  return {
    ...actual,
    ConfirmPopover: (props: {
      triggerRef?: React.RefObject<Element | null>;
      isOpen?: boolean;
    }) => (
      <>
        {props.isOpen && (
          <span
            data-anchor={
              props.triggerRef?.current?.getAttribute('data-row-key') ?? 'table'
            }
            data-testid="move-anchor"
          />
        )}
        <actual.ConfirmPopover {...props} />
      </>
    ),
  };
});

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

  it('confirms a pending team move from a popover', async () => {
    const onMoveConfirm = jest.fn().mockResolvedValue(undefined);
    const onSetMovedTeam = jest.fn();
    render(
      <MembersTeamsTab
        {...baseProps}
        movedTeam={{ from: team, to: undefined }}
        onMoveConfirm={onMoveConfirm}
        onSetMovedTeam={onSetMovedTeam}
      />
    );

    expect(await screen.findByTestId('move-team-popover')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('move-team-popover-confirm'));

    await waitFor(() => expect(onMoveConfirm).toHaveBeenCalled());
    await waitFor(() => expect(onSetMovedTeam).toHaveBeenCalledWith(undefined));
  });

  it('cancels a pending team move without moving it', async () => {
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

    fireEvent.click(await screen.findByTestId('move-team-popover-cancel'));

    expect(onSetMovedTeam).toHaveBeenCalledWith(undefined);
    expect(onMoveConfirm).not.toHaveBeenCalled();
  });

  it('anchors the move popover to the drop-target row, not the whole table', () => {
    const source = { name: 'Src', fullyQualifiedName: 'Src' } as Team;
    const target = { name: 'Dst', fullyQualifiedName: 'Dst' } as Team;
    const props = { ...baseProps, filteredChildTeams: [source, target] };
    const { rerender } = render(<MembersTeamsTab {...props} />);

    rerender(
      <MembersTeamsTab {...props} movedTeam={{ from: source, to: target }} />
    );

    expect(screen.getByTestId('move-anchor')).toHaveAttribute(
      'data-anchor',
      'Dst'
    );
  });

  it('anchors a move to root on the dragged row', () => {
    const source = { name: 'Src', fullyQualifiedName: 'Src' } as Team;
    const props = { ...baseProps, filteredChildTeams: [source] };
    const { rerender } = render(<MembersTeamsTab {...props} />);

    rerender(<MembersTeamsTab {...props} movedTeam={{ from: source }} />);

    expect(screen.getByTestId('move-anchor')).toHaveAttribute(
      'data-anchor',
      'Src'
    );
  });

  it('shows no move popover when nothing is being moved', () => {
    render(<MembersTeamsTab {...baseProps} />);

    expect(screen.queryByTestId('move-team-popover')).not.toBeInTheDocument();
  });

  it('shows the pager for a single page of sub-teams', () => {
    render(<MembersTeamsTab {...baseProps} teamsTotal={8} />);

    expect(screen.getByTestId('next')).toBeInTheDocument();
  });

  it('hides the pager when there are no sub-teams', () => {
    render(<MembersTeamsTab {...baseProps} teamsTotal={0} />);

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
