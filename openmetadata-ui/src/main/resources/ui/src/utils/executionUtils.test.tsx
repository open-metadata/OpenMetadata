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

import { StatusType, Task } from '../generated/entity/data/pipeline';
import { TreeNode } from '../interface/tree.interface';
import { formatDuration } from './date-time/DateTimeUtils';
import {
  buildCompleteTree,
  getTableViewData,
  getTreeData,
  ViewDataInterface,
} from './executionUtils';

describe('getTableViewData', () => {
  it('carries task metrics and a safe log link into the view rows', () => {
    const rows = getTableViewData(
      [
        {
          timestamp: 1715404800000,
          executionStatus: StatusType.Successful,
          taskStatus: [
            {
              name: 'load_orders',
              executionStatus: StatusType.Successful,
              startTime: 1715404800000,
              endTime: 1715404802000,
              logLink: 'https://orchestrator.example/runs/1',
              metrics: {
                rowsRead: 1234,
                rowsWritten: 1200,
                rowsFiltered: 34,
                executionTimeMs: 1500,
              },
            },
            {
              name: 'notify',
              executionStatus: StatusType.Successful,
              logLink: 'javascript:alert(1)',
            },
          ],
        },
      ],
      StatusType.Successful,
      undefined
    );

    expect(rows).toHaveLength(2);
    expect(rows?.[0]).toMatchObject({
      name: 'load_orders',
      duration: formatDuration(2000),
      rowsRead: 1234,
      rowsWritten: 1200,
      logLink: 'https://orchestrator.example/runs/1',
    });
    expect(rows?.[1]).toMatchObject({ name: 'notify', duration: '--' });
    expect(rows?.[1].logLink).toBeUndefined();
  });

  it('falls back to the reported execution time only when start or end is missing', () => {
    const rows = getTableViewData(
      [
        {
          timestamp: 1715404800000,
          executionStatus: StatusType.Successful,
          taskStatus: [
            {
              name: 'with_wall_clock',
              executionStatus: StatusType.Successful,
              startTime: 1715404800000,
              endTime: 1715404802000,
              metrics: { executionTimeMs: 90000 },
            },
            {
              name: 'reported_only',
              executionStatus: StatusType.Successful,
              metrics: { executionTimeMs: 90000 },
            },
          ],
        },
      ],
      StatusType.Successful,
      undefined
    );

    expect(rows?.[0].duration).toBe(formatDuration(2000));
    expect(rows?.[1].duration).toBe(formatDuration(90000));
  });
});

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

    it('terminates on a cycle reachable from the root', () => {
      const tasks = makeTasks({ A: ['B'], B: ['C'], C: ['B'] });
      const labels = labelElementsFor(['A', 'B', 'C']);

      const tree = buildCompleteTree(tasks, labels, null, 'A', 'root');

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

    it('expands a shared task once and shows the repeat as a row', () => {
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

      expect(collectTitles([bBranch])).toEqual(['B', 'C', 'E']);
      expect(collectTitles([dBranch])).toEqual(['D', 'C']);
      expect(dBranch.children?.[0]?.children).toBeUndefined();
    });

    it('renders a dangling downstream reference as a leaf', () => {
      const tasks = makeTasks({ A: ['X'] });
      const labels = labelElementsFor(['A']);

      const tree = buildCompleteTree(tasks, labels, null, 'A', 'root');

      expect(collectKeys([tree])).toEqual(['root-A', 'root-A-X']);
      expect(tree.children?.[0]?.children).toBeUndefined();
    });

    it('starts from a fresh expanded set on each top-level call', () => {
      const tasks = makeTasks({ A: ['B'], B: ['A'] });
      const labels = labelElementsFor(['A', 'B']);

      const first = buildCompleteTree(tasks, labels, null, 'A', 'root');
      const second = buildCompleteTree(tasks, labels, null, 'A', 'root');

      expect(collectTitles([first])).toEqual(['A', 'B', 'A']);
      expect(collectTitles([second])).toEqual(collectTitles([first]));
    });

    it('draws one row per edge for a fully connected graph instead of one per path', () => {
      const tasks = makeTasks(makeCompleteGraph(ALL_TO_ALL));
      const labels = labelElementsFor(ALL_TO_ALL);

      const tree = buildCompleteTree(tasks, labels, null, 'P1', 'root');
      const edgeCount = ALL_TO_ALL.length * (ALL_TO_ALL.length - 1);

      expect(collectKeys([tree])).toHaveLength(1 + edgeCount);
      expect(new Set(collectTitles([tree]))).toEqual(new Set(ALL_TO_ALL));
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

    it('renders a pure 2-task cycle instead of an empty tree', () => {
      const tasks = makeTasks({ A: ['B'], B: ['A'] });
      const { treeLabelList, treeDataList } = getTreeData(
        tasks,
        makeViewData(['A', 'B'])
      );

      expect(treeLabelList.map((node) => String(node.title))).toEqual(['A']);
      expect(collectTitles(treeLabelList)).toEqual(['A', 'B', 'A']);
      expect(collectKeys(treeDataList)).toEqual(collectKeys(treeLabelList));
    });

    it('renders a self-loop', () => {
      const tasks = makeTasks({ A: ['A'] });
      const { treeLabelList } = getTreeData(tasks, makeViewData(['A']));

      expect(treeLabelList).toHaveLength(1);
      expect(collectTitles(treeLabelList)).toEqual(['A', 'A']);
    });

    it('renders a cycle reachable from a real root', () => {
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
      expect(collectTitles(treeLabelList)).toEqual(['A', 'B', 'C', 'D', 'C']);
      expect(collectKeys(treeDataList)).toEqual(collectKeys(treeLabelList));
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

    it('renders a fully connected pipeline completely in one tree', () => {
      const { treeDataList, treeLabelList } = getTreeData(
        makeTasks(makeCompleteGraph(ALL_TO_ALL)),
        makeViewData(ALL_TO_ALL)
      );
      const edgeCount = ALL_TO_ALL.length * (ALL_TO_ALL.length - 1);

      expect(treeLabelList).toHaveLength(1);
      expect(collectKeys(treeLabelList)).toHaveLength(1 + edgeCount);
      expect(new Set(collectTitles(treeLabelList))).toEqual(
        new Set(ALL_TO_ALL)
      );
      expect(collectKeys(treeDataList)).toEqual(collectKeys(treeLabelList));
    });

    it('keeps every task and its downstream when a root also enters a dense loop', () => {
      const graph = {
        ...makeCompleteGraph(ALL_TO_ALL),
        R: ['P1', 'Z'],
        Z: ['Y'],
        Y: [],
      };
      const names = Object.keys(graph);
      const { treeDataList, treeLabelList } = getTreeData(
        makeTasks(graph),
        makeViewData(names)
      );
      const zNode = treeLabelList[0].children?.find(
        (child) => String(child.title) === 'Z'
      );

      expect(treeLabelList.map((node) => String(node.title))).toEqual(['R']);
      expect(new Set(collectTitles(treeLabelList))).toEqual(new Set(names));
      expect(collectTitles([zNode as TreeNode])).toEqual(['Z', 'Y']);
      expect(collectKeys(treeDataList)).toEqual(collectKeys(treeLabelList));
    });

    it('keeps the subtree of a later root that reaches no shared task', () => {
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

      expect(treeLabelList.map((node) => String(node.title))).toEqual([
        'R1',
        'R2',
      ]);
      expect(collectTitles([treeLabelList[1]])).toEqual(['R2', 'X', 'Y']);
      expect(new Set(collectTitles(treeLabelList))).toEqual(new Set(names));
      expect(collectKeys(treeDataList)).toEqual(collectKeys(treeLabelList));
    });

    it('collapses duplicate downstream entries so tree keys stay unique', () => {
      const { treeLabelList } = getTreeData(
        makeTasks({ A: ['B', 'B'], B: [] }),
        makeViewData(['A', 'B'])
      );

      expect(collectKeys(treeLabelList)).toEqual(['root-A', 'root-A-B']);
    });

    it('returns empty lists for empty tasks', () => {
      const { treeDataList, treeLabelList } = getTreeData([], {});

      expect(treeDataList).toEqual([]);
      expect(treeLabelList).toEqual([]);
    });
  });
});
