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

  describe('toggleNodeSelection', () => {
    // The row renders checked through its child alone, so the click must clear it.
    it('clears a parent that reads as checked through a collapsed child', () => {
      const collapsed = glossary(1, []);
      const { result } = renderSelection([collapsed]);

      act(() => result.current.setSelection([term('t1', 'g')]));
      act(() => result.current.toggleNodeSelection(collapsed, undefined, true));

      expect(result.current.selectedData).toEqual([]);
    });

    // Selected while collapsed, the children live only on the hydrated node.
    it('clears children hydrated on the click, not just the tree', () => {
      const collapsed = glossary(2, []);
      const hydrated = glossary(2, [term('t1', 'g'), term('t2', 'g')]);
      const { result } = renderSelection([collapsed]);

      act(() => result.current.toggleNodeSelection(hydrated));

      expect(result.current.selectedData).toHaveLength(3);

      act(() => result.current.toggleNodeSelection(hydrated, undefined, true));

      expect(result.current.selectedData).toEqual([]);
    });

    it('still selects the whole branch when only some of it is selected', () => {
      const node = glossary(2, [term('t1', 'g'), term('t2', 'g')]);
      const { result } = renderSelection([node]);

      act(() => result.current.toggleNodeSelection(node.children![0]));
      act(() => result.current.toggleNodeSelection(node, undefined, false));

      expect(result.current.selectedData.map(({ id }) => id)).toEqual([
        't1',
        'g',
        't2',
      ]);
    });

    // Mutually-exclusive (radio) siblings can never be co-selected: picking one
    // clears the others under the same group parent. Select All mirrors this
    // invariant, so guard the per-row behavior it depends on.
    it('selecting a radio sibling deselects the others under its group parent', () => {
      const email = {
        ...term('pii.email', 'pii'),
        isParentMutuallyExclusive: true,
      };
      const ssn = {
        ...term('pii.ssn', 'pii'),
        isParentMutuallyExclusive: true,
      };
      const pii: TreeSelectNode = {
        id: 'pii',
        label: 'pii',
        value: 'pii',
        hasExclusiveChildren: true,
        children: [email, ssn],
      };
      const { result } = renderHook(() =>
        useTreeSelectSelection({ multiple: true, treeData: [pii] })
      );

      act(() => result.current.toggleNodeSelection(email, pii));
      expect(result.current.selectedData.map((n) => n.id)).toEqual([
        'pii.email',
      ]);

      act(() => result.current.toggleNodeSelection(ssn, pii));
      expect(result.current.selectedData.map((n) => n.id)).toEqual(['pii.ssn']);
    });

    // A derived/inherited label is seeded as `disabled` + `displayOnly`: row and
    // chip stay locked, but a sibling pick overrides it instead of freezing the
    // whole group, mirroring the backend's DERIVED-stripping exclusivity check.
    it('overrides a display-only locked radio sibling when a sibling is picked', () => {
      const email: TreeSelectNode = {
        id: 'pii.email',
        label: 'Email',
        value: 'pii.email',
        parentId: 'pii',
        isLeaf: true,
        isParentMutuallyExclusive: true,
      };
      const ssn: TreeSelectNode = {
        id: 'pii.ssn',
        label: 'SSN',
        value: 'pii.ssn',
        parentId: 'pii',
        isLeaf: true,
        isParentMutuallyExclusive: true,
      };
      const pii: TreeSelectNode = {
        id: 'pii',
        label: 'PII',
        value: 'pii',
        hasExclusiveChildren: true,
        children: [email, ssn],
      };
      const { result } = renderHook(() =>
        useTreeSelectSelection({ multiple: true, treeData: [pii] })
      );

      const inheritedEmail: TreeSelectNode = {
        ...email,
        disabled: true,
        displayOnly: true,
      };
      act(() => result.current.setSelection([inheritedEmail]));
      expect(result.current.selectedData.map((n) => n.id)).toEqual([
        'pii.email',
      ]);

      act(() => result.current.toggleNodeSelection(ssn, pii));

      // The display-only inherited sibling stays ticked next to the user's
      // pick: the backend strips DERIVED labels before enforcing mutual
      // exclusivity, so the draft must not drop a row Apply would keep.
      expect(result.current.selectedData.map((n) => n.id)).toEqual([
        'pii.email',
        'pii.ssn',
      ]);
    });

    it('overrides a display-only locked radio sibling even when its branch is unfetched', () => {
      // Search/pagination state: the inherited term's branch is not in the tree,
      // so the lock can only be visible through the seeded selection's own
      // `parentId` and `disabled` — both of which the picker seeds from `value`.
      const ssn: TreeSelectNode = {
        id: 'pii.ssn',
        label: 'SSN',
        value: 'pii.ssn',
        parentId: 'pii',
        isLeaf: true,
        isParentMutuallyExclusive: true,
      };
      const pii: TreeSelectNode = {
        id: 'pii',
        label: 'PII',
        value: 'pii',
        hasExclusiveChildren: true,
        children: [ssn],
      };
      const { result } = renderHook(() =>
        useTreeSelectSelection({ multiple: true, treeData: [pii] })
      );

      const inheritedEmail: TreeSelectNode = {
        id: 'pii.email',
        label: 'Email',
        value: 'pii.email',
        parentId: 'pii',
        isLeaf: true,
        isParentMutuallyExclusive: true,
        disabled: true,
        displayOnly: true,
      };
      act(() => result.current.setSelection([inheritedEmail]));

      act(() => result.current.toggleNodeSelection(ssn, pii));

      // The unfetched display-only inherited sibling stays in the selection.
      expect(result.current.selectedData.map((n) => n.id)).toEqual([
        'pii.email',
        'pii.ssn',
      ]);
    });

    // The relaxation is for display-only selections alone; a locked radio sibling
    // that is not display-only still freezes its mutually-exclusive group.
    it('keeps a non-display-only locked radio sibling blocking a sibling pick', () => {
      const emailLocked: TreeSelectNode = {
        id: 'pii.email',
        label: 'Email',
        value: 'pii.email',
        parentId: 'pii',
        isLeaf: true,
        isParentMutuallyExclusive: true,
        disabled: true,
      };
      const ssn: TreeSelectNode = {
        id: 'pii.ssn',
        label: 'SSN',
        value: 'pii.ssn',
        parentId: 'pii',
        isLeaf: true,
        isParentMutuallyExclusive: true,
      };
      const pii: TreeSelectNode = {
        id: 'pii',
        label: 'PII',
        value: 'pii',
        hasExclusiveChildren: true,
        children: [emailLocked, ssn],
      };
      const { result } = renderHook(() =>
        useTreeSelectSelection({ multiple: true, treeData: [pii] })
      );

      act(() => result.current.setSelection([{ ...emailLocked }]));
      expect(result.current.selectedData.map((n) => n.id)).toEqual([
        'pii.email',
      ]);

      act(() => result.current.toggleNodeSelection(ssn, pii));

      expect(result.current.selectedData.map((n) => n.id)).toEqual([
        'pii.email',
      ]);
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
