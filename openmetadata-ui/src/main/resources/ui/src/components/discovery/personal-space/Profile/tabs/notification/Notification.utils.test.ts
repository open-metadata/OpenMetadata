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

import globalSettingsClassBase from '../../../../../../utils/GlobalSettingsClassBase';
import {
  buildSectionCards,
  findNotificationMenuItem,
  getNotificationMenuItems,
  hashSubPathToView,
  splitSectionPath,
  toSectionKey,
  viewToSubPath,
} from './Notification.utils';

// Utils import the settings class base, which pulls the app's menu config; the
// pure helpers under test never call it.
jest.mock('../../../../../../utils/GlobalSettingsClassBase', () => ({
  __esModule: true,
  default: { getGlobalSettingsMenuWithPermission: jest.fn(() => []) },
}));

describe('splitSectionPath', () => {
  const keys = ['weekly-emails', 'weekly-emails/preferences', 'templates'];

  it('matches a key with no sub-path', () => {
    expect(splitSectionPath('templates', keys)).toEqual({ key: 'templates' });
  });

  it('prefers the longest key when keys nest', () => {
    expect(splitSectionPath('weekly-emails/preferences', keys)).toEqual({
      key: 'weekly-emails/preferences',
    });
  });

  it('splits the remainder off as the sub-path', () => {
    expect(splitSectionPath('templates/add', keys)).toEqual({
      key: 'templates',
      subPath: 'add',
    });
    expect(splitSectionPath('templates/edit/a.b/c', keys)).toEqual({
      key: 'templates',
      subPath: 'edit/a.b/c',
    });
  });

  it('does not match a key that is only a string prefix', () => {
    expect(splitSectionPath('templatesX', keys)).toEqual({ key: 'templatesX' });
  });
});

describe('hashSubPathToView', () => {
  it('returns landing for empty string', () => {
    expect(hashSubPathToView('')).toEqual({ type: 'landing' });
  });

  it('returns list for "alerts"', () => {
    expect(hashSubPathToView('alerts')).toEqual({ type: 'list' });
  });

  it('returns add for "alerts/add"', () => {
    expect(hashSubPathToView('alerts/add')).toEqual({ type: 'add' });
  });

  it('returns edit for "alerts/edit/<fqn>"', () => {
    expect(hashSubPathToView('alerts/edit/my-alert')).toEqual({
      type: 'edit',
      fqn: 'my-alert',
    });
  });

  it('returns edit with compound fqn', () => {
    expect(hashSubPathToView('alerts/edit/org/my-alert')).toEqual({
      type: 'edit',
      fqn: 'org/my-alert',
    });
  });

  it('returns detail for "alerts/<fqn>"', () => {
    expect(hashSubPathToView('alerts/my-alert')).toEqual({
      type: 'detail',
      fqn: 'my-alert',
      name: 'my-alert',
    });
  });

  it('returns section for "section/<key>"', () => {
    expect(hashSubPathToView('section/weekly-emails')).toEqual({
      type: 'section',
      key: 'weekly-emails',
    });
  });

  it('returns section with a compound key', () => {
    expect(hashSubPathToView('section/weekly-emails/preferences')).toEqual({
      type: 'section',
      key: 'weekly-emails/preferences',
    });
  });

  it('returns landing for "section" with no key', () => {
    expect(hashSubPathToView('section')).toEqual({ type: 'landing' });
  });

  it('returns landing for unknown path', () => {
    expect(hashSubPathToView('unknown')).toEqual({ type: 'landing' });
  });
});

describe('viewToSubPath', () => {
  it('returns undefined for landing', () => {
    expect(viewToSubPath({ type: 'landing' })).toBeUndefined();
  });

  it('returns "alerts" for list', () => {
    expect(viewToSubPath({ type: 'list' })).toBe('alerts');
  });

  it('returns "alerts/add" for add', () => {
    expect(viewToSubPath({ type: 'add' })).toBe('alerts/add');
  });

  it('returns "alerts/edit/<fqn>" for edit', () => {
    expect(viewToSubPath({ type: 'edit', fqn: 'my-alert' })).toBe(
      'alerts/edit/my-alert'
    );
  });

  it('returns "alerts/<fqn>" for detail', () => {
    expect(
      viewToSubPath({ type: 'detail', fqn: 'my-alert', name: 'My Alert' })
    ).toBe('alerts/my-alert');
  });

  it('returns "section/<key>" for section', () => {
    expect(viewToSubPath({ type: 'section', key: 'templates' })).toBe(
      'section/templates'
    );
  });

  it('appends the section sub-path', () => {
    expect(
      viewToSubPath({ type: 'section', key: 'templates', subPath: 'add' })
    ).toBe('section/templates/add');
  });
});

