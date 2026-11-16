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
import { MemoryRouter } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { User } from '../../../../generated/entity/teams/user';
import { UserAssetsKind } from './UserAssets.utils';
import UserAssetsEmpty from './UserAssetsEmpty';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'me', name: 'me' } }),
}));

const ME = { id: 'me', name: 'me' } as User;
const ALICE = { id: 'alice', name: 'alice', displayName: 'Alice J' } as User;

const renderEmpty = (kind: UserAssetsKind, user: User) =>
  render(
    <MemoryRouter>
      <UserAssetsEmpty kind={kind} user={user} />
    </MemoryRouter>
  );

describe('UserAssetsEmpty', () => {
  it.each([
    ['owned', ME, 'message.you-do-not-own-any-assets'],
    ['owned', ALICE, 'message.user-does-not-own-any-assets'],
    ['following', ME, 'message.you-are-not-following-anything'],
    ['following', ALICE, 'message.user-is-not-following-anything'],
  ] as const)('shows the %s copy for %j', (kind, user, title) => {
    renderEmpty(kind, user);

    expect(screen.getByTestId('user-assets-empty')).toHaveTextContent(title);
  });

  it('offers Explore only to the current user for following', () => {
    renderEmpty('following', ME);
    fireEvent.click(
      screen.getByRole('button', { name: 'label.explore-assets' })
    );

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.EXPLORE);
  });

  it.each([
    ['owned', ME],
    ['following', ALICE],
  ] as const)('has no Explore action for %s of %j', (kind, user) => {
    renderEmpty(kind, user);

    expect(
      screen.queryByRole('button', { name: 'label.explore-assets' })
    ).not.toBeInTheDocument();
  });
});
