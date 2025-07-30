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

import { TreeDataNode } from 'antd';
import { getNavigationItems } from './SettingsNavigationPageUtils';

describe('SettingsNavigationPageUtils', () => {
  describe('getNavigationItems', () => {
    it('should convert empty tree data to empty navigation items', () => {
      const treeData: TreeDataNode[] = [];
      const hiddenKeys: string[] = [];

      const result = getNavigationItems(treeData, hiddenKeys);

      expect(result).toEqual([]);
    });

    it('should convert single tree node to navigation item with correct hidden state', () => {
      const treeData: TreeDataNode[] = [
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
      const treeData: TreeDataNode[] = [
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
      const treeData: TreeDataNode[] = [
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
