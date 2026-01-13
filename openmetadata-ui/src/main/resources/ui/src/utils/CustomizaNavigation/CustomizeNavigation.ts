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
  pluginItems: Array<LeftSidebarItemExample>
): LeftSidebarItem[] => {
  if (isEmpty(pluginItems)) {
    return baseItems;
  }

  const sortedPluginItems = sortPluginItemsByIndex(pluginItems);
  const mergedItems = [...baseItems];

  sortedPluginItems.forEach((item) => insertPluginItem(mergedItems, item));

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

const convertSidebarItemToTreeNode = (
  sidebarItem: LeftSidebarItem
): TreeDataNode => ({
  title: sidebarItem.title,
  key: sidebarItem.key,
  icon: sidebarItem.icon as TreeDataNode['icon'],
  children: sidebarItem.children?.map((child) => ({
    title: child.title,
    key: child.key,
    icon: child.icon as TreeDataNode['icon'],
  })),
});

const mapSidebarItemWithNavigation = (
  sidebarItem: LeftSidebarItem,
  navigationMap: Map<string, NavigationItem>
): TreeDataNode & { isHidden?: boolean } => {
  const navItem = navigationMap.get(sidebarItem.key);

  if (!navItem) {
    return {
      title: sidebarItem.title,
      key: sidebarItem.key,
      icon: sidebarItem.icon as TreeDataNode['icon'],
      isHidden: true,
    };
  }

  return {
    title: navItem.title,
    key: navItem.id,
    icon: sidebarItem.icon as TreeDataNode['icon'],
    children: sidebarItem.children?.map((child) => {
      const navChild = navigationMap.get(child.key);

      return {
        title: navChild?.title ?? child.title,
        key: navChild?.id ?? child.key,
        icon: child.icon as TreeDataNode['icon'],
      };
    }),
  };
};

export const getTreeDataForNavigationItems = (
  navigationItems: NavigationItem[] | null,
  plugins?: AppPlugin[]
): TreeDataNode[] => {
  const sidebarItemsWithPlugins = getSidebarItemsWithPlugins(plugins);

  if (navigationItems === null) {
    return sidebarItemsWithPlugins.map(convertSidebarItemToTreeNode);
  }

  const navigationMap = createNavigationMap(navigationItems);

  return sidebarItemsWithPlugins.map((sidebarItem) =>
    mapSidebarItemWithNavigation(sidebarItem, navigationMap)
  );
};

const collectHiddenKeys = (
  item: LeftSidebarItem,
  navigationMap: Map<string, NavigationItem> | null
): string[] => {
  const keys: string[] = [];
  const navItem = navigationMap?.get(item.key);

  if (navigationMap && (!navItem || navItem.isHidden)) {
    keys.push(item.key);
  }

  const hiddenChildKeys =
    navItem?.children
      ?.filter((child) => child.isHidden)
      .map((child) => child.id) ?? [];

  return [...keys, ...hiddenChildKeys];
};

export const getHiddenKeysFromNavigationItems = (
  navigationItems: NavigationItem[] | null,
  plugins?: AppPlugin[]
): string[] => {
  const sidebarItemsWithPlugins = getSidebarItemsWithPlugins(plugins);
  const navigationMap = navigationItems
    ? createNavigationMap(navigationItems)
    : null;

  return sidebarItemsWithPlugins.flatMap((item) =>
    collectHiddenKeys(item, navigationMap)
  );
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

    return mergePluginSidebarItems(filteredItems, pluginItems);
  }

  return filteredItems;
};
