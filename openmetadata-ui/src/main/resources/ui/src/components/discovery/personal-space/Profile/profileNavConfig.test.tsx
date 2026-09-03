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

// The registry pulls in the row/tab content components; stub them so the
// config can be imported in isolation.
jest.mock('./ProfileDetailsPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./components/AccessTokenPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./tabs/PermissionsTab', () => ({
  __esModule: true,
  default: () => null,
}));

import {
  DEFAULT_PROFILE_NAV_ID,
  getProfileNavItem,
  PROFILE_NAV_ITEMS,
} from './profileNavConfig';

describe('profileNavConfig', () => {
  // "My Connections" is not in the static config — the Query Runner plugin
  // contributes it through the `profile.tabs` extension point.
  it('exposes exactly the 3 built-in nav items in order', () => {
    expect(PROFILE_NAV_ITEMS.map((i) => i.id)).toEqual([
      'profile',
      'permissions',
      'access-token',
    ]);
  });

  it('gives every item a unique id, icon, label, description and render fn', () => {
    const ids = new Set<string>();
    PROFILE_NAV_ITEMS.forEach((item) => {
      expect(ids.has(item.id)).toBe(false);

      ids.add(item.id);

      expect(typeof item.icon).toBe('function');
      expect(item.label).toMatch(/^(label|message)\./);
      expect(item.description).toMatch(/^(label|message)\./);
      expect(typeof item.render).toBe('function');
    });

    expect(ids.size).toBe(3);
  });

  it('groups profile/permissions under account, credentials otherwise', () => {
    const groupById = Object.fromEntries(
      PROFILE_NAV_ITEMS.map((i) => [i.id, i.group])
    );

    expect(groupById).toEqual({
      profile: 'account',
      permissions: 'account',
      'access-token': 'credentials',
    });
  });

  it('resolves the default id and falls back to the first item on miss', () => {
    expect(PROFILE_NAV_ITEMS.some((i) => i.id === DEFAULT_PROFILE_NAV_ID)).toBe(
      true
    );
    expect(getProfileNavItem(DEFAULT_PROFILE_NAV_ID).id).toBe(
      DEFAULT_PROFILE_NAV_ID
    );
    expect(getProfileNavItem('does-not-exist' as never)).toBe(
      PROFILE_NAV_ITEMS[0]
    );
  });
});
