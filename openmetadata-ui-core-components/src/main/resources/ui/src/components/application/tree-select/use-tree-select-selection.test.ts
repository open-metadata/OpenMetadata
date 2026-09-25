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
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TreeSelectNode } from './tree-select.types';
import {
  getNodeSelectionState,
  useTreeSelectSelection,
} from './use-tree-select-selection';

const term = (id: string, parentId: string): TreeSelectNode => ({
  id,
  label: id,
  value: id,
  parentId,
  isLeaf: true,
});

// Its server-side count can exceed the terms in the tree, which is what pruning produces.
const glossary = (
  count: number,
  children: TreeSelectNode[]
): TreeSelectNode => ({
  id: 'g',
  label: 'g',
  value: 'g',
  count,
  children,
});

const renderSelection = (treeData: TreeSelectNode[]) =>
  renderHook(() =>
    useTreeSelectSelection({ multiple: true, cascadeSelection: true, treeData })
  );

describe('useTreeSelectSelection', () => {
  describe('getDescendantSelection', () => {
    it('reports a loaded branch as complete once its loaded terms are selected', () => {
      const node = glossary(2, [term('t1', 'g'), term('t2', 'g')]);
      const { result } = renderSelection([node]);

      act(() => result.current.toggleNodeSelection(node));

      expect(result.current.getDescendantSelection(node)).toEqual({
        selected: 2,
        total: 2,
        hasLoadedChildren: true,
      });
    });

    it('drops below complete when one term of a selected parent is unticked', () => {
      const children = [term('t1', 'g'), term('t2', 'g')];
      const node = glossary(2, children);
      const { result } = renderSelection([node]);

      act(() => result.current.toggleNodeSelection(node));
      act(() => result.current.toggleNodeSelection(children[0]));

      // The parent stays selected, so only the tally can demote the row.
      expect(result.current.isNodeSelected('g')).toBe(true);
      expect(result.current.getDescendantSelection(node)).toMatchObject({
        selected: 1,
        total: 2,
      });
    });

    it('counts pruned terms out of the total rather than trusting the badge', () => {
      // The badge says three; one was pruned, so both survivors must read as complete.
      const children = [term('t1', 'g'), term('t2', 'g')];
      const node = glossary(3, children);
      const { result } = renderSelection([node]);

      act(() => result.current.toggleNodeSelection(children[0]));
      act(() => result.current.toggleNodeSelection(children[1]));

      expect(result.current.getDescendantSelection(node)).toEqual({
        selected: 2,
        total: 2,
        hasLoadedChildren: true,
      });
    });

    it('defers to the badge count when the loaded children are a truncated page', () => {
      // Loaded < count here means the page was cut short, not that terms were
      // pruned, so completing the page must not complete the branch.
      const children = [term('t1', 'g'), term('t2', 'g')];
      const node = { ...glossary(200, children), hasMoreChildren: true };
      const { result } = renderSelection([node]);

      act(() => result.current.toggleNodeSelection(children[0]));
      act(() => result.current.toggleNodeSelection(children[1]));

      expect(result.current.getDescendantSelection(node)).toMatchObject({
        selected: 2,
        total: 200,
      });
      expect(
        getNodeSelectionState(
          result.current.getDescendantSelection(node),
          false
        )
      ).toEqual({ isFullySelected: false, isPartiallySelected: true });
    });

    it('falls back to the badge count while the branch is unexpanded', () => {
      const node = glossary(2, []);
      const { result } = renderSelection([node]);

      act(() =>
        result.current.setSelection([term('t1', 'g'), term('t2', 'g')])
      );

      // Nothing is loaded, so seeded parent ids and the badge are the only evidence.
      expect(result.current.getDescendantSelection(node)).toEqual({
        selected: 2,
        total: 2,
        hasLoadedChildren: false,
      });
    });
  });

  describe('getNodeSelectionState', () => {
    it('demotes a selected parent whose loaded terms are not all selected', () => {
      const state = getNodeSelectionState(
        { selected: 1, total: 2, hasLoadedChildren: true },
        true
      );

      expect(state).toEqual({
        isFullySelected: false,
        isPartiallySelected: true,
      });
    });

    it('checks a parent once every loaded term is selected', () => {
      const state = getNodeSelectionState(
        { selected: 2, total: 2, hasLoadedChildren: true },
        false
      );

      expect(state).toEqual({
        isFullySelected: true,
        isPartiallySelected: false,
      });
    });

    it('keeps an unexpanded parent checked on its own membership', () => {
      const state = getNodeSelectionState(
        { selected: 0, total: 2, hasLoadedChildren: false },
        true
      );

      expect(state).toEqual({
        isFullySelected: true,
        isPartiallySelected: false,
      });
    });

    it('marks an unexpanded parent partial from its seeded terms', () => {
      const state = getNodeSelectionState(
        { selected: 1, total: 2, hasLoadedChildren: false },
        false
      );

      expect(state).toEqual({
        isFullySelected: false,
        isPartiallySelected: true,
      });
    });

    it('uses its own membership for a leaf, which has no descendants', () => {
      const state = getNodeSelectionState(
        { selected: 0, total: 0, hasLoadedChildren: false },
        true
      );

      expect(state).toEqual({
        isFullySelected: true,
        isPartiallySelected: false,
      });
    });
  });
});
