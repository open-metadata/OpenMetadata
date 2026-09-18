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
import { screen, waitFor } from '@testing-library/react';
import { OwnerType } from '../../../enums/user.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { getUserByName } from '../../../rest/userAPI';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import { PopoverContent } from './PopoverContent.component';

// Only the network layer and pure helpers are mocked. `useApplicationStore` is the REAL store
// so both writers go through the real `updateUserProfilePics` (non-merging key replace).
jest.mock('../../../rest/userAPI', () => ({
  getUserByName: jest.fn(),
}));
jest.mock('../../../rest/teamsAPI', () => ({
  getTeamByName: jest.fn(),
}));
jest.mock('../../../utils/UserDataUtils', () => ({
  getUserWithImage: (u: unknown) => u,
}));
jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: (e: { name?: string } | undefined) => e?.name ?? '',
}));

const fullUser = {
  name: 'testUser',
  displayName: 'Test User',
  teams: [{ id: '1', name: 'Team 1', deleted: false }],
  roles: [{ id: '1', name: 'Role 1' }],
  isAdmin: true,
  profile: { images: [{ id: 'i', type: 'png', url: '/x.png' }] },
} as const;

// What `useUserProfile` (fields: 'profile') receives after the backend nulls
// teams/roles for an unrequested fields set (UserRepository.java: setTeams(null)/setRoles(null)).
const profileOnlyUser = {
  name: 'testUser',
  displayName: 'Test User',
  profile: { images: [{ id: 'i', type: 'png', url: '/x.png' }] },
} as const;

// Harness mimics a real call site: a ProfilePicture (via useUserProfile) co-mounted with the
// PopoverContent body, both targeting the same user.
function Harness() {
  useUserProfile({ permission: true, name: 'testUser' });

  return <PopoverContent type={OwnerType.USER} userName="testUser" />;
}

describe('PopoverContent store-desync (two real writers)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useApplicationStore.setState({ userProfilePics: {} });
  });

  it('keeps the popover chips rendered after a profile-only store overwrite', async () => {
    let resolveA!: (u: unknown) => void;
    let resolveB!: (u: unknown) => void;
    const promiseA = new Promise((r) => {
      resolveA = r as (u: unknown) => void;
    });
    const promiseB = new Promise((r) => {
      resolveB = r as (u: unknown) => void;
    });

    (getUserByName as jest.Mock).mockImplementation(
      (_name: string, params?: { fields?: unknown }) => {
        // useUserProfile passes fields as the string 'profile'
        if (params?.fields === 'profile') {
          return promiseA.then(() => profileOnlyUser);
        }

        // useEntityPopoverData passes fields as ['teams','roles','profile']
        return promiseB.then(() => fullUser);
      }
    );

    renderWithQueryClient(<Harness />);

    // B (full user, from the popover) resolves FIRST -> store has full user, chips render.
    resolveB(fullUser);
    await screen.findByText('Team 1');

    expect(await screen.findByText('Role 1')).toBeInTheDocument();
    expect(
      useApplicationStore.getState().userProfilePics.testUser
    ).toMatchObject(fullUser);

    // A (profile-only, from the avatar's useUserProfile) resolves LAST -> clobbers the store.
    resolveA(profileOnlyUser);
    await waitFor(() =>
      expect(
        useApplicationStore.getState().userProfilePics.testUser
      ).toMatchObject(profileOnlyUser)
    );

    // FIX: the chips now render from the freshly-fetched `user` (react-query data), not from
    // the shared store, so the popover chip row must stay populated even after the store entry
    // has been overwritten with a profile-only subset that omits teams/roles.
    expect(screen.getByText('Team 1')).toBeInTheDocument();
    expect(screen.getByText('Role 1')).toBeInTheDocument();
    expect(screen.queryByText('message.no-data-available')).toBeNull();
    expect(document.querySelector('.w-40')).toBeInTheDocument();
  });

  it('keeps the popover chips rendered when the profile-only write resolves first', async () => {
    let resolveA!: (u: unknown) => void;
    let resolveB!: (u: unknown) => void;
    const promiseA = new Promise((r) => {
      resolveA = r as (u: unknown) => void;
    });
    const promiseB = new Promise((r) => {
      resolveB = r as (u: unknown) => void;
    });

    (getUserByName as jest.Mock).mockImplementation(
      (_name: string, params?: { fields?: unknown }) => {
        if (params?.fields === 'profile') {
          return promiseA.then(() => profileOnlyUser);
        }

        return promiseB.then(() => fullUser);
      }
    );

    renderWithQueryClient(<Harness />);

    // A (profile-only) resolves first and seeds the store with a teams-less user.
    resolveA(profileOnlyUser);
    // B (full user from popover) resolves next and feeds the chips via react-query.
    resolveB(fullUser);
    await screen.findByText('Team 1');

    expect(await screen.findByText('Role 1')).toBeInTheDocument();
    expect(screen.queryByText('message.no-data-available')).toBeNull();
  });
});
