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

import { GlobalSettingsMenuCategory } from '../../../../../../constants/GlobalSettings.constants';
import type { UIPermission } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import type { NotificationSectionContribution } from '../../../../../../utils/ExtensionPointTypes';
import globalSettingsClassBase from '../../../../../../utils/GlobalSettingsClassBase';
import type { SettingMenuItem } from '../../../../../../utils/GlobalSettingsUtils';
import type {
  NotificationIcon,
  NotificationLandingCard,
  NotificationView,
} from './Notification.types';

const NOTIFICATIONS_PREFIX = `${GlobalSettingsMenuCategory.NOTIFICATIONS}.`;

/**
 * Strip the `notifications.` category prefix from a global-settings menu key,
 * leaving the option suffix a section contribution is keyed by
 * (e.g. `notifications.weekly-emails` → `weekly-emails`).
 */
export const toSectionKey = (menuKey: string): string =>
  menuKey.startsWith(NOTIFICATIONS_PREFIX)
    ? menuKey.slice(NOTIFICATIONS_PREFIX.length)
    : menuKey;

/** Items of the global-settings Notifications category the user may see. */
export const getNotificationMenuItems = (
  permissions: UIPermission
): SettingMenuItem[] =>
  globalSettingsClassBase
    .getGlobalSettingsMenuWithPermission(permissions, true)
    .find(
      (category: SettingMenuItem) =>
        category.key === GlobalSettingsMenuCategory.NOTIFICATIONS
    )?.items ?? [];

/** The Notifications menu item for a section key, if any. */
export const findNotificationMenuItem = (
  items: SettingMenuItem[],
  sectionKey: string
): SettingMenuItem | undefined =>
  items.find((item) => toSectionKey(item.key) === sectionKey);

/**
 * Landing cards for contributed sections: one per Notifications menu item the
 * user may see that has a registered section to render into. The card icon is
 * the contribution's, falling back to the menu item's.
 */
export const buildSectionCards = (
  items: SettingMenuItem[],
  contributions: NotificationSectionContribution[]
): NotificationLandingCard[] => {
  const byKey = new Map(
    contributions.map((contribution) => [contribution.key, contribution])
  );

  return items.reduce<NotificationLandingCard[]>((cards, item) => {
    const key = toSectionKey(item.key);
    const contribution = byKey.get(key);

    if (item.isProtected !== false && contribution) {
      cards.push({
        id: key,
        icon: (contribution.icon ?? item.icon) as NotificationIcon,
        title: item.category ?? item.label ?? key,
        description: item.description,
        view: { type: 'section', key },
        isBeta: item.isBeta,
      });
    }

    return cards;
  }, []);
};

export function hashSubPathToView(subPath: string): NotificationView {
  if (!subPath) {
    return { type: 'landing' };
  }

  const parts = subPath.split('/');

  if (parts[0] === 'section' && parts[1]) {
    return { type: 'section', key: parts.slice(1).join('/') };
  }

  if (parts[0] === 'alerts') {
    if (!parts[1]) {
      return { type: 'list' };
    }

    if (parts[1] === 'add') {
      return { type: 'add' };
    }

    if (parts[1] === 'edit' && parts[2]) {
      return { type: 'edit', fqn: parts.slice(2).join('/') };
    }

    return { type: 'detail', fqn: parts.slice(1).join('/'), name: parts[1] };
  }

  return { type: 'landing' };
}

export function viewToSubPath(view: NotificationView): string | undefined {
  switch (view.type) {
    case 'landing':
      return undefined;
    case 'list':
      return 'alerts';
    case 'add':
      return 'alerts/add';
    case 'edit':
      return `alerts/edit/${view.fqn}`;
    case 'detail':
      return `alerts/${view.fqn}`;
    case 'section':
      return view.subPath
        ? `section/${view.key}/${view.subPath}`
        : `section/${view.key}`;
    default:
      return undefined;
  }
}

/**
 * Split the raw path after `section/` into the registered section key and the
 * section's own sub-path. Keys may themselves contain `/` (e.g.
 * `weekly-emails/preferences`), so the longest registered key that prefixes the
 * path wins. An unregistered path is returned whole as the key.
 */
export function splitSectionPath(
  rest: string,
  keys: string[]
): { key: string; subPath?: string } {
  const key = keys
    .filter((k) => rest === k || rest.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0];

  if (!key) {
    return { key: rest };
  }

  const subPath = rest.slice(key.length + 1);

  return subPath ? { key, subPath } : { key };
}
