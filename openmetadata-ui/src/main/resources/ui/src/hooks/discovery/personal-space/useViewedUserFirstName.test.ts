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
import { renderHook } from '@testing-library/react';
import { User } from '../../../generated/entity/teams/user';
import { useViewedUserFirstName } from './useViewedUserFirstName';

jest.mock('../../useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'me', name: 'me' } }),
}));

describe('useViewedUserFirstName', () => {
  it('returns the first name of another user', () => {
    const { result } = renderHook(() =>
      useViewedUserFirstName({
        id: 'u1',
        name: 'alice.johnson',
        displayName: 'Alice Johnson',
      } as User)
    );

    expect(result.current).toBe('Alice');
  });

  it('falls back to the user name without a display name', () => {
    const { result } = renderHook(() =>
      useViewedUserFirstName({ id: 'u1', name: 'bob' } as User)
    );

    expect(result.current).toBe('bob');
  });

  it('returns undefined for the current user or no user', () => {
    const { result: self } = renderHook(() =>
      useViewedUserFirstName({ id: 'me', name: 'me' } as User)
    );
    const { result: none } = renderHook(() => useViewedUserFirstName());

    expect(self.current).toBeUndefined();
    expect(none.current).toBeUndefined();
  });
});
