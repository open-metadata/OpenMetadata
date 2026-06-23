/*
 *  Copyright 2024 Collate.
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
import { TreeDataNode } from 'antd/lib';
import { isEmpty, isNumber } from 'lodash';
import { LeftSidebarItem } from '../../components/MyData/LeftSidebar/LeftSidebar.interface';
import {
  AppPlugin,
  LeftSidebarItemExample,
} from '../../components/Settings/Applications/plugins/AppPlugin';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import leftSidebarClassBase from '../LeftSidebarClassBase';

const getBaseSidebarItems = (): LeftSidebarItem[] =>
  leftSidebarClassBase.getSidebarItems();

const createSidebarMap = (
  items: LeftSidebarItem[]
): Map<string, LeftSidebarItem> => {
  const map = new Map<string, LeftSidebarItem>();

  const addToMap = (item: LeftSidebarItem): void => {
    map.set(item.key, item);
    item.children?.forEach(addToMap);
  };

  items.forEach(addToMap);

  return map;
};

const DEFAULT_INDEX = 999;

const sortPluginItemsByIndex = (
  items: Array<LeftSidebarItem & { index?: number }>
): Array<LeftSidebarItem & { index?: number }> =>
  [...items].sort(
    (a, b) => (a.index ?? DEFAULT_INDEX) - (b.index ?? DEFAULT_INDEX)
  );

const insertPluginItem = (
  mergedItems: LeftSidebarItem[],
  pluginItem: LeftSidebarItem & { index?: number }
): void => {
  if (isNumber(pluginItem.index) && pluginItem.index >= 0) {
    mergedItems.splice(
      Math.min(pluginItem.index, mergedItems.length),
      0,
      pluginItem
    );
  } else {
    mergedItems.push(pluginItem);
  }
};

export const mergePluginSidebarItems = (
  baseItems: LeftSidebarItem[],
  pluginItems: Array<LeftSidebarItemExample>,
  navigationItems?: NavigationItem[]
): LeftSidebarItem[] => {
  if (isEmpty(pluginItems)) {
    return baseItems;
  }

  const sortedPluginItems = sortPluginItemsByIndex(pluginItems);
  const mergedItems = [...baseItems];

  sortedPluginItems.forEach((item) => {
    const navData = navigationItems?.find((i) => i.id === item.key);

    !navData?.isHidden && insertPluginItem(mergedItems, item);
  });

  return mergedItems;
};

const extractPluginSidebarItems = (
  plugins: AppPlugin[]
): Array<LeftSidebarItemExample> =>
  plugins.flatMap((plugin) => plugin.getSidebarActions?.() ?? []);

export const getSidebarItemsWithPlugins = (
  plugins?: AppPlugin[]
): LeftSidebarItem[] => {
  const baseItems = getBaseSidebarItems();

  if (!plugins?.length) {
    return baseItems;
  }

  const pluginItems = extractPluginSidebarItems(plugins);

  return mergePluginSidebarItems(baseItems, pluginItems);
};

const addNavigationItemToMap = (
  map: Map<string, NavigationItem>,
  item: NavigationItem
): void => {
  map.set(item.id, item);
  item.children?.forEach((child) => map.set(child.id, child));
};

const createNavigationMap = (
  navigationItems?: NavigationItem[]
): Map<string, NavigationItem> => {
  const map = new Map<string, NavigationItem>();
  navigationItems?.forEach((item) => addNavigationItemToMap(map, item));

  return map;
};

const convertSidebarChildToTreeNode = (
  child: LeftSidebarItem
): TreeDataNode => ({
  title: child.title,
  key: child.key,
  icon: child.icon as TreeDataNode['icon'],
});

const collectNewDefaultChildNodes = (
  defaultChildren: LeftSidebarItem[],
  savedKeys: Set<string>
): TreeDataNode[] =>
  defaultChildren
    .filter((child) => !savedKeys.has(child.key))
    .map(convertSidebarChildToTreeNode);

const convertSidebarItemToTreeNode = (
  sidebarItem: LeftSidebarItem
): TreeDataNode => ({
  title: sidebarItem.title,
  key: sidebarItem.key,
  icon: sidebarItem.icon as TreeDataNode['icon'],
  children: sidebarItem.children?.map(convertSidebarChildToTreeNode),
});

const collectNavigationKeys = (
  navigationItems: NavigationItem[]
): Set<string> => {
  const keys = new Set<string>();

  navigationItems.forEach((item) => {
    keys.add(item.id);
    item.children?.forEach((child) => keys.add(child.id));
  });

  return keys;
};

const convertNavigationChildToTreeNode = (
  navChild: NavigationItem,
  sidebarMap: Map<string, LeftSidebarItem>
): TreeDataNode | null => {
  const sidebarChild = sidebarMap.get(navChild.id);

  return sidebarChild
    ? {
        title: navChild.title,
        key: navChild.id,
        icon: sidebarChild.icon as TreeDataNode['icon'],
      }
    : null;
};

const buildChildrenForSavedItem = (
  navItem: NavigationItem,
  sidebarItem: LeftSidebarItem | undefined,
  sidebarMap: Map<string, LeftSidebarItem>,
  savedKeys: Set<string>
): TreeDataNode[] | undefined => {
  const defaultChildren = sidebarItem?.children ?? [];

  if (isEmpty(navItem.children) && isEmpty(defaultChildren)) {
    return undefined;
  }

  const savedChildNodes = (navItem.children ?? [])
    .map((child) => convertNavigationChildToTreeNode(child, sidebarMap))
    .filter((node): node is TreeDataNode => node !== null);

  const newDefaultChildNodes = collectNewDefaultChildNodes(
    defaultChildren,
    savedKeys
  );

  return [...savedChildNodes, ...newDefaultChildNodes];
};

const buildTreeNodeFromSavedItem = (
  navItem: NavigationItem,
  sidebarMap: Map<string, LeftSidebarItem>,
  savedKeys: Set<string>
): TreeDataNode => {
  const sidebarItem = sidebarMap.get(navItem.id);

  return {
    title: navItem.title,
    key: navItem.id,
    icon: sidebarItem?.icon as TreeDataNode['icon'],
    children: buildChildrenForSavedItem(
      navItem,
      sidebarItem,
      sidebarMap,
      savedKeys
    ),
  };
};

const convertNewDefaultItemToTreeNode = (
  sidebarItem: LeftSidebarItem,
  savedKeys: Set<string>
): TreeDataNode & { isHidden?: boolean } => ({
  title: sidebarItem.title,
  key: sidebarItem.key,
  icon: sidebarItem.icon as TreeDataNode['icon'],
  children: sidebarItem.children
    ? collectNewDefaultChildNodes(sidebarItem.children, savedKeys)
    : undefined,
  isHidden: true,
});

export const getTreeDataForNavigationItems = (
  navigationItems: NavigationItem[] | null,
  plugins?: AppPlugin[]
): TreeDataNode[] => {
  const sidebarItemsWithPlugins = getSidebarItemsWithPlugins(plugins);

  if (navigationItems === null || isEmpty(navigationItems)) {
    return sidebarItemsWithPlugins.map(convertSidebarItemToTreeNode);
  }

  const sidebarMap = createSidebarMap(sidebarItemsWithPlugins);
  const savedKeys = collectNavigationKeys(navigationItems);

  const savedNodes = navigationItems
    .filter((navItem) => sidebarMap.has(navItem.id))
    .map((navItem) =>
      buildTreeNodeFromSavedItem(navItem, sidebarMap, savedKeys)
    );

  const newDefaultNodes = sidebarItemsWithPlugins
    .filter((sidebarItem) => !savedKeys.has(sidebarItem.key))
    .map((sidebarItem) =>
      convertNewDefaultItemToTreeNode(sidebarItem, savedKeys)
    );

  return [...savedNodes, ...newDefaultNodes];
};

const collectSidebarKeys = (sidebarItem: LeftSidebarItem): string[] => {
  const keys = [sidebarItem.key];
  sidebarItem.children?.forEach((child) => keys.push(child.key));

  return keys;
};

const isNavigationItemHidden = (
  key: string,
  navigationMap: Map<string, NavigationItem>
): boolean => {
  const navItem = navigationMap.get(key);

  return !navItem || Boolean(navItem.isHidden);
};

export const getHiddenKeysFromNavigationItems = (
  navigationItems: NavigationItem[] | null,
  plugins?: AppPlugin[]
): string[] => {
  const sidebarItemsWithPlugins = getSidebarItemsWithPlugins(plugins);

  if (!navigationItems || isEmpty(navigationItems)) {
    return [];
  }

  const navigationMap = createNavigationMap(navigationItems);

  return sidebarItemsWithPlugins
    .flatMap(collectSidebarKeys)
    .filter((key) => isNavigationItemHidden(key, navigationMap));
};

const enhanceNavigationItem = (
  navItem: NavigationItem,
  sidebarMap: Map<string, LeftSidebarItem>
): LeftSidebarItem | null => {
  if (navItem.isHidden) {
    return null;
  }

  const sidebarItem = sidebarMap.get(navItem.id);
  if (!sidebarItem) {
    return null;
  }

  const childrenItems = navItem.children
    ?.map((child) => enhanceNavigationItem(child, sidebarMap))
    .filter((item): item is LeftSidebarItem => item !== null);

  return {
    ...sidebarItem,
    children: isEmpty(childrenItems) ? undefined : childrenItems,
  };
};

export const filterHiddenNavigationItems = (
  navigationItems?: NavigationItem[] | null,
  plugins?: AppPlugin[]
): LeftSidebarItem[] => {
  if (!navigationItems || isEmpty(navigationItems)) {
    return getSidebarItemsWithPlugins(plugins);
  }

  const baseSidebarItems = getBaseSidebarItems();
  const sidebarMap = createSidebarMap(baseSidebarItems);

  const filteredItems = navigationItems
    .map((navItem) => enhanceNavigationItem(navItem, sidebarMap))
    .filter((item): item is LeftSidebarItem => item !== null);

  if (plugins?.length) {
    const pluginItems = extractPluginSidebarItems(plugins);

    return mergePluginSidebarItems(filteredItems, pluginItems, navigationItems);
  }

  return filteredItems;
};
