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
import { isEmpty } from 'lodash';
import { LeftSidebarItem } from '../../components/MyData/LeftSidebar/LeftSidebar.interface';
import { AppPlugin } from '../../components/Settings/Applications/plugins/AppPlugin';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import leftSidebarClassBase from '../LeftSidebarClassBase';

const getBaseSidebarItems = (): LeftSidebarItem[] => {
  return leftSidebarClassBase.getSidebarItems();
};

// Create nested map including all sidebar items and their children
const createSidebarMap = (
  items: LeftSidebarItem[]
): Map<string, LeftSidebarItem> => {
  const map = new Map<string, LeftSidebarItem>();

  const addToMap = (item: LeftSidebarItem) => {
    map.set(item.key, item);
    item.children?.forEach((child) => addToMap(child));
  };

  items.forEach((item) => addToMap(item));

  return map;
};

export const mergePluginSidebarItems = (
  baseItems: LeftSidebarItem[],
  pluginItems: Array<LeftSidebarItem & { index?: number }>
): LeftSidebarItem[] => {
  if (isEmpty(pluginItems)) {
    return baseItems;
  }

  const sortedPluginItems = [...pluginItems].sort(
    (a, b) => (a.index ?? 999) - (b.index ?? 999)
  );

  const mergedItems = [...baseItems];

  sortedPluginItems.forEach((pluginItem) => {
    if (typeof pluginItem.index === 'number' && pluginItem.index >= 0) {
      mergedItems.splice(
        Math.min(pluginItem.index, mergedItems.length),
        0,
        pluginItem
      );
    } else {
      mergedItems.push(pluginItem);
    }
  });

  return mergedItems;
};

const extractPluginSidebarItems = (
  plugins: AppPlugin[]
): Array<LeftSidebarItem & { index?: number }> => {
  return plugins.flatMap((plugin) => plugin.getSidebarActions?.() ?? []);
};

export const getSidebarItemsWithPlugins = (
  plugins?: AppPlugin[]
): LeftSidebarItem[] => {
  const baseItems = getBaseSidebarItems();

  if (!plugins || plugins.length === 0) {
    return baseItems;
  }

  const pluginItems = extractPluginSidebarItems(plugins);

  return mergePluginSidebarItems(baseItems, pluginItems);
};

const createNavigationMap = (
  navigationItems?: NavigationItem[]
): Map<string, NavigationItem> => {
  const map = new Map<string, NavigationItem>();

  navigationItems?.forEach((item) => {
    map.set(item.id, item);
    item.children?.forEach((child) => {
      map.set(child.id, child);
    });
  });

  return map;
};

export const getTreeDataForNavigationItems = (
  navigationItems?: NavigationItem[],
  plugins?: AppPlugin[]
): TreeDataNode[] => {
  const sidebarItemsWithPlugins = getSidebarItemsWithPlugins(plugins);
  const navigationMap = createNavigationMap(navigationItems);

  return sidebarItemsWithPlugins.map((sidebarItem) => {
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
  });
};

export const getHiddenKeysFromNavigationItems = (
  navigationItems?: NavigationItem[],
  plugins?: AppPlugin[]
): string[] => {
  const sidebarItemsWithPlugins = getSidebarItemsWithPlugins(plugins);
  const navigationMap = createNavigationMap(navigationItems);

  return sidebarItemsWithPlugins.reduce((keys, item) => {
    const navItem = navigationMap.get(item.key);

    if (!navItem || navItem.isHidden) {
      keys.push(item.key);
    }

    navItem?.children
      ?.filter((child) => child.isHidden)
      .forEach((child) => keys.push(child.id));

    return keys;
  }, [] as string[]);
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

  const enhanceNavItem = (
    navItem: NavigationItem,
    sidebarMap: Map<string, LeftSidebarItem>
  ): LeftSidebarItem | null => {
    const sidebarItem = sidebarMap.get(navItem.id);

    if (navItem.isHidden || !sidebarItem) {
      return null;
    }

    const childrenItems = navItem.children
      ?.map((child) => enhanceNavItem(child, sidebarMap))
      .filter((item) => item !== null);

    return {
      ...sidebarItem,
      children: isEmpty(childrenItems) ? undefined : childrenItems,
    } as LeftSidebarItem;
  };

  const filteredItems = navigationItems
    .map((navItem) => enhanceNavItem(navItem, sidebarMap))
    .filter((item): item is LeftSidebarItem => item !== null);

  if (plugins && plugins.length > 0) {
    const pluginItems = extractPluginSidebarItems(plugins);

    return mergePluginSidebarItems(filteredItems, pluginItems);
  }

  return filteredItems;
};
