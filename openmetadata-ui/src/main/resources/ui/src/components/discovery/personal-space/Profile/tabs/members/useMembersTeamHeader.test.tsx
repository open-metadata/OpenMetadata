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
import { Team, TeamType } from '../../../../../../generated/entity/teams/team';
import { MembersHeaderPatch } from './Members.types';
import { UseMembersTeamHeaderParams } from './MembersTeamDetail.types';
import { useMembersTeamHeader } from './useMembersTeamHeader';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

const Harness = (props: UseMembersTeamHeaderParams) => {
  useMembersTeamHeader(props);

  return null;
};

const buildParams = (
  overrides: Partial<UseMembersTeamHeaderParams> = {}
): UseMembersTeamHeaderParams => ({
  team: {
    name: 'team1',
    fullyQualifiedName: 'team1',
    displayName: 'Team One',
    teamType: TeamType.Group,
  } as Team,
  isLoading: false,
  isEditingName: false,
  editNameValue: '',
  canEditAll: true,
  canEditDisplayName: true,
  canDelete: true,
  canCreateTeam: true,
  isGroupType: true,
  isOrgType: false,
  isCurrentUserMember: false,
  onEditNameValueChange: jest.fn(),
  onStartEditName: jest.fn(),
  onCancelEditName: jest.fn(),
  onSaveDisplayName: jest.fn(),
  onTeamExport: jest.fn(),
  onTeamImport: jest.fn(),
  onToggleJoinable: jest.fn(),
  onRestoreTeam: jest.fn(),
  onJoinTeam: jest.fn(),
  onLeaveTeam: jest.fn(),
  onDelete: jest.fn(),
  onSetHeader: jest.fn(),
  ...overrides,
});

// The hook makes a single onSetHeader({ actions, titleInput, titleSuffix }) call.
const lastPatch = (fn: unknown): MembersHeaderPatch =>
  (fn as jest.Mock).mock.calls.at(-1)?.[0] ?? {};

describe('useMembersTeamHeader', () => {
  it('does nothing until the team is loaded', () => {
    const params = buildParams({ team: undefined });
    render(<Harness {...params} />);

    expect(params.onSetHeader).not.toHaveBeenCalled();
  });

  it('provides an edit-display-name suffix that starts the rename', () => {
    const params = buildParams();
    render(<Harness {...params} />);

    render(<>{lastPatch(params.onSetHeader).titleSuffix}</>);
    fireEvent.click(screen.getByTestId('edit-display-name'));

    expect(params.onStartEditName).toHaveBeenCalledWith('Team One');
  });

  it('omits the edit suffix while the name is being edited', () => {
    const params = buildParams({ isEditingName: true });
    render(<Harness {...params} />);

    expect(lastPatch(params.onSetHeader).titleSuffix).toBeUndefined();
  });

  it('provides a title input with wired save/cancel while editing', () => {
    const params = buildParams({ isEditingName: true, editNameValue: 'New' });
    render(<Harness {...params} />);

    render(<>{lastPatch(params.onSetHeader).titleInput}</>);

    expect(screen.getByTestId('display-name-input')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('save-display-name'));
    fireEvent.click(screen.getByTestId('cancel-display-name'));

    expect(params.onSaveDisplayName).toHaveBeenCalled();
    expect(params.onCancelEditName).toHaveBeenCalled();
  });

  it('offers a join button for a group the user has not joined', () => {
    const params = buildParams({ isCurrentUserMember: false });
    render(<Harness {...params} />);

    render(<>{lastPatch(params.onSetHeader).actions}</>);

    expect(screen.getByTestId('join-team-button')).toBeInTheDocument();
    expect(screen.queryByTestId('leave-team-button')).not.toBeInTheDocument();
  });

  it('offers a leave button once the user is a member', () => {
    const params = buildParams({ isCurrentUserMember: true });
    render(<Harness {...params} />);

    render(<>{lastPatch(params.onSetHeader).actions}</>);

    expect(screen.getByTestId('leave-team-button')).toBeInTheDocument();
  });
});
