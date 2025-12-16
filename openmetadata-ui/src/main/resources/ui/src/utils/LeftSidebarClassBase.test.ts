/*
 *  Copyright 2023 Collate.
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

import { ReactComponent as ExploreIcon } from '../assets/svg/explore.svg';
import { ReactComponent as HomeIcon } from '../assets/svg/ic-home.svg';
import { LeftSidebarItem } from '../components/MyData/LeftSidebar/LeftSidebar.interface';
import { SIDEBAR_LIST } from '../constants/LeftSidebar.constants';
import leftSidebarClassBase, {
  LeftSidebarClassBase,
} from './LeftSidebarClassBase';

jest.mock('../constants/LeftSidebar.constants', () => ({
  SIDEBAR_LIST: [
    {
      key: '/my-data',
      title: 'label.home',
      redirect_url: '/my-data',
      icon: 'HomeIcon',
      dataTestId: 'app-bar-item-home',
    },
    {
      key: '/explore',
      title: 'label.explore',
      redirect_url: '/explore',
      icon: 'ExploreIcon',
      dataTestId: 'app-bar-item-explore',
    },
    {
      key: 'governance',
      title: 'label.govern',
      icon: 'GovernIcon',
      dataTestId: 'governance',
      children: [
        {
          key: '/glossary',
          title: 'label.glossary',
          redirect_url: '/glossary',
          icon: 'GlossaryIcon',
          dataTestId: 'app-bar-item-glossary',
        },
      ],
    },
  ],
}));

describe('LeftSidebarClassBase', () => {
  describe('Class Instance Tests', () => {
    let instance: LeftSidebarClassBase;

    beforeEach(() => {
      instance = new LeftSidebarClassBase();
    });

    it('should create an instance of LeftSidebarClassBase', () => {
      expect(instance).toBeInstanceOf(LeftSidebarClassBase);
    });

    it('should initialize with SIDEBAR_LIST from constants', () => {
      const items = instance.getSidebarItems();

      expect(items).toEqual(SIDEBAR_LIST);
      expect(items).toHaveLength(3);
    });

    describe('getSidebarItems', () => {
      it('should return the current sidebar items', () => {
        const items = instance.getSidebarItems();

        expect(items).toBeDefined();
        expect(Array.isArray(items)).toBe(true);
        expect(items).toEqual(SIDEBAR_LIST);
      });

      it('should return the same reference when called multiple times', () => {
        const items1 = instance.getSidebarItems();
        const items2 = instance.getSidebarItems();

        expect(items1).toBe(items2);
      });
    });

    describe('setSidebarItems', () => {
      it('should update sidebar items with new items', () => {
        const newItems: LeftSidebarItem[] = [
          {
            key: '/custom',
            title: 'label.custom',
            redirect_url: '/custom',
            icon: HomeIcon,
            dataTestId: 'app-bar-item-custom',
          },
        ];

        instance.setSidebarItems(newItems);
        const items = instance.getSidebarItems();

        expect(items).toEqual(newItems);
        expect(items).toHaveLength(1);
      });

      it('should handle empty array', () => {
        instance.setSidebarItems([]);
        const items = instance.getSidebarItems();

        expect(items).toEqual([]);
        expect(items).toHaveLength(0);
      });

      it('should handle items with children', () => {
        const itemsWithChildren: LeftSidebarItem[] = [
          {
            key: 'parent',
            title: 'Parent Item',
            icon: HomeIcon,
            dataTestId: 'parent-item',
            children: [
              {
                key: '/child1',
                title: 'Child 1',
                redirect_url: '/child1',
                icon: ExploreIcon,
                dataTestId: 'child-1',
              },
              {
                key: '/child2',
                title: 'Child 2',
                redirect_url: '/child2',
                icon: ExploreIcon,
                dataTestId: 'child-2',
              },
            ],
          },
        ];

        instance.setSidebarItems(itemsWithChildren);
        const items = instance.getSidebarItems();

        expect(items).toEqual(itemsWithChildren);
        expect(items[0].children).toHaveLength(2);
      });

      it('should replace existing items completely', () => {
        const initialItems = instance.getSidebarItems();

        expect(initialItems).toHaveLength(3);

        const newItems: LeftSidebarItem[] = [
          {
            key: '/new-item',
            title: 'New Item',
            redirect_url: '/new-item',
            icon: HomeIcon,
            dataTestId: 'new-item',
          },
        ];

        instance.setSidebarItems(newItems);
        const updatedItems = instance.getSidebarItems();

        expect(updatedItems).toHaveLength(1);
        expect(updatedItems[0].key).toBe('/new-item');
      });
    });

    describe('Multiple operations', () => {
      it('should allow multiple set and get operations', () => {
        const firstSet: LeftSidebarItem[] = [
          {
            key: '/first',
            title: 'First',
            redirect_url: '/first',
            icon: HomeIcon,
            dataTestId: 'first',
          },
        ];

        const secondSet: LeftSidebarItem[] = [
          {
            key: '/second',
            title: 'Second',
            redirect_url: '/second',
            icon: ExploreIcon,
            dataTestId: 'second',
          },
          {
            key: '/third',
            title: 'Third',
            redirect_url: '/third',
            icon: HomeIcon,
            dataTestId: 'third',
          },
        ];

        instance.setSidebarItems(firstSet);

        expect(instance.getSidebarItems()).toEqual(firstSet);

        instance.setSidebarItems(secondSet);

        expect(instance.getSidebarItems()).toEqual(secondSet);
        expect(instance.getSidebarItems()).toHaveLength(2);
      });
    });
  });

  describe('Singleton Instance Tests', () => {
    it('should export a singleton instance as default', () => {
      expect(leftSidebarClassBase).toBeInstanceOf(LeftSidebarClassBase);
    });

    it('should have SIDEBAR_LIST items by default in singleton', () => {
      const items = leftSidebarClassBase.getSidebarItems();

      expect(items).toEqual(SIDEBAR_LIST);
    });

    it('should maintain state across imports in singleton', () => {
      const customItems: LeftSidebarItem[] = [
        {
          key: '/singleton-test',
          title: 'Singleton Test',
          redirect_url: '/singleton-test',
          icon: HomeIcon,
          dataTestId: 'singleton-test',
        },
      ];

      leftSidebarClassBase.setSidebarItems(customItems);

      expect(leftSidebarClassBase.getSidebarItems()).toEqual(customItems);

      leftSidebarClassBase.setSidebarItems(SIDEBAR_LIST);
    });

    it('should be different from a new instance', () => {
      const newInstance = new LeftSidebarClassBase();

      expect(leftSidebarClassBase).not.toBe(newInstance);
    });
  });

  describe('Edge Cases', () => {
    let instance: LeftSidebarClassBase;

    beforeEach(() => {
      instance = new LeftSidebarClassBase();
    });

    it('should handle items without redirect_url', () => {
      const itemsWithoutUrl: LeftSidebarItem[] = [
        {
          key: 'no-url',
          title: 'No URL Item',
          icon: HomeIcon,
          dataTestId: 'no-url',
        },
      ];

      instance.setSidebarItems(itemsWithoutUrl);
      const items = instance.getSidebarItems();

      expect(items[0].redirect_url).toBeUndefined();
    });

    it('should handle items without icon', () => {
      const itemsWithoutIcon: LeftSidebarItem[] = [
        {
          key: '/no-icon',
          title: 'No Icon Item',
          redirect_url: '/no-icon',
          dataTestId: 'no-icon',
        } as LeftSidebarItem,
      ];

      instance.setSidebarItems(itemsWithoutIcon);
      const items = instance.getSidebarItems();

      expect(items[0].icon).toBeUndefined();
    });

    it('should handle deeply nested children', () => {
      const deeplyNested: LeftSidebarItem[] = [
        {
          key: 'level1',
          title: 'Level 1',
          icon: HomeIcon,
          dataTestId: 'level1',
          children: [
            {
              key: 'level2',
              title: 'Level 2',
              icon: ExploreIcon,
              dataTestId: 'level2',
              children: [
                {
                  key: '/level3',
                  title: 'Level 3',
                  redirect_url: '/level3',
                  icon: HomeIcon,
                  dataTestId: 'level3',
                },
              ],
            },
          ],
        },
      ];

      instance.setSidebarItems(deeplyNested);
      const items = instance.getSidebarItems();

      expect(items[0].children?.[0].children?.[0].key).toBe('/level3');
    });
  });
});
