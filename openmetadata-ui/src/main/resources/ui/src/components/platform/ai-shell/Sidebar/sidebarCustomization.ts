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

import { isEmpty } from 'lodash';
import { NavigationItem } from '../../../../generated/system/ui/uiCustomization';
import { MainNavItem, MORE_NAV_KEY, MORE_NAV_LABEL_KEY } from './navConfig';

/**
 * A rendered top-level nav node: either a regular nav item, or the "More"
 * group whose `children` render behind the overflow popover. Order in the
 * array is the on-screen order — the More group sits wherever the persona
 * placed it (not forced to the end).
 */
export type MainNavNode =
  | { type: 'item'; item: MainNavItem }
  | { type: 'more'; children: MainNavItem[] };

/**
 * Canonical persisted shape for an untouched sidebar: the first
 * `visibleCount` items visible at the top level, the rest nested under a
 * visible `more` node. Used to seed the customize page and as the reset
 * target. `items` is the live module-derived nav list (already sorted by
 * `navOrder` and install-gated).
 */
export const getDefaultSidebarNavigation = (
  items: MainNavItem[],
  visibleCount: number
): NavigationItem[] => {
  const visible = items.slice(0, visibleCount);
  const overflow = items.slice(visibleCount);

  const toNavItem = (item: MainNavItem): NavigationItem => ({
    id: item.key,
    pageId: item.key,
    title: item.labelKey,
    isHidden: false,
  });

  return [
    ...visible.map(toNavItem),
    {
      id: MORE_NAV_KEY,
      pageId: MORE_NAV_KEY,
      title: MORE_NAV_LABEL_KEY,
      isHidden: false,
      children: overflow.map(toNavItem),
    },
  ];
};

const buildDefaultNodes = (
  items: MainNavItem[],
  visibleCount: number
): MainNavNode[] => {
  const visible = items.slice(0, visibleCount);
  const overflow = items.slice(visibleCount);

  return [
    ...visible.map((item): MainNavNode => ({ type: 'item', item })),
    { type: 'more', children: overflow },
  ];
};

const resolveChildren = (
  navChildren: NavigationItem[] | undefined,
  itemsByKey: Map<string, MainNavItem>
): MainNavItem[] =>
  (navChildren ?? [])
    .map((child) => ({ child, item: itemsByKey.get(child.id) }))
    .filter(
      (pair): pair is { child: NavigationItem; item: MainNavItem } =>
        pair.item !== undefined
    )
    .filter(({ child }) => !child.isHidden)
    .map(({ item }) => item);

/**
 * Every id referenced by a stored customization — top-level entries and the
 * "More" node's children alike. Used to tell a genuinely NEW module (never
 * customized → append it so it isn't lost) apart from one the persona
 * deliberately hid (in the stored list, `isHidden` → must stay hidden, not
 * reappear appended).
 */
const collectStoredKeys = (customization: NavigationItem[]): Set<string> => {
  const keys = new Set<string>();
  customization.forEach((navItem) => {
    keys.add(navItem.id);
    navItem.children?.forEach((child) => keys.add(child.id));
  });

  return keys;
};

/**
 * Applies a persona's stored customization (order + visibility + the
 * top-level/More split) to the live nav items, producing the ordered render
 * nodes.
 *
 * - Empty/absent customization → default split (top `visibleCount` visible,
 *   rest under More).
 * - A hidden top-level item is dropped; a hidden `more` node drops the whole
 *   overflow group; a hidden child is dropped.
 * - Stored ids that no longer exist in `items` (e.g. a module the current
 *   build/install no longer provides) are dropped.
 * - Items present in `items` but absent from the stored list (e.g. a newly
 *   added module) are appended at the top level so they never silently
 *   disappear from a persona that was customized before they existed.
 */
export const applySidebarCustomization = (
  items: MainNavItem[],
  customization: NavigationItem[] | null | undefined,
  visibleCount: number
): MainNavNode[] => {
  if (!customization || isEmpty(customization)) {
    return buildDefaultNodes(items, visibleCount);
  }

  const itemsByKey = new Map(items.map((item) => [item.key, item]));

  const nodes = customization.reduce<MainNavNode[]>((acc, navItem) => {
    if (navItem.id === MORE_NAV_KEY) {
      if (!navItem.isHidden) {
        acc.push({
          type: 'more',
          children: resolveChildren(navItem.children, itemsByKey),
        });
      }

      return acc;
    }

    const item = itemsByKey.get(navItem.id);
    if (item && !navItem.isHidden) {
      acc.push({ type: 'item', item });
    }

    return acc;
  }, []);

  // Append only modules the stored list never mentioned (added to the product
  // after this persona was customized). Items the persona explicitly hid are
  // in `storedKeys`, so they stay hidden instead of reappearing here.
  const storedKeys = collectStoredKeys(customization);
  const appended = items
    .filter((item) => !storedKeys.has(item.key))
    .map((item): MainNavNode => ({ type: 'item', item }));

  return [...nodes, ...appended];
};
