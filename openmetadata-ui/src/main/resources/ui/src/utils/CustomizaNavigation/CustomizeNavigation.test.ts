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
  getTreeDataForNavigationItems,
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
  });
});
