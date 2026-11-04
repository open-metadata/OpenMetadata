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
jest.mock('./ProfileTabPanel', () => ({
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
jest.mock('./tabs/access-control/AccessControlPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./tabs/bots/BotsPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./tabs/preferences/PreferencesPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./tabs/platform-settings/PlatformSettingsPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./tabs/applications/ApplicationsPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./tabs/sso/SsoPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../../assets/svg/entity/bot.svg', () => ({
  ReactComponent: () => null,
}));

import { UIPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import {
  DEFAULT_PROFILE_NAV_ID,
  FEATURES_NAV_ITEMS,
  getProfileNavItem,
  PROFILE_NAV_GROUP_LABEL,
  PROFILE_NAV_GROUP_ORDER,
  PROFILE_NAV_ITEMS,
} from './profileNavConfig';

describe('profileNavConfig', () => {
  it('exposes exactly the 8 built-in nav items in order', () => {
    expect(PROFILE_NAV_ITEMS.map((i) => i.id)).toEqual([
      'profile',
      'permissions',
      'preferences',
      'access-token',
      'access-control',
      'bots',
      'platform-settings',
      'sso',
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

    expect(ids.size).toBe(8);
  });

  it('places access-control under administration group, not credentials', () => {
    const groupById = Object.fromEntries(
      PROFILE_NAV_ITEMS.map((i) => [i.id, i.group])
    );

    expect(groupById).toEqual({
      profile: 'account',
      permissions: 'account',
      preferences: 'account',
      'access-token': 'credentials',
      'access-control': 'administration',
      bots: 'administration',
      'platform-settings': 'administration',
      sso: 'administration',
    });
  });

  it('shows SSO settings to admins only', () => {
    const sso = getProfileNavItem('sso');
    const permissions = {} as Parameters<NonNullable<typeof sso.isVisible>>[0];

    expect(sso.isVisible?.(permissions, true)).toBe(true);
    expect(sso.isVisible?.(permissions, false)).toBe(false);
  });

  it('includes administration in the group label map', () => {
    expect(PROFILE_NAV_GROUP_LABEL.administration).toBe('label.administration');
  });

  it('renders groups in account → administration → workspace → credentials order', () => {
    expect(PROFILE_NAV_GROUP_ORDER).toEqual([
      'account',
      'administration',
      'features',
      'workspace',
      'credentials',
    ]);
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

  it('keeps Applications to admins, as classic does', () => {
    const viewAll = { all: { ViewAll: true } } as unknown as UIPermission;
    const item = FEATURES_NAV_ITEMS.find(
      (navItem) => navItem.id === 'applications'
    );

    expect(item?.isVisible?.(viewAll, false)).toBeFalsy();
    expect(item?.isVisible?.({} as UIPermission, true)).toBe(true);
  });

  it.each([
    [{ type: { ViewAll: true } }, true],
    [{ table: { ViewAll: true } }, false],
  ])(
    'shows Custom Properties to a non-admin by type view permission (%j)',
    (permissions, visible) => {
      expect(
        Boolean(
          getProfileNavItem('custom-properties').isVisible?.(
            permissions as unknown as UIPermission,
            false
          )
        )
      ).toBe(visible);
    }
  );

  // The settings surfaces behind these tabs are admin-only, whatever view
  // permissions a non-admin holds (ADR:2026-10-21-settings-pages-are-classic-only).
  it.each([
    ['access-control', ResourceEntity.ROLE],
    ['access-control', ResourceEntity.POLICY],
    ['bots', ResourceEntity.BOT],
  ])(
    'hides %s from a non-admin even with %s view permission',
    (id, resource) => {
      const item = getProfileNavItem(id as never);
      const canView = {
        [resource]: { ViewAll: true },
      } as unknown as UIPermission;

      expect(item.id).toBe(id);
      expect(item.isVisible?.(canView, false)).toBe(false);
      expect(item.isVisible?.({} as UIPermission, true)).toBe(true);
    }
  );

  // As in classic, Members opens to anyone who may view teams or users.
  it.each([
    [ResourceEntity.TEAM, true],
    [ResourceEntity.USER, true],
    [ResourceEntity.ROLE, false],
  ])('shows members to a non-admin with %s view: %s', (resource, visible) => {
    const canView = {
      [resource]: { ViewAll: true },
    } as unknown as UIPermission;

    expect(getProfileNavItem('members').isVisible?.(canView, false)).toBe(
      visible
    );
  });
});
