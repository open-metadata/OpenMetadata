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
  createTreeBuildState,
  getTreeData,
  MAX_TREE_NODES,
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

const makeCompleteGraph = (names: string[]): Record<string, string[]> =>
  Object.fromEntries(
    names.map((name) => [name, names.filter((other) => other !== name)])
  );

const ALL_TO_ALL = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];

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

    it('bounds total expansion for a branching cycle so Tree View cannot freeze', () => {
      // A complete graph of 8 tasks where each lists the other 7 as
      // downstream. Every permutation is a valid path (no node repeats on a
      // path), so without a total node bound this would produce ~8! nodes
      // per root. The budget must cap the expansion well below that.
      const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const graph: Record<string, string[]> = {};
      for (const name of names) {
        graph[name] = names.filter((other) => other !== name);
      }
      const tasks = makeTasks(graph);
      const labels = labelElementsFor(names);

      const tree = buildCompleteTree(tasks, labels, null, 'A', 'root');

      const totalNodes = collectKeys([tree]).length;

      // Renders something (the root and at least its first children), but
      // never millions of nodes — the recursive expansion is bounded by
      // MAX_TREE_NODES. Leaf preservation for tasks that fall outside the
      // budget can add at most O(tasks × fan-out) extra leaf nodes on top,
      // which stays tiny for real graphs.
      expect(totalNodes).toBeGreaterThan(0);
      expect(totalNodes).toBeLessThanOrEqual(
        MAX_TREE_NODES + names.length * names.length
      );
    });

    it('preserves later siblings as leaves when the node budget is exhausted', () => {
      // A root that points first into a chain (which spends the budget)
      // and then to a separate task Z. Z must still appear as a leaf
      // even when the budget runs out while expanding the chain, instead
      // of being silently dropped by a break.
      const tasks = makeTasks({
        A: ['B', 'Z'],
        B: ['C'],
        C: ['D'],
        D: [],
        Z: [],
      });
      const labels = labelElementsFor(['A', 'B', 'C', 'D', 'Z']);

      // Budget of 3: A (1), B (2), C (3). D and Z would exceed the budget.
      const tree = buildCompleteTree(
        tasks,
        labels,
        null,
        'A',
        'root',
        createTreeBuildState(3)
      );

      // Every task appears at least once; no task is silently dropped.
      expect(new Set(collectTitles([tree]))).toEqual(
        new Set(['A', 'B', 'C', 'D', 'Z'])
      );

      // Z is a direct child of A and must be present as a leaf.
      const rootChildren = tree.children ?? [];

      expect(rootChildren.some((child) => String(child.title) === 'Z')).toBe(
        true
      );

      // D is a child of C and must be present as a leaf even though C's
      // expansion was stopped by the budget.
      const bNode = rootChildren.find((child) => String(child.title) === 'B');
      const cNode = bNode?.children?.[0];

      expect(String(cNode?.title)).toBe('C');
      expect(
        cNode?.children?.some((child) => String(child.title) === 'D')
      ).toBe(true);
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
      const { treeDataList, treeLabelList, isTruncated } = getTreeData(
        tasks,
        makeViewData(['A', 'B', 'C', 'D', 'E'])
      );

      expect(isTruncated).toBe(false);
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
      const tasks = makeTasks({ A: ['B'], B: [], C: ['D'], D: ['C'] });
      const { treeLabelList, treeDataList } = getTreeData(
        tasks,
        makeViewData(['A', 'B', 'C', 'D'])
      );

      expect(treeLabelList.map((node) => String(node.title))).toEqual([
        'A',
        'C',
      ]);
      expect(new Set(collectTitles(treeLabelList))).toEqual(
        new Set(['A', 'B', 'C', 'D'])
      );
      expect(collectKeys(treeDataList)).toEqual(collectKeys(treeLabelList));
    });

    it('bounds the node count across all roots of a pure branching cycle', () => {
      const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const graph: Record<string, string[]> = {};
      for (const name of names) {
        graph[name] = names.filter((other) => other !== name);
      }
      const { treeDataList, treeLabelList, isTruncated } = getTreeData(
        makeTasks(graph),
        makeViewData(names)
      );

      expect(treeLabelList).toHaveLength(1);
      expect(isTruncated).toBe(true);

      const labelKeys = collectKeys(treeLabelList);

      expect(labelKeys.length).toBeLessThanOrEqual(
        MAX_TREE_NODES + 2 * names.length * names.length
      );
      expect(collectKeys(treeDataList)).toEqual(labelKeys);
    });

    it('draws a disconnected ring once instead of once per member', () => {
      const tasks = makeTasks({ A: ['B'], B: ['C'], C: ['A'] });
      const { treeLabelList } = getTreeData(
        tasks,
        makeViewData(['A', 'B', 'C'])
      );

      expect(treeLabelList.map((node) => String(node.title))).toEqual(['A']);
      expect(collectTitles(treeLabelList)).toEqual(['A', 'B', 'C', 'A']);
    });

    it('keeps a task whose parent became a budget leaf', () => {
      const graph = {
        ...makeCompleteGraph(ALL_TO_ALL),
        R: ['P1', 'Z'],
        Z: ['Y'],
        Y: [],
      };
      const names = Object.keys(graph);
      const { treeDataList, treeLabelList, isTruncated } = getTreeData(
        makeTasks(graph),
        makeViewData(names)
      );

      expect(isTruncated).toBe(true);
      expect(new Set(collectTitles(treeLabelList))).toEqual(new Set(names));
      expect(collectKeys(treeDataList)).toEqual(collectKeys(treeLabelList));
    });

    it('keeps the subtree of a later root after an earlier root spends the budget', () => {
      const graph = {
        R1: ['P1'],
        ...makeCompleteGraph(ALL_TO_ALL),
        R2: ['X'],
        X: ['Y'],
        Y: [],
      };
      const names = Object.keys(graph);
      const { treeDataList, treeLabelList } = getTreeData(
        makeTasks(graph),
        makeViewData(names)
      );

      expect(new Set(collectTitles(treeLabelList))).toEqual(new Set(names));
      expect(collectKeys(treeDataList)).toEqual(collectKeys(treeLabelList));
    });

    it('collapses duplicate downstream entries so tree keys stay unique', () => {
      const { treeLabelList } = getTreeData(
        makeTasks({ A: ['B', 'B'], B: [] }),
        makeViewData(['A', 'B'])
      );
      const keys = collectKeys(treeLabelList);

      expect(keys).toEqual(['root-A', 'root-A-B']);
    });

    it('returns empty lists for empty tasks', () => {
      const { treeDataList, treeLabelList } = getTreeData([], {});

      expect(treeDataList).toEqual([]);
      expect(treeLabelList).toEqual([]);
    });
  });
});
