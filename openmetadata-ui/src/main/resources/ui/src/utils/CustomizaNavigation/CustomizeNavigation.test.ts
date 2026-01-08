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

      expect(result).toEqual([
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
      ]);
    });

    it('should return sidebar items when navigation items are not provided', () => {
      const result = getTreeDataForNavigationItems();

      expect(result).toEqual([
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
      ]);
    });
  });

  describe('getHiddenKeysFromNavigationItems', () => {
    it('should return array of hidden item keys', () => {
      const result = getHiddenKeysFromNavigationItems(mockNavigationItems);

      expect(result).toEqual(['dashboard']);
    });

    it('should return empty array when no navigation items are provided', () => {
      const result = getHiddenKeysFromNavigationItems();

      expect(result).toEqual([]);
    });

    it('should return empty array when no items are hidden', () => {
      const items = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
        },
      ];
      const result = getHiddenKeysFromNavigationItems(items);

      expect(result).toEqual([]);
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

    it('should merge plugin items with filtered navigation items', () => {
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

      const result = filterHiddenNavigationItems(
        mockNavigationItems,
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
