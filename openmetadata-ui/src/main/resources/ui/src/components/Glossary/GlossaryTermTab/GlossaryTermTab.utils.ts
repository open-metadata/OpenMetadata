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

import { uniqBy } from 'lodash';
import {
  getFirstLevelGlossaryTermsPaginated,
  GlossaryTermWithChildren,
} from '../../../rest/glossaryAPI';
import { ModifiedGlossary } from '../useGlossary.store';
import { ModifiedGlossaryTerm } from './GlossaryTermTab.interface';

interface HierarchyHydrationContext {
  expandedSet: Set<string>;
  richerByFqn: Map<string, ModifiedGlossaryTerm>;
  visibleDescendantFqns: Set<string>;
}

const getLoadedChildCount = (term?: ModifiedGlossaryTerm): number =>
  term?.children?.length ?? 0;

const hasRicherChildState = (
  candidate: ModifiedGlossaryTerm,
  existing?: ModifiedGlossaryTerm
): boolean => getLoadedChildCount(candidate) > getLoadedChildCount(existing);

const collectRicherNodesByFqn = (
  terms: ModifiedGlossaryTerm[]
): Map<string, ModifiedGlossaryTerm> => {
  const richerByFqn = new Map<string, ModifiedGlossaryTerm>();
  const visitedRefs = new Set<ModifiedGlossaryTerm>();

  const visitNode = (node: ModifiedGlossaryTerm) => {
    if (visitedRefs.has(node)) {
      return;
    }
    visitedRefs.add(node);

    const fqn = node.fullyQualifiedName;
    if (fqn && hasRicherChildState(node, richerByFqn.get(fqn))) {
      richerByFqn.set(fqn, node);
    }

    node.children?.forEach(visitNode);
  };

  terms.forEach(visitNode);

  return richerByFqn;
};

const mergeCachedChildState = (
  node: ModifiedGlossaryTerm,
  richerByFqn: Map<string, ModifiedGlossaryTerm>
): ModifiedGlossaryTerm => {
  const fqn = node.fullyQualifiedName;
  const richer = fqn ? richerByFqn.get(fqn) : undefined;

  if (
    !richer ||
    richer === node ||
    getLoadedChildCount(richer) <= getLoadedChildCount(node)
  ) {
    return node;
  }

  return {
    ...node,
    children: richer.children,
    hasMoreChildren: richer.hasMoreChildren,
    childrenPagingAfter: richer.childrenPagingAfter,
  };
};

const isCyclicChild = (
  child: ModifiedGlossaryTerm,
  ancestorFqns: Set<string>,
  ancestorRefs: Set<ModifiedGlossaryTerm>
): boolean => {
  const childFqn = child.fullyQualifiedName;

  return (
    ancestorRefs.has(child) || Boolean(childFqn && ancestorFqns.has(childFqn))
  );
};

const shouldSkipChild = (
  child: ModifiedGlossaryTerm,
  seenSiblingFqns: Set<string>,
  ancestorFqns: Set<string>,
  ancestorRefs: Set<ModifiedGlossaryTerm>
): boolean => {
  if (isCyclicChild(child, ancestorFqns, ancestorRefs)) {
    return true;
  }

  const childFqn = child.fullyQualifiedName;
  if (!childFqn) {
    return false;
  }

  if (seenSiblingFqns.has(childFqn)) {
    return true;
  }
  seenSiblingFqns.add(childFqn);

  return false;
};

const hydrateChildrenList = (
  children: ModifiedGlossaryTerm[],
  areChildrenVisible: boolean,
  nextAncestorFqns: Set<string>,
  nextAncestorRefs: Set<ModifiedGlossaryTerm>,
  ctx: HierarchyHydrationContext,
  hydrateChild: (
    child: ModifiedGlossaryTerm,
    isVisible: boolean
  ) => ModifiedGlossaryTerm
): ModifiedGlossaryTerm[] => {
  const seenSiblingFqns = new Set<string>();
  const nextChildren: ModifiedGlossaryTerm[] = [];

  for (const child of children) {
    if (
      shouldSkipChild(
        child,
        seenSiblingFqns,
        nextAncestorFqns,
        nextAncestorRefs
      )
    ) {
      continue;
    }

    if (areChildrenVisible && child.fullyQualifiedName) {
      ctx.visibleDescendantFqns.add(child.fullyQualifiedName);
    }

    nextChildren.push(hydrateChild(child, areChildrenVisible));
  }

  return nextChildren;
};

const hydrateTermSubtree = (
  rawNode: ModifiedGlossaryTerm,
  isNodeVisibleAtCurrentLevel: boolean,
  ancestorFqns: Set<string>,
  ancestorRefs: Set<ModifiedGlossaryTerm>,
  ctx: HierarchyHydrationContext
): ModifiedGlossaryTerm => {
  const node = mergeCachedChildState(rawNode, ctx.richerByFqn);
  if (!node.children?.length) {
    return node;
  }

  const nodeFqn = node.fullyQualifiedName;
  const nextAncestorFqns = new Set(ancestorFqns);
  if (nodeFqn) {
    nextAncestorFqns.add(nodeFqn);
  }
  const nextAncestorRefs = new Set(ancestorRefs);
  nextAncestorRefs.add(node);

  const areChildrenVisible =
    isNodeVisibleAtCurrentLevel &&
    Boolean(nodeFqn && ctx.expandedSet.has(nodeFqn));

  return {
    ...node,
    children: hydrateChildrenList(
      node.children,
      areChildrenVisible,
      nextAncestorFqns,
      nextAncestorRefs,
      ctx,
      (child, isVisible) =>
        hydrateTermSubtree(
          child,
          isVisible,
          nextAncestorFqns,
          nextAncestorRefs,
          ctx
        )
    ),
  };
};

