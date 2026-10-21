/*
 *  Copyright 2025 Collate.
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

import { NavigationTreeNode } from '../interface/sidebar.interface';
import {
  getNavigationItems,
  moveNavigationItem,
} from './SettingsNavigationPageUtils';

describe('SettingsNavigationPageUtils', () => {
  describe('getNavigationItems', () => {
    it('should convert empty tree data to empty navigation items', () => {
      const treeData: NavigationTreeNode[] = [];
      const hiddenKeys: string[] = [];

      const result = getNavigationItems(treeData, hiddenKeys);

      expect(result).toEqual([]);
    });

    it('should convert single tree node to navigation item with correct hidden state', () => {
      const treeData: NavigationTreeNode[] = [
        {
          key: 'test-key',
          title: 'Test Title',
        },
      ];
      const hiddenKeys: string[] = ['test-key'];

      const result = getNavigationItems(treeData, hiddenKeys);

      expect(result).toEqual([
        {
          id: 'test-key',
          title: 'Test Title',
          isHidden: true,
          children: [],
        },
      ]);
    });

    it('should handle tree data with children and nested hidden states', () => {
      const treeData: NavigationTreeNode[] = [
        {
          key: 'parent-key',
          title: 'Parent Title',
          children: [
            {
              key: 'child-key',
              title: 'Child Title',
            },
          ],
        },
      ];
      const hiddenKeys: string[] = ['child-key'];

      const result = getNavigationItems(treeData, hiddenKeys);

      expect(result).toEqual([
        {
          id: 'parent-key',
          title: 'Parent Title',
          isHidden: false,
          children: [
            {
              id: 'child-key',
              title: 'Child Title',
              isHidden: true,
              children: [],
            },
          ],
        },
      ]);
    });

    it('should handle complex tree structure with multiple levels and mixed hidden states', () => {
      const treeData: NavigationTreeNode[] = [
        {
          key: 'root',
          title: 'Root',
          children: [
            {
              key: 'child1',
              title: 'Child 1',
            },
            {
              key: 'child2',
              title: 'Child 2',
              children: [
                {
                  key: 'grandchild',
                  title: 'Grandchild',
                },
              ],
            },
          ],
        },
      ];
      const hiddenKeys: string[] = ['child1', 'grandchild'];

      const result = getNavigationItems(treeData, hiddenKeys);

      expect(result).toEqual([
        {
          id: 'root',
          title: 'Root',
          isHidden: false,
          children: [
            {
              id: 'child1',
              title: 'Child 1',
              isHidden: true,
              children: [],
            },
            {
              id: 'child2',
              title: 'Child 2',
              isHidden: false,
              children: [
                {
                  id: 'grandchild',
                  title: 'Grandchild',
                  isHidden: true,
                  children: [],
                },
              ],
            },
          ],
        },
      ]);
    });
  });
});

describe('moveNavigationItem', () => {
  const nodes: NavigationTreeNode[] = [
    { key: 'a', title: 'A', children: [{ key: 'child', title: 'Child' }] },
    { key: 'b', title: 'B' },
    { key: 'c', title: 'C' },
  ];

  it('reorders siblings without changing the original hierarchy', () => {
    const moved = moveNavigationItem(nodes, 'a', 'b', 'after');

    expect(moved.map((node) => node.key)).toEqual(['b', 'a', 'c']);
    expect(moved[1].children?.[0].key).toBe('child');
    expect(nodes.map((node) => node.key)).toEqual(['a', 'b', 'c']);
  });

  it('moves a child into another parent and back to the root', () => {
    const moved = moveNavigationItem(nodes, 'child', 'b', 'on');

    expect(moved[0].children).toEqual([]);
    expect(moved[1].children?.[0].key).toBe('child');
    expect(
      moveNavigationItem(moved, 'child', undefined, 'after').map(
        (node) => node.key
      )
    ).toEqual(['a', 'b', 'c', 'child']);
  });

  it('rejects missing targets, self drops, and drops into descendants', () => {
    expect(moveNavigationItem(nodes, 'a', 'child', 'on')).toBe(nodes);
    expect(moveNavigationItem(nodes, 'a', 'a', 'before')).toBe(nodes);
    expect(moveNavigationItem(nodes, 'a', 'missing', 'on')).toBe(nodes);
  });
});
