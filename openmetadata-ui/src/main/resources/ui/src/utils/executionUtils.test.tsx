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

import { Task } from '../generated/entity/data/pipeline';
import { TreeNode } from '../interface/tree.interface';
import {
  buildCompleteTree,
  getTreeData,
  ViewDataInterface,
} from './executionUtils';

const makeTasks = (graph: Record<string, string[]>): Task[] =>
  Object.entries(graph).map(([name, downstream]) => ({
    name,
    downstreamTasks: downstream,
  }));

const labelElementsFor = (names: string[]) =>
  names.map((name) => ({ key: name, value: name }));

const collectTitles = (nodes: TreeNode[]): string[] =>
  nodes.flatMap((node) => {
    const self = node.title != null ? [String(node.title)] : [];

    return [...self, ...collectTitles(node.children ?? [])];
  });

const collectKeys = (nodes: TreeNode[]): string[] =>
  nodes.flatMap((node) => [
    String(node.key),
    ...collectKeys(node.children ?? []),
  ]);

const makeViewData = (names: string[]): Record<string, ViewDataInterface[]> =>
  names.reduce<Record<string, ViewDataInterface[]>>((acc, name, idx) => {
    acc[name] = [{ name, key: idx + 1 }];

    return acc;
  }, {});

describe('executionUtils', () => {
  describe('buildCompleteTree', () => {
    it('renders a simple acyclic chain end to end', () => {
      const tasks = makeTasks({ A: ['B'], B: ['C'], C: [] });
      const labels = labelElementsFor(['A', 'B', 'C']);

      const tree = buildCompleteTree(tasks, labels, null, 'A', 'root');

      expect(collectTitles([tree])).toEqual(['A', 'B', 'C']);
      expect(collectKeys([tree])).toEqual(['root-A', 'root-A-B', 'root-A-B-C']);
      expect(tree.children?.[0].children?.[0].children).toBeUndefined();
    });

    it('terminates on a cycle reachable from the root without overflowing the stack', () => {
      // A -> B -> C -> B  (B<->C cycle behind a real root A)
      const tasks = makeTasks({ A: ['B'], B: ['C'], C: ['B'] });
      const labels = labelElementsFor(['A', 'B', 'C']);

      const tree = buildCompleteTree(tasks, labels, null, 'A', 'root');

      // A -> B -> C -> B(leaf): every cycle member renders once, then stops
      expect(collectTitles([tree])).toEqual(['A', 'B', 'C', 'B']);
      expect(
        tree.children?.[0]?.children?.[0]?.children?.[0]?.children
      ).toBeUndefined();
    });

    it('terminates on a pure 2-task cycle (A<->B)', () => {
      const tasks = makeTasks({ A: ['B'], B: ['A'] });
      const labels = labelElementsFor(['A', 'B']);

      const tree = buildCompleteTree(tasks, labels, null, 'A', 'root');

      expect(collectTitles([tree])).toEqual(['A', 'B', 'A']);
      expect(tree.children?.[0]?.children?.[0]?.children).toBeUndefined();
    });

    it('terminates on a self-loop (A->A)', () => {
      const tasks = makeTasks({ A: ['A'] });
      const labels = labelElementsFor(['A']);

      const tree = buildCompleteTree(tasks, labels, null, 'A', 'root');

      expect(collectTitles([tree])).toEqual(['A', 'A']);
      expect(tree.children?.[0]?.children).toBeUndefined();
    });

    it('renders every node of a diamond graph without throwing', () => {
      const tasks = makeTasks({ A: ['B', 'D'], B: ['C'], D: ['C'], C: [] });
      const labels = labelElementsFor(['A', 'B', 'C', 'D']);

      const tree = buildCompleteTree(tasks, labels, null, 'A', 'root');

      expect(new Set(collectTitles([tree]))).toEqual(
        new Set(['A', 'B', 'C', 'D'])
      );
      expect(tree.children?.map((child) => child.title)).toEqual(['B', 'D']);
    });

    it('expands a shared task under every branch that reaches it (diamond with tail)', () => {
      // A -> [B, D], B -> C -> E, D -> C -> E.
      // C and E must appear under both the B and D branches, not just the
      // first one visited.
      const tasks = makeTasks({
        A: ['B', 'D'],
        B: ['C'],
        D: ['C'],
        C: ['E'],
        E: [],
      });
      const labels = labelElementsFor(['A', 'B', 'C', 'D', 'E']);

      const tree = buildCompleteTree(tasks, labels, null, 'A', 'root');

      const [bBranch, dBranch] = tree.children ?? [];

      expect(String(bBranch.title)).toBe('B');
      expect(String(dBranch.title)).toBe('D');
      // Both branches must expand C and its downstream E.
      expect(collectTitles([bBranch])).toEqual(['B', 'C', 'E']);
      expect(collectTitles([dBranch])).toEqual(['D', 'C', 'E']);
    });

    it('renders a dangling downstream reference as a leaf', () => {
      const tasks = makeTasks({ A: ['X'] }); // X is not present in tasks
      const labels = labelElementsFor(['A']);

      const tree = buildCompleteTree(tasks, labels, null, 'A', 'root');

      expect(collectKeys([tree])).toEqual(['root-A', 'root-A-X']);
      expect(tree.children?.[0]?.children).toBeUndefined();
    });

    it('starts from a fresh visited set on each top-level call', () => {
      // A shared/static visited set would wrongly prune the second root's
      // subtree; each top-level build must expand independently.
      const tasks = makeTasks({ A: ['B'], B: ['A'] });
      const labels = labelElementsFor(['A', 'B']);

      const first = buildCompleteTree(tasks, labels, null, 'A', 'root');
      const second = buildCompleteTree(tasks, labels, null, 'A', 'root');

      expect(collectTitles([first])).toEqual(['A', 'B', 'A']);
      expect(collectTitles([second])).toEqual(collectTitles([first]));
    });
  });

  describe('getTreeData', () => {
    it('selects tasks with no incoming edges as roots for an acyclic graph', () => {
      const tasks = makeTasks({
        A: ['B'],
        B: ['C'],
        C: [],
        D: ['E'],
        E: [],
      });
      const { treeDataList, treeLabelList } = getTreeData(
        tasks,
        makeViewData(['A', 'B', 'C', 'D', 'E'])
      );

      expect(treeLabelList.map((node) => String(node.title))).toEqual([
        'A',
        'D',
      ]);
      expect(treeDataList.map((node) => String(node.key))).toEqual([
        'root-A',
        'root-D',
      ]);
      expect(collectTitles(treeLabelList)).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('builds treeDataList and treeLabelList with matching key shape', () => {
      const tasks = makeTasks({ A: ['B'], B: ['C'], C: [] });
      const { treeDataList, treeLabelList } = getTreeData(
        tasks,
        makeViewData(['A', 'B', 'C'])
      );

      expect(collectKeys(treeDataList)).toEqual(collectKeys(treeLabelList));
      expect(collectTitles(treeLabelList)).toEqual(['A', 'B', 'C']);
    });

    it('falls back to all tasks as roots for a pure 2-task cycle instead of rendering an empty tree', () => {
      const tasks = makeTasks({ A: ['B'], B: ['A'] });
      const { treeLabelList, treeDataList } = getTreeData(
        tasks,
        makeViewData(['A', 'B'])
      );

      // Without the fallback, root detection yields [] and the tab is empty.
      expect(treeLabelList.length).toBeGreaterThan(0);
      expect(treeDataList.length).toBeGreaterThan(0);
      expect(new Set(collectTitles(treeLabelList))).toEqual(
        new Set(['A', 'B'])
      );
    });

    it('falls back to all tasks as roots for a self-loop', () => {
      const tasks = makeTasks({ A: ['A'] });
      const { treeLabelList } = getTreeData(tasks, makeViewData(['A']));

      expect(treeLabelList).toHaveLength(1);
      expect(collectTitles(treeLabelList)).toEqual(['A', 'A']);
    });

    it('renders a cycle reachable from a real root without crashing', () => {
      // A -> B -> C -> B  (root A, B<->C cycle)
      const tasks = makeTasks({ A: ['B'], B: ['C'], C: ['B'] });
      const { treeLabelList, treeDataList } = getTreeData(
        tasks,
        makeViewData(['A', 'B', 'C'])
      );

      expect(treeLabelList.map((node) => String(node.title))).toEqual(['A']);
      expect(collectTitles(treeLabelList)).toEqual(['A', 'B', 'C', 'B']);
      expect(collectKeys(treeDataList)).toEqual(collectKeys(treeLabelList));
    });

    it('renders a disconnected cycle alongside a separate acyclic component', () => {
      // A -> B is a normal acyclic component; C <-> D is a disconnected
      // cycle. Both components must be visible: A as the detected root and
      // C, D as unreached roots.
      const tasks = makeTasks({ A: ['B'], B: [], C: ['D'], D: ['C'] });
      const { treeLabelList, treeDataList } = getTreeData(
        tasks,
        makeViewData(['A', 'B', 'C', 'D'])
      );

      expect(treeLabelList.length).toBe(3);
      expect(treeLabelList.map((node) => String(node.title))).toEqual([
        'A',
        'C',
        'D',
      ]);
      // Every task shows up somewhere in the combined tree.
      expect(new Set(collectTitles(treeLabelList))).toEqual(
        new Set(['A', 'B', 'C', 'D'])
      );
      expect(collectKeys(treeDataList)).toEqual(collectKeys(treeLabelList));
    });

    it('returns empty lists for empty tasks', () => {
      const { treeDataList, treeLabelList } = getTreeData([], {});

      expect(treeDataList).toEqual([]);
      expect(treeLabelList).toEqual([]);
    });
  });
});