// A child's FQN is always its parent's FQN + '.' + name, so checking every
// '.'-bounded prefix finds a root ancestor. Prefixes that cut inside a quoted
// segment never match a real FQN, so they are harmless lookups.
const hasRootDescendantOfAnotherRoot = (
  terms: ModifiedGlossaryTerm[]
): boolean => {
  const rootFqns = new Set(
    terms.map((term) => term.fullyQualifiedName).filter(Boolean)
  );

  return terms.some(({ fullyQualifiedName: fqn }) => {
    if (!fqn) {
      return false;
    }
    for (let i = fqn.indexOf('.'); i !== -1; i = fqn.indexOf('.', i + 1)) {
      if (rootFqns.has(fqn.slice(0, i))) {
        return true;
      }
    }

    return false;
  });
};

// Reconciles flat search matches with expanded ancestor subtrees so a term
// rendered under an expanded ancestor is suppressed at root while expanded,
// carries over any already-loaded grandchildren, and reappears at root if
// its ancestor is collapsed again.
export const reconcileGlossaryTermHierarchy = (
  terms: ModifiedGlossaryTerm[],
  expandedRowKeys: string[]
): ModifiedGlossaryTerm[] => {
  if (!Array.isArray(terms) || terms.length === 0) {
    return [];
  }

  // Only a flat search page can list a term at root and under an ancestor;
  // otherwise skip the tree copy so row identities survive expand/collapse.
  if (!hasRootDescendantOfAnotherRoot(terms)) {
    const seenFqns = new Set<string>();

    return terms.filter(({ fullyQualifiedName: fqn }) => {
      if (!fqn) {
        return true;
      }
      if (seenFqns.has(fqn)) {
        return false;
      }
      seenFqns.add(fqn);

      return true;
    });
  }

  const ctx: HierarchyHydrationContext = {
    expandedSet: new Set(expandedRowKeys),
    richerByFqn: collectRicherNodesByFqn(terms),
    visibleDescendantFqns: new Set<string>(),
  };

  const deduplicatedRoots: ModifiedGlossaryTerm[] = [];
  const seenRootFqns = new Set<string>();

  for (const term of terms) {
    const fqn = term.fullyQualifiedName;
    if (fqn) {
      if (seenRootFqns.has(fqn)) {
        continue;
      }
      seenRootFqns.add(fqn);
    }

    deduplicatedRoots.push(
      hydrateTermSubtree(term, true, new Set<string>(), new Set(), ctx)
    );
  }

  return deduplicatedRoots.filter((term) => {
    const fqn = term.fullyQualifiedName;

    return !fqn || !ctx.visibleDescendantFqns.has(fqn);
  });
};

export const mergeChildTermsIntoHierarchy = (
  terms: ModifiedGlossary[],
  parentFQN: string,
  newChildren: GlossaryTermWithChildren[],
  pagingAfter?: string,
  append = false
): ModifiedGlossary[] => {
  const seededExistingChildren = append
    ? (collectRicherNodesByFqn(terms as ModifiedGlossaryTerm[]).get(parentFQN)
        ?.children as GlossaryTermWithChildren[] | undefined)
    : undefined;

  const updateTerms = (nodes: ModifiedGlossary[]): ModifiedGlossary[] =>
    nodes.map((term) => {
      if (term.fullyQualifiedName === parentFQN) {
        const existingChildren = append
          ? seededExistingChildren ?? term.children ?? []
          : [];
        const mergedChildren = uniqBy(
          [...existingChildren, ...newChildren],
          (child) => child.fullyQualifiedName ?? child.id
        );

        return {
          ...term,
          children: mergedChildren,
          hasMoreChildren: Boolean(pagingAfter),
          childrenPagingAfter: pagingAfter,
        };
      }

      if (term.children?.length) {
        return {
          ...term,
          children: updateTerms(
            term.children as ModifiedGlossary[]
          ) as GlossaryTermWithChildren[],
        };
      }

      return term;
    });

  return updateTerms(terms);
};

// A fetch response is stale when it no longer matches the search/status
// context the user is currently looking at (they typed/filtered again while
// the request was in flight) — applying it would repopulate or clear the
// table against the user's current intent.
export const isStaleFetchResponse = (
  data: unknown,
  fetchSearchTerm: string,
  currentSearchTerm: string,
  fetchStatusKey: string,
  currentStatusKey: string
) =>
  !data ||
  !Array.isArray(data) ||
  fetchSearchTerm !== currentSearchTerm ||
  fetchStatusKey !== currentStatusKey;

// When a status filter zeroes out the current page, the real total is not
// `0` — it's the unfiltered first-level count, fetched separately.
export const resolveTotalTermsCount = async (
  data: unknown[],
  isStatusFilterActive: boolean,
  pagingResponseTotal: number | undefined,
  glossaryFqn?: string
): Promise<number> => {
  if (data.length === 0 && isStatusFilterActive) {
    const countResponse = await getFirstLevelGlossaryTermsPaginated(
      glossaryFqn || '',
      0
    );

    return countResponse.paging?.total ?? 0;
  }

  return pagingResponseTotal ?? data.length;
};

export const hasActiveSearchTerm = (searchTerm: string) =>
  Boolean(searchTerm && searchTerm.trim().length > 0);

export const computeShowExpandTreeLoadMore = (
  toggleExpandBtn: boolean,
  after?: string
) => toggleExpandBtn && Boolean(after);

export const shouldShowEmptyPlaceholder = (
  hasNoTerms: boolean,
  isSearchActive: boolean,
  totalTermsCount: number,
  isTableLoading: boolean
) => hasNoTerms && !isSearchActive && totalTermsCount === 0 && !isTableLoading;
