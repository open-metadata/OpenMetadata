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

import { TreeDataNode } from 'antd';
import { isEmpty } from 'lodash';
import {
  IconComponent,
  MainNavItem,
  MORE_NAV_KEY,
  MORE_NAV_LABEL_KEY,
} from '../../components/platform/ai-shell/Sidebar/navConfig';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import i18n from '../../utils/i18next/LocalUtil';

/** Tree node carrying the nav item's icon through for the editor row. */
export interface SidebarTreeNode extends TreeDataNode {
  navIcon?: IconComponent;
  children?: SidebarTreeNode[];
}

const itemsByKey = (items: MainNavItem[]): Map<string, MainNavItem> =>
  new Map(items.map((item) => [item.key, item]));

const labelKeyForKey = (map: Map<string, MainNavItem>, key: string): string =>
  key === MORE_NAV_KEY ? MORE_NAV_LABEL_KEY : map.get(key)?.labelKey ?? key;

// Titles are pre-translated: antd copies a string `title` into the DOM
// `title` attribute (node tooltip / drag ghost) regardless of `titleRender`,
// so a raw key here would surface as "label.home" on hover.
const toItemNode = (
  map: Map<string, MainNavItem>,
  key: string
): SidebarTreeNode => ({
  key,
  title: i18n.t(labelKeyForKey(map, key)) as string,
  navIcon: map.get(key)?.icon,
});

// The "More" node is a first-class, hideable, draggable node that owns the
// overflow items as `children`. It's always present in the editor (a persona
// hides it via its Switch rather than deleting it), so admins can always nest
// items back under it.
//
// `isLeaf: false` is required: rc-tree treats an empty `children` array as a
// leaf, and a leaf accepts no drop-inside. Without this, once every child is
// dragged out, More collapses into an un-nestable leaf and items can never be
// put back under it.
const toMoreNode = (
  map: Map<string, MainNavItem>,
  childKeys: string[]
): SidebarTreeNode => ({
  key: MORE_NAV_KEY,
  title: i18n.t(MORE_NAV_LABEL_KEY) as string,
  isLeaf: false,
  children: childKeys.map((key) => toItemNode(map, key)),
});

const collectStoredKeys = (items: NavigationItem[]): Set<string> => {
  const keys = new Set<string>();
  items.forEach((item) => {
    keys.add(item.id);
    item.children?.forEach((child) => keys.add(child.id));
  });

  return keys;
};

const buildDefaultTree = (
  items: MainNavItem[],
  visibleCount: number
): SidebarTreeNode[] => {
  const map = itemsByKey(items);
  const visible = items.slice(0, visibleCount);
  const overflow = items.slice(visibleCount);

  return [
    ...visible.map((item) => toItemNode(map, item.key)),
    toMoreNode(
      map,
      overflow.map((item) => item.key)
    ),
  ];
};

/**
 * Editor tree for the app-mode sidebar. Reflects the persisted structure:
 * top-level items in stored order, and a single "More" node holding the
 * overflow items as children. Items added to the product after the
 * customization was saved are appended at the top level (re-enable via their
 * Switch); stored ids that no longer exist are dropped. A "More" node is
 * always guaranteed so the overflow group can never become unreachable.
 */
export const getSidebarTreeData = (
  items: MainNavItem[],
  customization: NavigationItem[] | null | undefined,
  visibleCount: number
): SidebarTreeNode[] => {
  if (!customization?.length) {
    return buildDefaultTree(items, visibleCount);
  }

  const map = itemsByKey(items);
  const storedKeys = collectStoredKeys(customization);
  let hasMoreNode = false;

  const nodes = customization.reduce<SidebarTreeNode[]>((acc, navItem) => {
    if (navItem.id === MORE_NAV_KEY) {
      hasMoreNode = true;
      const childKeys = (navItem.children ?? [])
        .map((child) => child.id)
        .filter((id) => map.has(id));
      acc.push(toMoreNode(map, childKeys));
    } else if (map.has(navItem.id)) {
      acc.push(toItemNode(map, navItem.id));
    }

    return acc;
  }, []);

  // Nav items missing from the stored list (added to the product after the
  // customization was saved) are appended and start hidden (see
  // getSidebarHiddenKeys) so an admin can position/re-enable them.
  const missing = items
    .filter((item) => !storedKeys.has(item.key))
    .map((item) => toItemNode(map, item.key));

  const result = [...nodes, ...missing];

  return hasMoreNode ? result : [...result, toMoreNode(map, [])];
};

const collectHiddenIds = (items: NavigationItem[]): string[] =>
  items.flatMap((item) => [
    ...(item.isHidden ? [item.id] : []),
    ...collectHiddenIds(item.children ?? []),
  ]);

/**
 * Hidden keys for the editor's visibility switches: explicitly hidden stored
 * entries (at any depth, including the "More" node) plus base nav items
 * missing from a non-empty stored list.
 */
export const getSidebarHiddenKeys = (
  items: MainNavItem[],
  customization: NavigationItem[] | null | undefined
): string[] => {
  if (!customization?.length) {
    return [];
  }

  const storedKeys = collectStoredKeys(customization);
  const missing = items
    .filter((item) => !storedKeys.has(item.key))
    .map((item) => item.key);

  return [...collectHiddenIds(customization), ...missing];
};

/**
 * Serializes the editor tree back to the persisted NavigationItem list,
 * recursing into the "More" node's children. Persists the i18n key (not the
 * localized text) as `title` so the document stays locale-independent.
 */
export const getSidebarNavigationItems = (
  items: MainNavItem[],
  treeData: SidebarTreeNode[],
  hiddenKeys: string[]
): NavigationItem[] => {
  const map = itemsByKey(items);

  const serialize = (nodes: SidebarTreeNode[]): NavigationItem[] =>
    nodes.map((node) => {
      const key = node.key as string;
      const navItem: NavigationItem = {
        id: key,
        pageId: key,
        title: labelKeyForKey(map, key),
        isHidden: hiddenKeys.includes(key),
      };

      if (node.children) {
        navItem.children = serialize(node.children);
      }

      return navItem;
    });

  return serialize(treeData);
};

/**
 * Structural invariant for the editor tree: exactly the "More" node may hold
 * children, its children must be leaves, and "More" itself may not be nested.
 * A drag that would break this is rejected.
 */
export const isValidSidebarTree = (nodes: SidebarTreeNode[]): boolean =>
  nodes.every((node) => {
    if (node.key === MORE_NAV_KEY) {
      return (node.children ?? []).every(
        (child) => child.key !== MORE_NAV_KEY && isEmpty(child.children)
      );
    }

    return isEmpty(node.children);
  });
