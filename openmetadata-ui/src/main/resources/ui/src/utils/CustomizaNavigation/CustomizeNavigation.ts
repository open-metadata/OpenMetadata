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
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import leftSidebarClassBase from '../LeftSidebarClassBase';

const leftSidebarItems = leftSidebarClassBase.getSidebarItems();

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

const sidebarMap = createSidebarMap(leftSidebarItems);

export const getTreeDataForNavigationItems = (
  navigationItems?: NavigationItem[]
): TreeDataNode[] => {
  return isEmpty(navigationItems)
    ? leftSidebarItems.map((item) => {
        return {
          title: item.title,
          key: item.key ?? '',
          icon: item.icon as TreeDataNode['icon'],
          children: item.children?.map((i) => {
            return {
              title: i.title,
              key: i.key,
              icon: i.icon as TreeDataNode['icon'],
            };
          }),
        };
      })
    : navigationItems?.map((item) => {
        const sidebarItem = sidebarMap.get(item.id);

        return {
          title: item.title,
          key: item.id,
          icon: sidebarItem?.icon as TreeDataNode['icon'],
          children: item.children?.map((i) => {
            const sidebarItem = sidebarMap.get(i.id);

            return {
              title: i.title,
              key: i.id,
              icon: sidebarItem?.icon as TreeDataNode['icon'],
            };
          }),
        };
      }) ?? [];
};

export const getHiddenKeysFromNavigationItems = (
  navigationItems?: NavigationItem[]
) => {
  return (
    navigationItems?.reduce((keys, item) => {
      if (item.isHidden) {
        keys.push(item.id);
      }

      if (item.children) {
        keys.push(...item.children.filter((i) => i.isHidden).map((i) => i.id));
      }

      return keys;
    }, [] as string[]) ?? []
  );
};

export const filterHiddenNavigationItems = (
  navigationItems?: NavigationItem[] | null
): LeftSidebarItem[] => {
  if (!navigationItems || isEmpty(navigationItems)) {
    return leftSidebarItems;
  }

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

  return navigationItems
    .map((navItem) => enhanceNavItem(navItem, sidebarMap))
    .filter((item): item is LeftSidebarItem => item !== null);
};
