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

import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import leftSidebarClassBase from '../LeftSidebarClassBase';
import {
  filterHiddenNavigationItems,
  getHiddenKeysFromNavigationItems,
  getSidebarItemsWithPlugins,
  getTreeDataForNavigationItems,
  mergePluginSidebarItems,
} from './CustomizeNavigation';

jest.mock('../LeftSidebarClassBase', () => ({
  getSidebarItems: jest.fn().mockReturnValue([
    {
      key: 'home',
      title: 'Home',
      icon: 'home-icon',
      children: [
        {
          key: 'dashboard',
          title: 'Dashboard',
          icon: 'dashboard-icon',
        },
      ],
    },
    {
      key: 'explore',
      title: 'Explore',
      icon: 'explore-icon',
    },
  ]),
}));

describe('CustomizeNavigation Utils', () => {
  const mockNavigationItems: NavigationItem[] = [
    {
      id: 'home',
      title: 'Home',
      isHidden: false,
      pageId: 'home',
      children: [
        {
          id: 'dashboard',
          title: 'Dashboard',
          isHidden: true,
          pageId: 'dashboard',
        },
      ],
    },
    {
      id: 'explore',
      title: 'Explore',
      isHidden: false,
      pageId: 'explore',
    },
  ];

  describe('getTreeDataForNavigationItems', () => {
    it('should return tree data with icons from sidebar items when navigation items are provided', () => {
      const result = getTreeDataForNavigationItems(mockNavigationItems);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        key: 'home',
        title: 'Home',
        icon: 'home-icon',
        children: [
          {
            key: 'dashboard',
            title: 'Dashboard',
            icon: 'dashboard-icon',
          },
        ],
      });
      expect(result[1]).toEqual({
        key: 'explore',
        title: 'Explore',
        icon: 'explore-icon',
      });
    });

    it('should return sidebar items when navigation items are not provided', () => {
      const result = getTreeDataForNavigationItems(null);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        key: 'home',
        title: 'Home',
        icon: 'home-icon',
      });
      expect(result[1]).toMatchObject({
        key: 'explore',
        title: 'Explore',
        icon: 'explore-icon',
      });
    });

    it('should mark items as hidden when not found in navigation map', () => {
      const limitedNavItems: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
        },
      ];

      const result = getTreeDataForNavigationItems(limitedNavItems);

      expect((result[0] as { isHidden?: boolean }).isHidden).toBeUndefined();
      expect((result[1] as { isHidden?: boolean }).isHidden).toBe(true);
      expect(result[1].key).toBe('explore');
    });

    it('should handle parent items that are hidden', () => {
      const hiddenParentItems: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home Custom',
          isHidden: true,
          pageId: 'home',
          children: [
            {
              id: 'dashboard',
              title: 'Dashboard Custom',
              isHidden: false,
              pageId: 'dashboard',
            },
          ],
        },
      ];

      const result = getTreeDataForNavigationItems(hiddenParentItems);

      expect(result[0].title).toBe('Home Custom');
      expect(result[0].children?.[0].title).toBe('Dashboard Custom');
    });

    it('should use fallback values for children not in navigation map', () => {
      const navItemsWithoutChild: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
        },
      ];

      const result = getTreeDataForNavigationItems(navItemsWithoutChild);

      expect(result[0].children?.[0].title).toBe('Dashboard');
      expect(result[0].children?.[0].key).toBe('dashboard');
    });

    it('should handle plugins with navigation items', () => {
      const mockPlugins = [
        {
          name: 'test-plugin',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-item',
              title: 'Plugin Item',
              icon: 'plugin-icon',
              dataTestId: 'plugin-item',
            },
          ]),
        },
      ];

      const result = getTreeDataForNavigationItems(
        mockNavigationItems,
        mockPlugins
      );

      expect(result).toHaveLength(3);
      expect(result[2].key).toBe('plugin-item');
      expect((result[2] as { isHidden?: boolean }).isHidden).toBe(true);
    });
  });

  describe('getHiddenKeysFromNavigationItems', () => {
    it('should return array of hidden item keys', () => {
      const result = getHiddenKeysFromNavigationItems(mockNavigationItems);

      expect(result).toEqual(['dashboard']);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no navigation items are provided', () => {
      const result = getHiddenKeysFromNavigationItems(null);

      expect(result).toEqual([]);
    });

    it('should return empty array when no items are hidden', () => {
      const items = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
          children: [
            {
              id: 'dashboard',
              title: 'Dashboard',
              isHidden: false,
              pageId: 'dashboard',
            },
          ],
        },
        {
          id: 'explore',
          title: 'Explore',
          isHidden: false,
          pageId: 'explore',
        },
      ];
      const result = getHiddenKeysFromNavigationItems(items);

      expect(result).toEqual([]);
    });

    it('should return keys for items not in navigation map', () => {
      const limitedNavItems: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
        },
      ];

      const result = getHiddenKeysFromNavigationItems(limitedNavItems);

      expect(result).toContain('explore');
    });

    it('should return keys for parent items that are hidden', () => {
      const hiddenParentItems: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home',
          isHidden: true,
          pageId: 'home',
          children: [
            {
              id: 'dashboard',
              title: 'Dashboard',
              isHidden: false,
              pageId: 'dashboard',
            },
          ],
        },
        {
          id: 'explore',
          title: 'Explore',
          isHidden: false,
          pageId: 'explore',
        },
      ];

      const result = getHiddenKeysFromNavigationItems(hiddenParentItems);

      expect(result).toContain('home');
    });

    it('should handle multiple hidden children', () => {
      const multipleHiddenChildren: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
          children: [
            {
              id: 'dashboard',
              title: 'Dashboard',
              isHidden: true,
              pageId: 'dashboard',
            },
          ],
        },
        {
          id: 'explore',
          title: 'Explore',
          isHidden: true,
          pageId: 'explore',
        },
      ];

      const result = getHiddenKeysFromNavigationItems(multipleHiddenChildren);

      expect(result).toContain('dashboard');
      expect(result).toContain('explore');
    });

    it('should handle plugins with hidden items', () => {
      const mockPlugins = [
        {
          name: 'test-plugin',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-item',
              title: 'Plugin Item',
              icon: 'plugin-icon',
              dataTestId: 'plugin-item',
            },
          ]),
        },
      ];

      const result = getHiddenKeysFromNavigationItems(
        mockNavigationItems,
        mockPlugins
      );

      expect(result).toContain('dashboard');
      expect(result).toContain('plugin-item');
    });
  });

  describe('filterHiddenNavigationItems', () => {
    it('should filter out hidden items and their children', () => {
      const result = filterHiddenNavigationItems(mockNavigationItems);

      expect(result).toEqual([
        {
          key: 'home',
          title: 'Home',
          icon: 'home-icon',
        },
        {
          key: 'explore',
          title: 'Explore',
          icon: 'explore-icon',
        },
      ]);
    });

    it('should return original sidebar items when no navigation items provided', () => {
      const result = filterHiddenNavigationItems(null);

      expect(result).toEqual(leftSidebarClassBase.getSidebarItems());
    });

    it('should return null for items not found in sidebar map', () => {
      const items = [
        {
          id: 'non-existent',
          title: 'Non Existent',
          isHidden: false,
          pageId: 'non-existent',
        },
      ];
      const result = filterHiddenNavigationItems(items);

      expect(result).toEqual([]);
    });

    it('should merge plugin items when plugins are provided', () => {
      const mockPlugins = [
        {
          name: 'test-plugin',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-item',
              title: 'Plugin Item',
              icon: 'plugin-icon',
              dataTestId: 'plugin-item',
              index: 1,
            },
          ]),
        },
      ];

      const result = filterHiddenNavigationItems(null, mockPlugins);

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('home');
      expect(result[1].key).toBe('plugin-item');
      expect(result[2].key).toBe('explore');
    });

    it('should merge plugin items that are not marked as hidden in navigationItems', () => {
      const mockPlugins = [
        {
          name: 'test-plugin',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-item',
              title: 'Plugin Item',
              icon: 'plugin-icon',
              dataTestId: 'plugin-item',
            },
          ]),
        },
      ];

      const navItemsWithVisiblePlugin: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
          children: [
            {
              id: 'dashboard',
              title: 'Dashboard',
              isHidden: true,
              pageId: 'dashboard',
            },
          ],
        },
        {
          id: 'explore',
          title: 'Explore',
          isHidden: false,
          pageId: 'explore',
        },
        {
          id: 'plugin-item',
          title: 'Plugin Item',
          isHidden: false,
          pageId: 'plugin-item',
        },
      ];

      const result = filterHiddenNavigationItems(
        navItemsWithVisiblePlugin,
        mockPlugins
      );

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('home');
      expect(result[1].key).toBe('explore');
      expect(result[2].key).toBe('plugin-item');
    });
  });

  describe('mergePluginSidebarItems', () => {
    const mockBaseItems = [
      {
        key: 'home',
        title: 'Home',
        icon: 'home-icon',
        dataTestId: 'home',
      },
      {
        key: 'explore',
        title: 'Explore',
        icon: 'explore-icon',
        dataTestId: 'explore',
      },
    ];

    it('should return base items when plugin items are empty', () => {
      const result = mergePluginSidebarItems(mockBaseItems, []);

      expect(result).toEqual(mockBaseItems);
    });

    it('should append plugin items without index at the end', () => {
      const pluginItems = [
        {
          key: 'plugin1',
          title: 'Plugin 1',
          icon: 'plugin-icon',
          dataTestId: 'plugin1',
        },
      ];

      const result = mergePluginSidebarItems(mockBaseItems, pluginItems);

      expect(result).toHaveLength(3);
      expect(result[2].key).toBe('plugin1');
    });

    it('should insert plugin items at specified index', () => {
      const pluginItems = [
        {
          key: 'plugin1',
          title: 'Plugin 1',
          icon: 'plugin-icon',
          dataTestId: 'plugin1',
          index: 1,
        },
      ];

      const result = mergePluginSidebarItems(mockBaseItems, pluginItems);

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('home');
      expect(result[1].key).toBe('plugin1');
      expect(result[2].key).toBe('explore');
    });

    it('should insert plugin items at index 0', () => {
      const pluginItems = [
        {
          key: 'plugin1',
          title: 'Plugin 1',
          icon: 'plugin-icon',
          dataTestId: 'plugin1',
          index: 0,
        },
      ];

      const result = mergePluginSidebarItems(mockBaseItems, pluginItems);

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('plugin1');
      expect(result[1].key).toBe('home');
      expect(result[2].key).toBe('explore');
    });

    it('should handle multiple plugin items with different indices', () => {
      const pluginItems = [
        {
          key: 'plugin2',
          title: 'Plugin 2',
          icon: 'plugin-icon-2',
          dataTestId: 'plugin2',
          index: 2,
        },
        {
          key: 'plugin1',
          title: 'Plugin 1',
          icon: 'plugin-icon-1',
          dataTestId: 'plugin1',
          index: 0,
        },
        {
          key: 'plugin3',
          title: 'Plugin 3',
          icon: 'plugin-icon-3',
          dataTestId: 'plugin3',
        },
      ];

      const result = mergePluginSidebarItems(mockBaseItems, pluginItems);

      expect(result).toHaveLength(5);
      expect(result[0].key).toBe('plugin1');
      expect(result[1].key).toBe('home');
      expect(result[2].key).toBe('plugin2');
      expect(result[3].key).toBe('explore');
      expect(result[4].key).toBe('plugin3');
    });

    it('should handle index greater than array length', () => {
      const pluginItems = [
        {
          key: 'plugin1',
          title: 'Plugin 1',
          icon: 'plugin-icon',
          dataTestId: 'plugin1',
          index: 999,
        },
      ];

      const result = mergePluginSidebarItems(mockBaseItems, pluginItems);

      expect(result).toHaveLength(3);
      expect(result[2].key).toBe('plugin1');
    });
  });

  describe('extractPluginSidebarItems', () => {
    it('should return all plugin items when navigationItems is not provided', () => {
      const mockPlugins = [
        {
          name: 'plugin-1',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-1-item',
              title: 'Plugin 1 Item',
              icon: 'plugin-1-icon',
              dataTestId: 'plugin-1-item',
            },
          ]),
        },
        {
          name: 'plugin-2',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-2-item',
              title: 'Plugin 2 Item',
              icon: 'plugin-2-icon',
              dataTestId: 'plugin-2-item',
            },
          ]),
        },
      ];

      const result = getSidebarItemsWithPlugins(mockPlugins);

      expect(result).toHaveLength(4);
      expect(result[2].key).toBe('plugin-1-item');
      expect(result[3].key).toBe('plugin-2-item');
    });

    it('should return empty array when plugins have no getSidebarActions method', () => {
      const mockPlugins = [
        {
          name: 'plugin-without-sidebar',
          isInstalled: true,
        },
      ];

      const result = getSidebarItemsWithPlugins(mockPlugins);

      expect(result).toEqual(leftSidebarClassBase.getSidebarItems());
    });

    it('should handle plugins where getSidebarActions returns empty array', () => {
      const mockPlugins = [
        {
          name: 'plugin-empty-sidebar',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([]),
        },
      ];

      const result = getSidebarItemsWithPlugins(mockPlugins);

      expect(result).toEqual(leftSidebarClassBase.getSidebarItems());
    });

    it('should return plugin items not marked as hidden when using filterHiddenNavigationItems', () => {
      const mockPlugins = [
        {
          name: 'plugin-1',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-1-item',
              title: 'Plugin 1 Item',
              icon: 'plugin-1-icon',
              dataTestId: 'plugin-1-item',
            },
            {
              key: 'plugin-2-item',
              title: 'Plugin 2 Item',
              icon: 'plugin-2-icon',
              dataTestId: 'plugin-2-item',
            },
          ]),
        },
      ];

      const navItems: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
        },
        {
          id: 'plugin-1-item',
          title: 'Plugin 1 Item',
          isHidden: true,
          pageId: 'plugin-1-item',
        },
        {
          id: 'plugin-2-item',
          title: 'Plugin 2 Item',
          isHidden: false,
          pageId: 'plugin-2-item',
        },
      ];

      const result = filterHiddenNavigationItems(navItems, mockPlugins);

      expect(result.some((item) => item.key === 'plugin-1-item')).toBe(false);
      expect(result.some((item) => item.key === 'plugin-2-item')).toBe(true);
    });

    it('should flatten items from multiple plugins with getSidebarActions', () => {
      const mockPlugins = [
        {
          name: 'plugin-1',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-1-item-a',
              title: 'Plugin 1 Item A',
              icon: 'plugin-1-icon-a',
              dataTestId: 'plugin-1-item-a',
            },
            {
              key: 'plugin-1-item-b',
              title: 'Plugin 1 Item B',
              icon: 'plugin-1-icon-b',
              dataTestId: 'plugin-1-item-b',
            },
          ]),
        },
        {
          name: 'plugin-2',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-2-item',
              title: 'Plugin 2 Item',
              icon: 'plugin-2-icon',
              dataTestId: 'plugin-2-item',
            },
          ]),
        },
      ];

      const result = getSidebarItemsWithPlugins(mockPlugins);

      expect(result).toHaveLength(5);
      expect(result[2].key).toBe('plugin-1-item-a');
      expect(result[3].key).toBe('plugin-1-item-b');
      expect(result[4].key).toBe('plugin-2-item');
    });

    it('should preserve plugin item order when no index is specified', () => {
      const mockPlugins = [
        {
          name: 'plugin-1',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'first',
              title: 'First',
              icon: 'icon-1',
              dataTestId: 'first',
            },
            {
              key: 'second',
              title: 'Second',
              icon: 'icon-2',
              dataTestId: 'second',
            },
            {
              key: 'third',
              title: 'Third',
              icon: 'icon-3',
              dataTestId: 'third',
            },
          ]),
        },
      ];

      const result = getSidebarItemsWithPlugins(mockPlugins);

      expect(result[2].key).toBe('first');
      expect(result[3].key).toBe('second');
      expect(result[4].key).toBe('third');
    });

    it('should handle mixed plugins with and without getSidebarActions', () => {
      const mockPlugins = [
        {
          name: 'plugin-with-sidebar',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-item',
              title: 'Plugin Item',
              icon: 'plugin-icon',
              dataTestId: 'plugin-item',
            },
          ]),
        },
        {
          name: 'plugin-without-sidebar',
          isInstalled: true,
        },
        {
          name: 'plugin-with-empty-sidebar',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([]),
        },
      ];

      const result = getSidebarItemsWithPlugins(mockPlugins);

      expect(result).toHaveLength(3);
      expect(result[2].key).toBe('plugin-item');
    });

    it('should handle plugin items with undefined navigationItems', () => {
      const mockPlugins = [
        {
          name: 'plugin-1',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-item',
              title: 'Plugin Item',
              icon: 'plugin-icon',
              dataTestId: 'plugin-item',
            },
          ]),
        },
      ];

      const result = getSidebarItemsWithPlugins(mockPlugins);

      expect(result.some((item) => item.key === 'plugin-item')).toBe(true);
    });

    it('should handle all plugins returning undefined from getSidebarActions', () => {
      const mockPlugins = [
        {
          name: 'plugin-1',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue(undefined),
        },
        {
          name: 'plugin-2',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue(null),
        },
      ];

      const result = getSidebarItemsWithPlugins(mockPlugins);

      expect(result).toEqual(leftSidebarClassBase.getSidebarItems());
    });

    it('should include plugin items when all are set to isHidden false', () => {
      const mockPlugins = [
        {
          name: 'plugin-1',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-1-item',
              title: 'Plugin 1 Item',
              icon: 'plugin-1-icon',
              dataTestId: 'plugin-1-item',
            },
            {
              key: 'plugin-2-item',
              title: 'Plugin 2 Item',
              icon: 'plugin-2-icon',
              dataTestId: 'plugin-2-item',
            },
          ]),
        },
      ];

      const navItems: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
        },
        {
          id: 'plugin-1-item',
          title: 'Plugin 1 Item',
          isHidden: false,
          pageId: 'plugin-1-item',
        },
        {
          id: 'plugin-2-item',
          title: 'Plugin 2 Item',
          isHidden: false,
          pageId: 'plugin-2-item',
        },
      ];

      const result = filterHiddenNavigationItems(navItems, mockPlugins);

      expect(result.some((item) => item.key === 'plugin-1-item')).toBe(true);
      expect(result.some((item) => item.key === 'plugin-2-item')).toBe(true);
    });

    it('should correctly filter plugin items with mixed visibility states', () => {
      const mockPlugins = [
        {
          name: 'multi-item-plugin',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'visible-item',
              title: 'Visible Item',
              icon: 'visible-icon',
              dataTestId: 'visible-item',
            },
            {
              key: 'hidden-item',
              title: 'Hidden Item',
              icon: 'hidden-icon',
              dataTestId: 'hidden-item',
            },
            {
              key: 'another-visible-item',
              title: 'Another Visible',
              icon: 'another-icon',
              dataTestId: 'another-visible-item',
            },
          ]),
        },
      ];

      const navItems: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
        },
        {
          id: 'hidden-item',
          title: 'Hidden Item',
          isHidden: true,
          pageId: 'hidden-item',
        },
        {
          id: 'visible-item',
          title: 'Visible Item',
          isHidden: false,
          pageId: 'visible-item',
        },
      ];

      const result = filterHiddenNavigationItems(navItems, mockPlugins);

      expect(result.some((item) => item.key === 'hidden-item')).toBe(false);
      expect(result.some((item) => item.key === 'visible-item')).toBe(true);
      expect(result.some((item) => item.key === 'another-visible-item')).toBe(
        true
      );
    });

    it('should include plugin items when they do not exist in navigationItems', () => {
      const mockPlugins = [
        {
          name: 'plugin-1',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-item',
              title: 'Plugin Item',
              icon: 'plugin-icon',
              dataTestId: 'plugin-item',
            },
          ]),
        },
      ];

      const navItems: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
        },
        {
          id: 'explore',
          title: 'Explore',
          isHidden: false,
          pageId: 'explore',
        },
      ];

      const result = filterHiddenNavigationItems(navItems, mockPlugins);

      expect(result.some((item) => item.key === 'plugin-item')).toBe(true);
    });
  });

  describe('getSidebarItemsWithPlugins', () => {
    it('should return base items when no plugins provided', () => {
      const result = getSidebarItemsWithPlugins();

      expect(result).toEqual(leftSidebarClassBase.getSidebarItems());
    });

    it('should return base items when plugins array is empty', () => {
      const result = getSidebarItemsWithPlugins([]);

      expect(result).toEqual(leftSidebarClassBase.getSidebarItems());
    });

    it('should merge plugin items with base sidebar items', () => {
      const mockPlugins = [
        {
          name: 'test-plugin',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-item',
              title: 'Plugin Item',
              icon: 'plugin-icon',
              dataTestId: 'plugin-item',
              index: 1,
            },
          ]),
        },
      ];

      const result = getSidebarItemsWithPlugins(mockPlugins);

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('home');
      expect(result[1].key).toBe('plugin-item');
      expect(result[2].key).toBe('explore');
    });

    it('should handle multiple plugins', () => {
      const mockPlugins = [
        {
          name: 'plugin-1',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-1-item',
              title: 'Plugin 1 Item',
              icon: 'plugin-1-icon',
              dataTestId: 'plugin-1-item',
              index: 0,
            },
          ]),
        },
        {
          name: 'plugin-2',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: 'plugin-2-item',
              title: 'Plugin 2 Item',
              icon: 'plugin-2-icon',
              dataTestId: 'plugin-2-item',
            },
          ]),
        },
      ];

      const result = getSidebarItemsWithPlugins(mockPlugins);

      expect(result).toHaveLength(4);
      expect(result[0].key).toBe('plugin-1-item');
      expect(result[1].key).toBe('home');
      expect(result[2].key).toBe('explore');
      expect(result[3].key).toBe('plugin-2-item');
    });
  });
});
