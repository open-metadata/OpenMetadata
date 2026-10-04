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
import MembersUsersTab from './MembersUsersTab';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('../../../../../common/Table/TableV2', () => ({
  __esModule: true,
  default: ({ extraTableFilters }: { extraTableFilters: React.ReactNode }) => (
    <div data-testid="table">{extraTableFilters}</div>
  ),
}));

jest.mock(
  '../../../../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: ({
      children,
      onUpdate,
    }: {
      children: React.ReactNode;
      onUpdate: (u: unknown[]) => void;
    }) => (
      <div>
        {children}
        <button
          data-testid="mock-select-update"
          onClick={() => onUpdate([{ id: 'u1' }])}
        />
      </div>
    ),
  })
);

jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');

  return {
    ...actual,
    PaginationCardWithControls: () => <div data-testid="pagination" />,
  };
});

const team = { name: 'Engineering', users: [] } as unknown as Team;

const baseProps = {
  team,
  userColumns: [],
  filteredTeamUsers: [],
  isTeamUsersLoading: false,
  usersSearchTerm: '',
  canEditAll: true,
  isGroupType: true,
  usersPage: 1,
  usersPageSize: 15,
  usersPaging: { total: 0 },
  showUsersPagination: false,
  onUsersSearchTermChange: jest.fn(),
  onAddUsers: jest.fn(),
  onUsersExport: jest.fn(),
  onNavigate: jest.fn(),
  onTeamUsersPageNavigation: jest.fn(),
  onUsersPageSizeChange: jest.fn(),
} as unknown as React.ComponentProps<typeof MembersUsersTab>;

describe('MembersUsersTab', () => {
  it('shows the add-user affordance and forwards the selection', () => {
    const onAddUsers = jest.fn();
    render(<MembersUsersTab {...baseProps} onAddUsers={onAddUsers} />);

    expect(screen.getByTestId('add-user')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mock-select-update'));

    expect(onAddUsers).toHaveBeenCalledWith([{ id: 'u1' }]);
  });

  it('hides the add-user affordance without edit permission', () => {
    render(<MembersUsersTab {...baseProps} canEditAll={false} />);

    expect(screen.queryByTestId('add-user')).not.toBeInTheDocument();
  });

  it('renders pagination only when there is more than one page', () => {
    const { rerender } = render(<MembersUsersTab {...baseProps} />);

    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();

    rerender(<MembersUsersTab {...baseProps} showUsersPagination />);

    expect(screen.getByTestId('pagination')).toBeInTheDocument();
  });
});