describe('round-trip', () => {
  it('list round-trips', () => {
    const view = { type: 'list' as const };

    expect(hashSubPathToView(viewToSubPath(view) ?? '')).toEqual(view);
  });

  it('add round-trips', () => {
    const view = { type: 'add' as const };

    expect(hashSubPathToView(viewToSubPath(view) ?? '')).toEqual(view);
  });

  it('edit round-trips', () => {
    const view = { type: 'edit' as const, fqn: 'my-alert' };

    expect(hashSubPathToView(viewToSubPath(view) ?? '')).toEqual(view);
  });

  it('section round-trips with a compound key', () => {
    const view = { type: 'section' as const, key: 'weekly-emails/preferences' };

    expect(hashSubPathToView(viewToSubPath(view) ?? '')).toEqual(view);
  });
});

const MENU_ITEMS = [
  {
    key: 'notifications.weekly-emails',
    category: 'Weekly emails',
    description: 'Weekly',
    icon: () => null,
  },
  {
    key: 'notifications.templates',
    category: 'Templates',
    description: 'Templates',
    icon: () => null,
    isBeta: true,
  },
  {
    key: 'notifications.weekly-emails/preferences',
    category: 'Preferences',
    description: 'Prefs',
    icon: () => null,
    isProtected: false,
  },
];

describe('toSectionKey', () => {
  it('strips the notifications category prefix', () => {
    expect(toSectionKey('notifications.weekly-emails/preferences')).toBe(
      'weekly-emails/preferences'
    );
  });

  it('leaves a key without the prefix unchanged', () => {
    expect(toSectionKey('templates')).toBe('templates');
  });
});

describe('findNotificationMenuItem', () => {
  it('finds the menu item for a section key', () => {
    expect(findNotificationMenuItem(MENU_ITEMS, 'templates')?.category).toBe(
      'Templates'
    );
  });

  it('returns undefined for an unknown key', () => {
    expect(findNotificationMenuItem(MENU_ITEMS, 'missing')).toBeUndefined();
  });
});

describe('buildSectionCards', () => {
  const ContributionIcon = () => null;

  it('builds a card only for visible items that have a contribution', () => {
    const cards = buildSectionCards(MENU_ITEMS, [
      { key: 'templates', component: () => null, icon: ContributionIcon },
      // Hidden from this user (isProtected false), so no card.
      { key: 'weekly-emails/preferences', component: () => null },
    ]);

    expect(cards).toEqual([
      {
        id: 'templates',
        icon: ContributionIcon,
        title: 'Templates',
        description: 'Templates',
        view: { type: 'section', key: 'templates' },
        isBeta: true,
      },
    ]);
  });

  it("falls back to the menu item's icon", () => {
    const [card] = buildSectionCards(MENU_ITEMS, [
      { key: 'weekly-emails', component: () => null },
    ]);

    expect(card.icon).toBe(MENU_ITEMS[0].icon);
  });

  it('returns no cards without contributions', () => {
    expect(buildSectionCards(MENU_ITEMS, [])).toEqual([]);
  });
});

describe('getNotificationMenuItems', () => {
  const getMenu =
    globalSettingsClassBase.getGlobalSettingsMenuWithPermission as jest.Mock;
  const permissions = {} as Parameters<typeof getNotificationMenuItems>[0];

  it('returns the items of the Notifications category', () => {
    getMenu.mockReturnValueOnce([
      { key: 'services', items: [{ key: 'services.databases' }] },
      { key: 'notifications', items: MENU_ITEMS },
    ]);

    expect(getNotificationMenuItems(permissions)).toBe(MENU_ITEMS);
    expect(getMenu).toHaveBeenCalledWith(permissions, true);
  });

  it('returns no items when the Notifications category is absent', () => {
    getMenu.mockReturnValueOnce([{ key: 'services', items: [] }]);

    expect(getNotificationMenuItems(permissions)).toEqual([]);
  });

  it('returns no items when the category has no items', () => {
    getMenu.mockReturnValueOnce([{ key: 'notifications' }]);

    expect(getNotificationMenuItems(permissions)).toEqual([]);
  });
});
