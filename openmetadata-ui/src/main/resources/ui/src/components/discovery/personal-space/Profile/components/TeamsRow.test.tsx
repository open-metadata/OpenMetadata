/*
 *  Copyright 2025 Collate.
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
import { ReactNode } from 'react';

let mockIsAdmin: boolean | undefined;
const mockGetTeamsHierarchy = jest.fn().mockResolvedValue({ data: [] });

jest.mock('../../../../../rest/teamsAPI', () => ({
  getTeamsHierarchy: (...args: unknown[]) => mockGetTeamsHierarchy(...args),
}));

jest.mock(
  'components/Settings/Team/TeamsSelectable/TeamsSelectableNew',
  () => ({ __esModule: true, default: () => <div /> })
);

jest.mock('hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

jest.mock('utils/TeamUtils', () => ({
  getNonDeletedTeams: (teams: unknown[]) => teams ?? [],
}));

jest.mock('./ChipBadgeList', () => ({
  __esModule: true,
  default: ({ values }: { values: unknown[] }) => (
    <div data-testid="chip-list">{values.length}</div>
  ),
}));

jest.mock('./InlineEditCard', () => ({
  __esModule: true,
  default: ({
    view,
    canEdit,
    isSaveDisabled,
    onEnterEdit,
  }: {
    view?: ReactNode;
    canEdit?: boolean;
    isSaveDisabled?: boolean;
    onEnterEdit?: () => void;
  }) => (
    <div>
      <button data-testid="enter-edit" type="button" onClick={onEnterEdit}>
        edit
      </button>
      <span data-testid="can-edit">{String(canEdit)}</span>
      <span data-testid="save-disabled">{String(isSaveDisabled)}</span>
      {view}
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { User } from '../../../../../generated/entity/teams/user';
import TeamsRow from './TeamsRow';

describe('TeamsRow', () => {
  beforeEach(() => {
    mockIsAdmin = true;
  });

  it('renders the teams chip and is editable for admins', () => {
    render(
      <TeamsRow
        updateUserDetails={jest.fn()}
        userData={
          {
            name: 'harsh',
            teams: [{ id: 't', name: 'Organization' }],
          } as unknown as User
        }
      />
    );

    expect(screen.getByTestId('chip-list')).toHaveTextContent('1');
    expect(screen.getByTestId('can-edit')).toHaveTextContent('true');
    expect(screen.getByTestId('save-disabled')).toHaveTextContent('true');
  });

  it.each([
    [true, false],
    [false, true],
  ])(
    'admin=%s loads teams with joinableOnly=%s (admins also see closed teams)',
    async (isAdmin, joinableOnly) => {
      mockIsAdmin = isAdmin;
      render(
        <TeamsRow
          updateUserDetails={jest.fn()}
          userData={{ name: 'harsh', teams: [] } as unknown as User}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('enter-edit'));
      });

      expect(mockGetTeamsHierarchy).toHaveBeenCalledWith(joinableOnly);
    }
  );
});
