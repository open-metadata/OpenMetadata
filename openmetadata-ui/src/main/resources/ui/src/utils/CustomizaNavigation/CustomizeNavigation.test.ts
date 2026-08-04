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

const TEST_PLUGIN = 'test-plugin';
const PLUGIN_ITEM = 'plugin-item';
const PLUGIN_ITEM_2 = 'Plugin Item';
const PLUGIN_ICON = 'plugin-icon';
const DATA_QUALITY = 'data-quality';
const DATA_QUALITY_2 = 'Data Quality';
const INCIDENT_MANAGER = 'incident-manager';
const INCIDENT_MANAGER_2 = 'Incident Manager';
const NEW_FEATURE = 'new-feature';
const NEW_FEATURE_2 = 'New Feature';
const NEW_FEATURE_ICON = 'new-feature-icon';
const SHARED_CHILD = 'shared-child';
const ONTOLOGY_EXPLORER = 'ontology-explorer';
const ONTOLOGY_EXPLORER_2 = 'Ontology Explorer';
const ONTOLOGY_ICON = 'ontology-icon';
const PLUGIN_1_ITEM = 'plugin-1-item';
const PLUGIN_2_ITEM = 'plugin-2-item';

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
          // eslint-disable-next-line sonarjs/no-duplicate-string
          icon: 'dashboard-icon',
        },
      ],
    },
    {
      key: 'explore',
      title: 'Explore',
      // eslint-disable-next-line sonarjs/no-duplicate-string
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
          name: TEST_PLUGIN,
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: PLUGIN_ITEM,
              title: PLUGIN_ITEM_2,
              icon: PLUGIN_ICON,
              dataTestId: PLUGIN_ITEM,
            },
          ]),
        },
      ];

      const result = getTreeDataForNavigationItems(
        mockNavigationItems,
        mockPlugins
      );

      expect(result).toHaveLength(3);
      expect(result[2].key).toBe(PLUGIN_ITEM);
      expect((result[2] as { isHidden?: boolean }).isHidden).toBe(true);
    });

    it('should preserve the saved order of top-level items', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        { key: 'home', title: 'Home', icon: 'home-icon' },
        { key: 'explore', title: 'Explore', icon: 'explore-icon' },
        { key: 'lineage', title: 'Lineage', icon: 'lineage-icon' },
      ]);

      const savedNav: NavigationItem[] = [
        { id: 'lineage', title: 'Lineage', isHidden: false, pageId: 'lineage' },
        { id: 'home', title: 'Home', isHidden: false, pageId: 'home' },
        { id: 'explore', title: 'Explore', isHidden: false, pageId: 'explore' },
      ];

      const result = getTreeDataForNavigationItems(savedNav);

      expect(result.map((item) => item.key)).toEqual([
        'lineage',
        'home',
        'explore',
      ]);
    });

    it('should preserve the saved order of children within a group', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        {
          key: 'home',
          title: 'Home',
          icon: 'home-icon',
          children: [
            { key: 'a', title: 'A', icon: 'a-icon' },
            { key: 'b', title: 'B', icon: 'b-icon' },
            { key: 'c', title: 'C', icon: 'c-icon' },
          ],
        },
      ]);

      const savedNav: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
          children: [
            { id: 'c', title: 'C', isHidden: false, pageId: 'c' },
            { id: 'a', title: 'A', isHidden: false, pageId: 'a' },
            { id: 'b', title: 'B', isHidden: false, pageId: 'b' },
          ],
        },
      ];

      const result = getTreeDataForNavigationItems(savedNav);

      expect(result[0].children?.map((child) => child.key)).toEqual([
        'c',
        'a',
        'b',
      ]);
    });

    it('should keep a child moved to another group under its new parent', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        {
          key: 'observability',
          title: 'Observability',
          icon: 'observability-icon',
          children: [
            { key: DATA_QUALITY, title: DATA_QUALITY_2, icon: 'dq-icon' },
            {
              key: INCIDENT_MANAGER,
              title: INCIDENT_MANAGER_2,
              icon: 'im-icon',
            },
          ],
        },
        {
          key: 'governance',
          title: 'Govern',
          icon: 'govern-icon',
          children: [
            { key: 'glossary', title: 'Glossary', icon: 'glossary-icon' },
          ],
        },
      ]);

      const savedNav: NavigationItem[] = [
        {
          id: 'observability',
          title: 'Observability',
          isHidden: false,
          pageId: 'observability',
          children: [
            {
              id: DATA_QUALITY,
              title: DATA_QUALITY_2,
              isHidden: false,
              pageId: DATA_QUALITY,
            },
          ],
        },
        {
          id: 'governance',
          title: 'Govern',
          isHidden: false,
          pageId: 'governance',
          children: [
            {
              id: 'glossary',
              title: 'Glossary',
              isHidden: false,
              pageId: 'glossary',
            },
            {
              id: INCIDENT_MANAGER,
              title: INCIDENT_MANAGER_2,
              isHidden: false,
              pageId: INCIDENT_MANAGER,
            },
          ],
        },
      ];

      const result = getTreeDataForNavigationItems(savedNav);

      expect(result[0].key).toBe('observability');
      expect(result[0].children?.map((child) => child.key)).toEqual([
        DATA_QUALITY,
      ]);
      expect(result[1].key).toBe('governance');
      expect(result[1].children?.map((child) => child.key)).toEqual([
        'glossary',
        INCIDENT_MANAGER,
      ]);
    });

    it('should append new default children after the saved children', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        {
          key: 'home',
          title: 'Home',
          icon: 'home-icon',
          children: [
            {
              key: NEW_FEATURE,
              title: NEW_FEATURE_2,
              icon: NEW_FEATURE_ICON,
            },
            { key: 'dashboard', title: 'Dashboard', icon: 'dashboard-icon' },
          ],
        },
      ]);

      const savedNav: NavigationItem[] = [
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
      ];

      const result = getTreeDataForNavigationItems(savedNav);

      expect(result[0].children?.map((child) => child.key)).toEqual([
        'dashboard',
        NEW_FEATURE,
      ]);
    });

    it('should not duplicate a saved child under a new default top-level group', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        { key: 'home', title: 'Home', icon: 'home-icon', children: [] },
        {
          key: 'new-group',
          title: 'New Group',
          icon: 'new-group-icon',
          children: [
            { key: SHARED_CHILD, title: 'Shared Child', icon: 'shared-icon' },
            {
              key: 'brand-new-child',
              title: 'Brand New Child',
              icon: 'brand-new-icon',
            },
          ],
        },
      ]);

      // Shared Child was already moved under Home before New Group was added
      const savedNav: NavigationItem[] = [
        {
          id: 'home',
          title: 'Home',
          isHidden: false,
          pageId: 'home',
          children: [
            {
              id: SHARED_CHILD,
              title: 'Shared Child',
              isHidden: false,
              pageId: SHARED_CHILD,
            },
          ],
        },
      ];

      const result = getTreeDataForNavigationItems(savedNav);
      const homeNode = result.find((node) => node.key === 'home');
      const newGroupNode = result.find((node) => node.key === 'new-group');

      expect(homeNode?.children?.map((child) => child.key)).toEqual([
        SHARED_CHILD,
      ]);
      expect(newGroupNode?.children?.map((child) => child.key)).toEqual([
        'brand-new-child',
      ]);
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
          name: TEST_PLUGIN,
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: PLUGIN_ITEM,
              title: PLUGIN_ITEM_2,
              icon: PLUGIN_ICON,
              dataTestId: PLUGIN_ITEM,
            },
          ]),
        },
      ];

      const result = getHiddenKeysFromNavigationItems(
        mockNavigationItems,
        mockPlugins
      );

      expect(result).toContain('dashboard');
      expect(result).toContain(PLUGIN_ITEM);
    });

    it('new child should be in hidden keys when absent from saved nav', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        {
          key: 'home',
          title: 'Home',
          icon: 'home-icon',
          children: [
            { key: 'dashboard', title: 'Dashboard', icon: 'dashboard-icon' },
            {
              key: NEW_FEATURE,
              title: NEW_FEATURE_2,
              icon: NEW_FEATURE_ICON,
            },
          ],
        },
        { key: 'explore', title: 'Explore', icon: 'explore-icon' },
      ]);

      const savedNav: NavigationItem[] = [
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
        { id: 'explore', title: 'Explore', isHidden: false, pageId: 'explore' },
      ];

      const result = getHiddenKeysFromNavigationItems(savedNav);

      expect(result).toContain(NEW_FEATURE);
    });

    it('new top-level item should be in hidden keys when absent from saved nav', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        {
          key: 'home',
          title: 'Home',
          icon: 'home-icon',
          children: [
            { key: 'dashboard', title: 'Dashboard', icon: 'dashboard-icon' },
          ],
        },
        { key: 'explore', title: 'Explore', icon: 'explore-icon' },
        {
          key: ONTOLOGY_EXPLORER,
          title: ONTOLOGY_EXPLORER_2,
          icon: ONTOLOGY_ICON,
        },
      ]);

      const savedNav: NavigationItem[] = [
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
        { id: 'explore', title: 'Explore', isHidden: false, pageId: 'explore' },
      ];

      const result = getHiddenKeysFromNavigationItems(savedNav);

      expect(result).toContain(ONTOLOGY_EXPLORER);
    });

    it('child item should be in hidden keys when explicitly hidden in saved nav', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        {
          key: 'home',
          title: 'Home',
          icon: 'home-icon',
          children: [
            { key: 'dashboard', title: 'Dashboard', icon: 'dashboard-icon' },
            {
              key: NEW_FEATURE,
              title: NEW_FEATURE_2,
              icon: NEW_FEATURE_ICON,
            },
          ],
        },
        { key: 'explore', title: 'Explore', icon: 'explore-icon' },
      ]);

      const savedNav: NavigationItem[] = [
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
            {
              id: NEW_FEATURE,
              title: NEW_FEATURE_2,
              isHidden: true,
              pageId: NEW_FEATURE,
            },
          ],
        },
        { id: 'explore', title: 'Explore', isHidden: false, pageId: 'explore' },
      ];

      const result = getHiddenKeysFromNavigationItems(savedNav);

      expect(result).toContain(NEW_FEATURE);
    });

    it('should not mark a moved child as hidden when it is visible under its new parent', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        {
          key: 'observability',
          title: 'Observability',
          icon: 'observability-icon',
          children: [
            { key: DATA_QUALITY, title: DATA_QUALITY_2, icon: 'dq-icon' },
            {
              key: INCIDENT_MANAGER,
              title: INCIDENT_MANAGER_2,
              icon: 'im-icon',
            },
          ],
        },
        {
          key: 'governance',
          title: 'Govern',
          icon: 'govern-icon',
          children: [
            { key: 'glossary', title: 'Glossary', icon: 'glossary-icon' },
          ],
        },
      ]);

      const savedNav: NavigationItem[] = [
        {
          id: 'observability',
          title: 'Observability',
          isHidden: false,
          pageId: 'observability',
          children: [
            {
              id: DATA_QUALITY,
              title: DATA_QUALITY_2,
              isHidden: false,
              pageId: DATA_QUALITY,
            },
          ],
        },
        {
          id: 'governance',
          title: 'Govern',
          isHidden: false,
          pageId: 'governance',
          children: [
            {
              id: 'glossary',
              title: 'Glossary',
              isHidden: false,
              pageId: 'glossary',
            },
            {
              id: INCIDENT_MANAGER,
              title: INCIDENT_MANAGER_2,
              isHidden: false,
              pageId: INCIDENT_MANAGER,
            },
          ],
        },
      ];

      const result = getHiddenKeysFromNavigationItems(savedNav);

      expect(result).not.toContain(INCIDENT_MANAGER);
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
          name: TEST_PLUGIN,
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: PLUGIN_ITEM,
              title: PLUGIN_ITEM_2,
              icon: PLUGIN_ICON,
              dataTestId: PLUGIN_ITEM,
              index: 1,
            },
          ]),
        },
      ];

      const result = filterHiddenNavigationItems(null, mockPlugins);

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('home');
      expect(result[1].key).toBe(PLUGIN_ITEM);
      expect(result[2].key).toBe('explore');
    });

    it('should merge plugin items with filtered navigation items', () => {
      const mockPlugins = [
        {
          name: TEST_PLUGIN,
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: PLUGIN_ITEM,
              title: PLUGIN_ITEM_2,
              icon: PLUGIN_ICON,
              dataTestId: PLUGIN_ITEM,
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
      expect(result[2].key).toBe(PLUGIN_ITEM);
    });

    it('new child should be disabled when it is absent from the saved persona nav', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        {
          key: 'home',
          title: 'Home',
          icon: 'home-icon',
          children: [
            { key: 'dashboard', title: 'Dashboard', icon: 'dashboard-icon' },
            {
              key: NEW_FEATURE,
              title: NEW_FEATURE_2,
              icon: NEW_FEATURE_ICON,
            },
          ],
        },
        { key: 'explore', title: 'Explore', icon: 'explore-icon' },
      ]);

      const savedNav: NavigationItem[] = [
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
        { id: 'explore', title: 'Explore', isHidden: false, pageId: 'explore' },
      ];

      const result = filterHiddenNavigationItems(savedNav);
      const homeItem = result.find((item) => item.key === 'home');

      expect(
        homeItem?.children?.some((c) => c.key === NEW_FEATURE)
      ).toBeFalsy();
    });

    it('new top-level item should be disabled when it is absent from the saved persona nav', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        {
          key: 'home',
          title: 'Home',
          icon: 'home-icon',
          children: [
            { key: 'dashboard', title: 'Dashboard', icon: 'dashboard-icon' },
          ],
        },
        { key: 'explore', title: 'Explore', icon: 'explore-icon' },
        {
          key: ONTOLOGY_EXPLORER,
          title: ONTOLOGY_EXPLORER_2,
          icon: ONTOLOGY_ICON,
        },
      ]);

      const savedNav: NavigationItem[] = [
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
        { id: 'explore', title: 'Explore', isHidden: false, pageId: 'explore' },
      ];

      const result = filterHiddenNavigationItems(savedNav);

      expect(result.some((item) => item.key === ONTOLOGY_EXPLORER)).toBe(false);
    });

    it('top-level item should be disabled when explicitly hidden in the saved persona nav', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        { key: 'home', title: 'Home', icon: 'home-icon', children: [] },
        { key: 'explore', title: 'Explore', icon: 'explore-icon' },
        {
          key: ONTOLOGY_EXPLORER,
          title: ONTOLOGY_EXPLORER_2,
          icon: ONTOLOGY_ICON,
        },
      ]);

      const savedNav: NavigationItem[] = [
        { id: 'home', title: 'Home', isHidden: false, pageId: 'home' },
        { id: 'explore', title: 'Explore', isHidden: false, pageId: 'explore' },
        {
          id: ONTOLOGY_EXPLORER,
          title: ONTOLOGY_EXPLORER_2,
          isHidden: true,
          pageId: ONTOLOGY_EXPLORER,
        },
      ];

      const result = filterHiddenNavigationItems(savedNav);

      expect(result.some((item) => item.key === ONTOLOGY_EXPLORER)).toBe(false);
    });

    it('child item should be disabled when explicitly hidden in the saved persona nav', () => {
      (leftSidebarClassBase.getSidebarItems as jest.Mock).mockReturnValueOnce([
        {
          key: 'home',
          title: 'Home',
          icon: 'home-icon',
          children: [
            { key: 'dashboard', title: 'Dashboard', icon: 'dashboard-icon' },
            {
              key: NEW_FEATURE,
              title: NEW_FEATURE_2,
              icon: NEW_FEATURE_ICON,
            },
          ],
        },
        { key: 'explore', title: 'Explore', icon: 'explore-icon' },
      ]);

      const savedNav: NavigationItem[] = [
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
            {
              id: NEW_FEATURE,
              title: NEW_FEATURE_2,
              isHidden: true,
              pageId: NEW_FEATURE,
            },
          ],
        },
        { id: 'explore', title: 'Explore', isHidden: false, pageId: 'explore' },
      ];

      const result = filterHiddenNavigationItems(savedNav);
      const homeItem = result.find((item) => item.key === 'home');

      expect(
        homeItem?.children?.some((c) => c.key === NEW_FEATURE)
      ).toBeFalsy();
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
          icon: PLUGIN_ICON,
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
          icon: PLUGIN_ICON,
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
          icon: PLUGIN_ICON,
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
          icon: PLUGIN_ICON,
          dataTestId: 'plugin1',
          index: 999,
        },
      ];

      const result = mergePluginSidebarItems(mockBaseItems, pluginItems);

      expect(result).toHaveLength(3);
      expect(result[2].key).toBe('plugin1');
    });

    it('should exclude plugin items that are marked as hidden in navigationItems', () => {
      const pluginItems = [
        {
          key: 'plugin1',
          title: 'Plugin 1',
          icon: PLUGIN_ICON,
          dataTestId: 'plugin1',
          index: 1,
        },
      ];

      const navItems: NavigationItem[] = [
        {
          id: 'plugin1',
          title: 'Plugin 1',
          isHidden: true,
          pageId: 'plugin1',
        },
      ];

      const result = mergePluginSidebarItems(
        mockBaseItems,
        pluginItems,
        navItems
      );

      expect(result).toHaveLength(2);
      expect(result.some((item) => item.key === 'plugin1')).toBe(false);
    });

    it('should include plugin items that are marked as not hidden in navigationItems', () => {
      const pluginItems = [
        {
          key: 'plugin1',
          title: 'Plugin 1',
          icon: PLUGIN_ICON,
          dataTestId: 'plugin1',
          index: 1,
        },
      ];

      const navItems: NavigationItem[] = [
        {
          id: 'plugin1',
          title: 'Plugin 1',
          isHidden: false,
          pageId: 'plugin1',
        },
      ];

      const result = mergePluginSidebarItems(
        mockBaseItems,
        pluginItems,
        navItems
      );

      expect(result).toHaveLength(3);
      expect(result[1].key).toBe('plugin1');
    });

    it('should include plugin items when navigationItems is not provided', () => {
      const pluginItems = [
        {
          key: 'plugin1',
          title: 'Plugin 1',
          icon: PLUGIN_ICON,
          dataTestId: 'plugin1',
          index: 1,
        },
      ];

      const result = mergePluginSidebarItems(mockBaseItems, pluginItems);

      expect(result).toHaveLength(3);
      expect(result[1].key).toBe('plugin1');
    });

    it('should include plugin items when they do not exist in navigationItems', () => {
      const pluginItems = [
        {
          key: 'plugin1',
          title: 'Plugin 1',
          icon: PLUGIN_ICON,
          dataTestId: 'plugin1',
          index: 1,
        },
      ];

      const navItems: NavigationItem[] = [
        {
          id: 'other-item',
          title: 'Other Item',
          isHidden: false,
          pageId: 'other-item',
        },
      ];

      const result = mergePluginSidebarItems(
        mockBaseItems,
        pluginItems,
        navItems
      );

      expect(result).toHaveLength(3);
      expect(result[1].key).toBe('plugin1');
    });

    it('should handle multiple plugin items with mixed visibility states', () => {
      const pluginItems = [
        {
          key: 'plugin1',
          title: 'Plugin 1',
          icon: 'plugin-icon-1',
          dataTestId: 'plugin1',
          index: 0,
        },
        {
          key: 'plugin2',
          title: 'Plugin 2',
          icon: 'plugin-icon-2',
          dataTestId: 'plugin2',
          index: 1,
        },
        {
          key: 'plugin3',
          title: 'Plugin 3',
          icon: 'plugin-icon-3',
          dataTestId: 'plugin3',
          index: 2,
        },
      ];

      const navItems: NavigationItem[] = [
        {
          id: 'plugin1',
          title: 'Plugin 1',
          isHidden: false,
          pageId: 'plugin1',
        },
        {
          id: 'plugin2',
          title: 'Plugin 2',
          isHidden: true,
          pageId: 'plugin2',
        },
        {
          id: 'plugin3',
          title: 'Plugin 3',
          isHidden: false,
          pageId: 'plugin3',
        },
      ];

      const result = mergePluginSidebarItems(
        mockBaseItems,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pluginItems as any,
        navItems
      );

      expect(result).toHaveLength(4);
      expect(result[0].key).toBe('plugin1');
      expect(result[1].key).toBe('home');
      expect(result[2].key).toBe('plugin3');
      expect(result[3].key).toBe('explore');
      expect(result.some((item) => item.key === 'plugin2')).toBe(false);
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
          name: TEST_PLUGIN,
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: PLUGIN_ITEM,
              title: PLUGIN_ITEM_2,
              icon: PLUGIN_ICON,
              dataTestId: PLUGIN_ITEM,
              index: 1,
            },
          ]),
        },
      ];

      const result = getSidebarItemsWithPlugins(mockPlugins);

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('home');
      expect(result[1].key).toBe(PLUGIN_ITEM);
      expect(result[2].key).toBe('explore');
    });

    it('should handle multiple plugins', () => {
      const mockPlugins = [
        {
          name: 'plugin-1',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: PLUGIN_1_ITEM,
              title: 'Plugin 1 Item',
              icon: 'plugin-1-icon',
              dataTestId: PLUGIN_1_ITEM,
              index: 0,
            },
          ]),
        },
        {
          name: 'plugin-2',
          isInstalled: true,
          getSidebarActions: jest.fn().mockReturnValue([
            {
              key: PLUGIN_2_ITEM,
              title: 'Plugin 2 Item',
              icon: 'plugin-2-icon',
              dataTestId: PLUGIN_2_ITEM,
            },
          ]),
        },
      ];

      const result = getSidebarItemsWithPlugins(mockPlugins);

      expect(result).toHaveLength(4);
      expect(result[0].key).toBe(PLUGIN_1_ITEM);
      expect(result[1].key).toBe('home');
      expect(result[2].key).toBe('explore');
      expect(result[3].key).toBe(PLUGIN_2_ITEM);
    });
  });
});
