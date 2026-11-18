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

import { getFirstLevelGlossaryTermsPaginated } from '../../../rest/glossaryAPI';
import { ModifiedGlossaryTerm } from './GlossaryTermTab.interface';
import {
  computeShowExpandTreeLoadMore,
  hasActiveSearchTerm,
  isStaleFetchResponse,
  mergeChildTermsIntoHierarchy,
  reconcileGlossaryTermHierarchy,
  resolveTotalTermsCount,
  shouldShowEmptyPlaceholder,
} from './GlossaryTermTab.utils';

jest.mock('../../../rest/glossaryAPI', () => ({
  getFirstLevelGlossaryTermsPaginated: jest.fn(),
}));

const mockGetFirstLevelGlossaryTermsPaginated =
  getFirstLevelGlossaryTermsPaginated as jest.Mock;

const makeTerm = (
  fqn: string,
  overrides: Partial<ModifiedGlossaryTerm> = {}
): ModifiedGlossaryTerm =>
  ({
    id: `id-${fqn}`,
    name: fqn,
    displayName: fqn,
    description: `Description for ${fqn}`,
    fullyQualifiedName: fqn,
    ...overrides,
  } as ModifiedGlossaryTerm);

describe('GlossaryTermTab.utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reconcileGlossaryTermHierarchy', () => {
    it('keeps both Parent and Parent.Child at root when expandedRowKeys is empty', () => {
      const parent = makeTerm('G.Parent', { childrenCount: 1 });
      const child = makeTerm('G.Parent.Child');

      const result = reconcileGlossaryTermHierarchy([parent, child], []);

      expect(result.map((t) => t.fullyQualifiedName)).toEqual([
        'G.Parent',
        'G.Parent.Child',
      ]);
    });

    it('suppresses root Parent.Child when Parent is expanded and contains Parent.Child', () => {
      const childInParent = makeTerm('G.Parent.Child');
      const siblingInParent = makeTerm('G.Parent.Sibling');
      const parent = makeTerm('G.Parent', {
        childrenCount: 2,
        children: [childInParent, siblingInParent],
      });
      const rootChild = makeTerm('G.Parent.Child');

      const result = reconcileGlossaryTermHierarchy(
        [parent, rootChild],
        ['G.Parent']
      );

      expect(result).toHaveLength(1);
      expect(result[0].fullyQualifiedName).toBe('G.Parent');
      expect(result[0].children?.map((c) => c.fullyQualifiedName)).toEqual([
        'G.Parent.Child',
        'G.Parent.Sibling',
      ]);
    });

    it('restores root Parent.Child when Parent is collapsed while search remains active', () => {
      const childInParent = makeTerm('G.Parent.Child');
      const siblingInParent = makeTerm('G.Parent.Sibling');
      const parent = makeTerm('G.Parent', {
        childrenCount: 2,
        children: [childInParent, siblingInParent],
      });
      const rootChild = makeTerm('G.Parent.Child');

      const expandedResult = reconcileGlossaryTermHierarchy(
        [parent, rootChild],
        ['G.Parent']
      );

      expect(expandedResult.map((t) => t.fullyQualifiedName)).toEqual([
        'G.Parent',
      ]);

      const collapsedResult = reconcileGlossaryTermHierarchy(
        [parent, rootChild],
        []
      );

      expect(collapsedResult.map((t) => t.fullyQualifiedName)).toEqual([
        'G.Parent',
        'G.Parent.Child',
      ]);
    });

    it('preserves loaded grandchildren and paging when Parent.Child was expanded before Parent', () => {
      const grandchild = makeTerm('G.Parent.Child.Grandchild');
      const rootChildExpandedFirst = makeTerm('G.Parent.Child', {
        childrenCount: 3,
        children: [grandchild],
        hasMoreChildren: true,
        childrenPagingAfter: 'cursor-grandchild-1',
      });
      const freshChildFromParentFetch = makeTerm('G.Parent.Child', {
        childrenCount: 3,
      });
      const parent = makeTerm('G.Parent', {
        childrenCount: 1,
        children: [freshChildFromParentFetch],
      });

      const result = reconcileGlossaryTermHierarchy(
        [parent, rootChildExpandedFirst],
        ['G.Parent.Child', 'G.Parent']
      );

      expect(result).toHaveLength(1);
      expect(result[0].fullyQualifiedName).toBe('G.Parent');

      const reconciledChild = result[0].children?.[0];

      expect(reconciledChild?.fullyQualifiedName).toBe('G.Parent.Child');
      expect(
        reconciledChild?.children?.map((c) => c.fullyQualifiedName)
      ).toEqual(['G.Parent.Child.Grandchild']);
      expect(reconciledChild?.hasMoreChildren).toBe(true);
      expect(reconciledChild?.childrenPagingAfter).toBe('cursor-grandchild-1');
      // Input objects must remain untouched (immutable update)
      expect(freshChildFromParentFetch.children).toBeUndefined();
    });

    it('handles 3-level flat search results [A, A.B, A.B.C] across partial and full expansion', () => {
      const nodeC = makeTerm('G.A.B.C');
      const nodeBWithChild = makeTerm('G.A.B', {
        childrenCount: 1,
        children: [nodeC],
      });
      const nodeBWithoutChild = makeTerm('G.A.B', {
        childrenCount: 1,
      });
      const nodeA = makeTerm('G.A', {
        childrenCount: 1,
        children: [nodeBWithoutChild],
      });

      // Expanding only A moves A.B under A while keeping A.B.C visible at root
      const onlyAExpanded = reconcileGlossaryTermHierarchy(
        [nodeA, nodeBWithChild, nodeC],
        ['G.A']
      );

      expect(onlyAExpanded.map((t) => t.fullyQualifiedName)).toEqual([
        'G.A',
        'G.A.B.C',
      ]);
      expect(onlyAExpanded[0].children?.[0].fullyQualifiedName).toBe('G.A.B');

      // Expanding both A and A.B suppresses A.B.C from root as well
      const bothExpanded = reconcileGlossaryTermHierarchy(
        [nodeA, nodeBWithChild, nodeC],
        ['G.A', 'G.A.B']
      );

      expect(bothExpanded.map((t) => t.fullyQualifiedName)).toEqual(['G.A']);
      expect(
        bothExpanded[0].children?.[0].children?.map((c) => c.fullyQualifiedName)
      ).toEqual(['G.A.B.C']);

      // If A is later collapsed while A.B stays in expandedRowKeys (and A.B was not a root match),
      // A.B.C must reappear at root rather than vanishing inside collapsed A
      const collapsedAWithOrphanExpandedB = reconcileGlossaryTermHierarchy(
        [
          makeTerm('G.A', {
            childrenCount: 1,
            children: [nodeBWithChild],
          }),
          nodeC,
        ],
        ['G.A.B']
      );

      expect(
        collapsedAWithOrphanExpandedB.map((t) => t.fullyQualifiedName)
      ).toEqual(['G.A', 'G.A.B.C']);
    });

    it('reconciles quoted and dotted FQN segments strictly by exact FQN identity', () => {
      const quotedParentFqn = '"G.1"."A.1"';
      const quotedChildFqn = '"G.1"."A.1"."DA.1"';
      const unrelatedSimilarFqn = '"G.1"."A"."1.DA.1"';

      const parent = makeTerm(quotedParentFqn, {
        childrenCount: 1,
        children: [makeTerm(quotedChildFqn)],
      });
      const rootChild = makeTerm(quotedChildFqn);
      const unrelated = makeTerm(unrelatedSimilarFqn);

      const result = reconcileGlossaryTermHierarchy(
        [parent, rootChild, unrelated],
        [quotedParentFqn]
      );

      expect(result.map((t) => t.fullyQualifiedName)).toEqual([
        quotedParentFqn,
        unrelatedSimilarFqn,
      ]);
      expect(result[0].children?.map((c) => c.fullyQualifiedName)).toEqual([
        quotedChildFqn,
      ]);
    });

    it('deduplicates duplicate siblings in children and handles cyclic references safely', () => {
      const dupChild1 = makeTerm('G.Parent.Dup');
      const dupChild2 = makeTerm('G.Parent.Dup');
      const cyclicNode = makeTerm('G.Cyclic', { childrenCount: 1 });
      cyclicNode.children = [cyclicNode];

      const mutualA = makeTerm('G.MutualA', { childrenCount: 1 });
      const mutualB = makeTerm('G.MutualB', { childrenCount: 1 });
      mutualA.children = [mutualB];
      mutualB.children = [mutualA];

      const parentWithDups = makeTerm('G.Parent', {
        childrenCount: 2,
        children: [dupChild1, dupChild2],
      });

      // The root search hit for G.Parent.Dup is what sends this page through
      // reconciliation; it is hidden while G.Parent is expanded.
      const result = reconcileGlossaryTermHierarchy(
        [parentWithDups, cyclicNode, mutualA, makeTerm('G.Parent.Dup')],
        ['G.Parent', 'G.Cyclic', 'G.MutualA', 'G.MutualB']
      );

      expect(result.map((t) => t.fullyQualifiedName)).toEqual([
        'G.Parent',
        'G.Cyclic',
        'G.MutualA',
      ]);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children?.[0].fullyQualifiedName).toBe('G.Parent.Dup');
      expect(result[1].children).toEqual([]);
      expect(result[2].children?.[0].fullyQualifiedName).toBe('G.MutualB');
      expect(result[2].children?.[0].children).toEqual([]);
    });

    it('preserves incomplete terms that lack fullyQualifiedName', () => {
      const incompleteOne = {
        id: 'incomplete-1',
        name: 'Incomplete 1',
      } as ModifiedGlossaryTerm;
      const incompleteTwo = {
        id: 'incomplete-2',
        name: 'Incomplete 2',
      } as ModifiedGlossaryTerm;

      const result = reconcileGlossaryTermHierarchy(
        [incompleteOne, incompleteTwo],
        []
      );

      expect(result).toHaveLength(2);
    });

    it('returns root terms untouched when no root sits under another root', () => {
      const parent = makeTerm('G.Parent', {
        childrenCount: 1,
        children: [makeTerm('G.Parent.Child')],
      });
      const other = makeTerm('G.Other');

      const result = reconcileGlossaryTermHierarchy(
        [parent, other, makeTerm('G.Other')],
        ['G.Parent']
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(parent);
      expect(result[1]).toBe(other);
    });

    it('returns an empty array when terms input is empty or non-array', () => {
      expect(reconcileGlossaryTermHierarchy([], ['G.Parent'])).toEqual([]);
      expect(
        reconcileGlossaryTermHierarchy(
          null as unknown as ModifiedGlossaryTerm[],
          []
        )
      ).toEqual([]);
    });

    it('adopts richer node exhausted paging state without retaining stale cursor from 1-page copy', () => {
      const sixtyChildren = Array.from({ length: 60 }, (_, idx) =>
        makeTerm(`G.Parent.Child.GC_${idx + 1}`)
      );
      const fiftyChildren = sixtyChildren.slice(0, 50);

      const twoPageRicherRootCopy = makeTerm('G.Parent.Child', {
        childrenCount: 60,
        children: sixtyChildren,
        hasMoreChildren: false,
        childrenPagingAfter: undefined,
      });
      const onePageStaleNestedCopy = makeTerm('G.Parent.Child', {
        childrenCount: 60,
        children: fiftyChildren,
        hasMoreChildren: true,
        childrenPagingAfter: 'cursor-50',
      });
      const parent = makeTerm('G.Parent', {
        childrenCount: 1,
        children: [onePageStaleNestedCopy],
      });

      const result = reconcileGlossaryTermHierarchy(
        [parent, twoPageRicherRootCopy],
        ['G.Parent', 'G.Parent.Child']
      );

      expect(result.map((t) => t.fullyQualifiedName)).toEqual(['G.Parent']);

      const hydratedChild = result[0].children?.[0];

      expect(hydratedChild?.children).toHaveLength(60);
      expect(hydratedChild?.hasMoreChildren).toBe(false);
      expect(hydratedChild?.childrenPagingAfter).toBeUndefined();
    });
  });

  describe('mergeChildTermsIntoHierarchy', () => {
    it('replaces or appends deduplicated children at any nesting depth', () => {
      const childOne = makeTerm('G.P.C1');
      const childTwo = makeTerm('G.P.C2');
      const grandchild = makeTerm('G.P.C1.GC1');
      const unrelated = makeTerm('G.Unrelated');
      const initialTree = [
        {
          ...makeTerm('G.P', {
            children: [childOne],
          }),
        },
        unrelated,
      ];

      const appended = mergeChildTermsIntoHierarchy(
        initialTree as never,
        'G.P',
        [childOne, childTwo] as never,
        'cursor-2',
        true
      );

      expect(appended[0].children?.map((c) => c.fullyQualifiedName)).toEqual([
        'G.P.C1',
        'G.P.C2',
      ]);
      expect((appended[0] as ModifiedGlossaryTerm).hasMoreChildren).toBe(true);
      expect((appended[0] as ModifiedGlossaryTerm).childrenPagingAfter).toBe(
        'cursor-2'
      );

      const nestedUpdated = mergeChildTermsIntoHierarchy(
        appended,
        'G.P.C1',
        [grandchild] as never,
        undefined,
        false
      );

      expect(
        (nestedUpdated[0].children?.[0] as ModifiedGlossaryTerm).children?.map(
          (c) => c.fullyQualifiedName
        )
      ).toEqual(['G.P.C1.GC1']);
      expect(
        (nestedUpdated[0].children?.[0] as ModifiedGlossaryTerm).hasMoreChildren
      ).toBe(false);
    });

    it('seeds append=true from richer duplicate in hierarchy when expanded parent copy had undefined children', () => {
      const pageOneGrandchild = makeTerm('G.Parent.Child.GC1');
      const pageTwoGrandchild = makeTerm('G.Parent.Child.GC2');
      const childUnderParent = makeTerm('G.Parent.Child', {
        childrenCount: 2,
        children: undefined,
      });
      const rootChildWithPageOne = makeTerm('G.Parent.Child', {
        childrenCount: 2,
        children: [pageOneGrandchild],
        hasMoreChildren: true,
        childrenPagingAfter: 'cursor-1',
      });
      const parent = makeTerm('G.Parent', {
        childrenCount: 1,
        children: [childUnderParent],
      });

      const merged = mergeChildTermsIntoHierarchy(
        [parent, rootChildWithPageOne] as never,
        'G.Parent.Child',
        [pageTwoGrandchild] as never,
        undefined,
        true
      );

      const updatedNestedChild = merged[0]
        .children?.[0] as ModifiedGlossaryTerm;
      const updatedRootChild = merged[1] as unknown as ModifiedGlossaryTerm;

      expect(
        updatedNestedChild.children?.map((c) => c.fullyQualifiedName)
      ).toEqual(['G.Parent.Child.GC1', 'G.Parent.Child.GC2']);
      expect(updatedNestedChild.hasMoreChildren).toBe(false);
      expect(updatedNestedChild.childrenPagingAfter).toBeUndefined();

      expect(
        updatedRootChild.children?.map((c) => c.fullyQualifiedName)
      ).toEqual(['G.Parent.Child.GC1', 'G.Parent.Child.GC2']);
      expect(updatedRootChild.hasMoreChildren).toBe(false);
      expect(updatedRootChild.childrenPagingAfter).toBeUndefined();
    });
  });

  describe('other pure helpers', () => {
    it('evaluates isStaleFetchResponse accurately', () => {
      expect(isStaleFetchResponse(null, 'a', 'a', 's', 's')).toBe(true);
      expect(isStaleFetchResponse('not-array', 'a', 'a', 's', 's')).toBe(true);
      expect(isStaleFetchResponse([], 'old', 'new', 's', 's')).toBe(true);
      expect(isStaleFetchResponse([], 'a', 'a', 'old', 'new')).toBe(true);
      expect(isStaleFetchResponse([], 'a', 'a', 's', 's')).toBe(false);
    });

    it('resolves total terms count with and without active status filters', async () => {
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        paging: { total: 12 },
      });

      await expect(resolveTotalTermsCount([], true, 0, 'G.Test')).resolves.toBe(
        12
      );
      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledWith(
        'G.Test',
        0
      );

      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({});

      await expect(resolveTotalTermsCount([], true, undefined)).resolves.toBe(
        0
      );

      await expect(
        resolveTotalTermsCount([{ id: '1' }], false, 7, 'G.Test')
      ).resolves.toBe(7);
      await expect(
        resolveTotalTermsCount([{ id: '1' }, { id: '2' }], false, undefined)
      ).resolves.toBe(2);
    });

    it('computes search, expand-tree load-more, and empty-placeholder flags', () => {
      expect(hasActiveSearchTerm('')).toBe(false);
      expect(hasActiveSearchTerm('   ')).toBe(false);
      expect(hasActiveSearchTerm('acme')).toBe(true);

      expect(computeShowExpandTreeLoadMore(true, 'cursor-1')).toBe(true);
      expect(computeShowExpandTreeLoadMore(true, undefined)).toBe(false);
      expect(computeShowExpandTreeLoadMore(false, 'cursor-1')).toBe(false);

      expect(shouldShowEmptyPlaceholder(true, false, 0, false)).toBe(true);
      expect(shouldShowEmptyPlaceholder(true, true, 0, false)).toBe(false);
      expect(shouldShowEmptyPlaceholder(true, false, 3, false)).toBe(false);
      expect(shouldShowEmptyPlaceholder(true, false, 0, true)).toBe(false);
      expect(shouldShowEmptyPlaceholder(false, false, 0, false)).toBe(false);
    });
  });
});
