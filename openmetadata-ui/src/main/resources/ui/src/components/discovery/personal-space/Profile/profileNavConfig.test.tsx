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
jest.mock('./tabs/access-control/AccessControlPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./tabs/bots/BotsPanel', () => ({
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
  it('exposes exactly the 6 built-in nav items in order', () => {
    expect(PROFILE_NAV_ITEMS.map((i) => i.id)).toEqual([
      'profile',
      'permissions',
      'access-token',
      'access-control',
      'bots',
      'platform-settings',
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

    expect(ids.size).toBe(6);
  });

  it('places access-control under administration group, not credentials', () => {
    const groupById = Object.fromEntries(
      PROFILE_NAV_ITEMS.map((i) => [i.id, i.group])
    );

    expect(groupById).toEqual({
      profile: 'account',
      permissions: 'account',
      'access-token': 'credentials',
      'access-control': 'administration',
      bots: 'administration',
      'platform-settings': 'administration',
    });
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
      'application',
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

  it('lists Applications under Features for users who can view apps', () => {
    const applications = FEATURES_NAV_ITEMS.find(
      (item) => item.id === 'applications'
    );
    const canView = {
      [ResourceEntity.APPLICATION]: { ViewAll: true },
    } as unknown as UIPermission;

    expect(applications?.group).toBe('features');
    expect(applications?.isVisible?.(canView, false)).toBe(true);
    expect(applications?.isVisible?.({} as UIPermission, false)).toBeFalsy();
  });
});
