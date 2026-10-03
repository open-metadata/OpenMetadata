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

import { resolveProfileTarget } from './ProfilePage.utils';

describe('resolveProfileTarget', () => {
  it('returns the current user when the profile tab has no sub-path', () => {
    expect(
      resolveProfileTarget({ tab: 'profile', subPath: '' }, 'admin')
    ).toEqual({ targetUsername: 'admin', isViewingOtherUser: false });
  });

  it('returns the hashed user (decoded) when the profile sub-path is set', () => {
    expect(
      resolveProfileTarget(
        { tab: 'profile', subPath: encodeURIComponent('test.user@acme.io') },
        'admin'
      )
    ).toEqual({
      targetUsername: 'test.user@acme.io',
      isViewingOtherUser: true,
    });
  });

  it('is not "other user" when the hashed user equals the current user', () => {
    expect(
      resolveProfileTarget({ tab: 'profile', subPath: 'admin' }, 'admin')
    ).toEqual({ targetUsername: 'admin', isViewingOtherUser: false });
  });

  it('ignores sub-paths of other tabs and falls back to the current user', () => {
    expect(
      resolveProfileTarget({ tab: 'members', subPath: 'users' }, 'admin')
    ).toEqual({ targetUsername: 'admin', isViewingOtherUser: false });
  });
});
