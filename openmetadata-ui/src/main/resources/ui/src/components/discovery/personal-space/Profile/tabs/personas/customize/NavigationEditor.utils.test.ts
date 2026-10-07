/*
 *  Copyright 2026 Collate.
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
import {
  getParentKeys,
  moveNavNode,
  moveNavNodeToRoot,
} from './NavigationEditor.utils';

const tree = (): TreeDataNode[] => [
  { key: 'a', title: 'a' },
  {
    key: 'b',
    title: 'b',
    children: [
      { key: 'b1', title: 'b1' },
      { key: 'b2', title: 'b2' },
    ],
  },
  { key: 'c', title: 'c' },
];

const keys = (nodes: TreeDataNode[]): string[] =>
  nodes.map((n) => String(n.key));

describe('NavigationEditor.utils', () => {
  describe('moveNavNode', () => {
    it('reorders siblings with "before"', () => {
      const result = moveNavNode(tree(), 'c', 'a', 'before');

      expect(keys(result)).toEqual(['c', 'a', 'b']);
    });

    it('reorders siblings with "after"', () => {
      const result = moveNavNode(tree(), 'a', 'c', 'after');

      expect(keys(result)).toEqual(['b', 'c', 'a']);
    });

    it('nests a node into a target with "on"', () => {
      const result = moveNavNode(tree(), 'a', 'b', 'on');

      expect(keys(result)).toEqual(['b', 'c']);
      expect(keys(result[0].children ?? [])).toEqual(['a', 'b1', 'b2']);
    });

    it('moves a nested node out to a root sibling', () => {
      const result = moveNavNode(tree(), 'b1', 'c', 'after');

      expect(keys(result)).toEqual(['a', 'b', 'c', 'b1']);
      expect(keys(result[1].children ?? [])).toEqual(['b2']);
    });

    it('returns the input unchanged when source equals target', () => {
      const input = tree();

      expect(moveNavNode(input, 'a', 'a', 'before')).toBe(input);
    });

    it('returns the input unchanged for an unknown target', () => {
      const input = tree();

      expect(moveNavNode(input, 'a', 'zzz', 'before')).toBe(input);
    });
  });

  describe('moveNavNodeToRoot', () => {
    it('appends a nested node to the root level', () => {
      const result = moveNavNodeToRoot(tree(), 'b1');

      expect(keys(result)).toEqual(['a', 'b', 'c', 'b1']);
      expect(keys(result[1].children ?? [])).toEqual(['b2']);
    });
  });

  describe('getParentKeys', () => {
    it('returns keys of nodes that have children', () => {
      expect(getParentKeys(tree())).toEqual(['b']);
    });
  });
});
