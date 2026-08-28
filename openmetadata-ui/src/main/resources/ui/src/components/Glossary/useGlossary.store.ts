/*
 *  Copyright 2024 Collate.
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
import { create } from 'zustand';
import { AGGREGATE_PAGE_SIZE_LARGE } from '../../constants/constants';
import { DEFAULT_GLOSSARY_TERM_STATUS_FILTER } from '../../constants/Glossary.contant';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  getFirstLevelGlossaryTermsPaginated,
  GlossaryTermWithChildren,
  searchGlossaryTermsPaginated,
} from '../../rest/glossaryAPI';
import { findAndUpdateNested } from '../../utils/GlossaryPureUtils';

export type ModifiedGlossary = Glossary & {
  children?: GlossaryTermWithChildren[];
  childrenCount?: number;
  termCount?: number;
};

export type GlossaryFunctionRef = {
  onAddGlossaryTerm: (glossaryTerm?: GlossaryTerm) => void;
  onEditGlossaryTerm: (glossaryTerm?: GlossaryTerm) => void;
  refreshGlossaryTerms: () => void;
  loadMoreTerms?: () => void;
};

// Per-fqn request sequence counters for fetchChildrenCount, mirroring
// GlossaryTermTab.component.tsx's fetchAllTerms's own fetchRequestSeqRef: a
// per-fqn (not global) counter so a slower, earlier request for one fqn
// can't overwrite a newer one's result if the status filter or search term
// changes and fires requests in quick succession. Kept per-fqn (not a single
// ref, since fetchAllTerms only ever tracks its own one table's requests)
// because this store's fetchChildrenCount is shared by every Terms tab badge
// across the app, each fetching a different fqn concurrently.
//
// Deliberately NEVER reset back to {} or to 0 — resetChildrenCounts instead
// bumps each tracked fqn's counter forward (see its own comment below). A
// hard reset to {} would let a fetch for the same fqn issued right after the
// reset restart its own counter at the same number a still-in-flight,
// pre-reset request for that fqn had already captured — letting that stale
// response coincidentally pass the "is this still the latest?" check and
// briefly overwrite the fresh count. Since the counter only ever increases
// for a given fqn, no later request (from a fresh fetch OR a reset's bump)
// can ever coincidentally re-match a value already captured by an earlier one.
const childrenCountRequestSeqRef: Record<string, number> = {};

export const useGlossaryStore = create<{
  glossaries: Glossary[];
  activeGlossary: ModifiedGlossary;
  glossaryChildTerms: ModifiedGlossary[];
  setGlossaries: (glossaries: Glossary[]) => void;
  setActiveGlossary: (glossary: ModifiedGlossary) => void;
  updateGlossary: (glossary: Glossary) => void;
  updateActiveGlossary: (glossary: Partial<ModifiedGlossary>) => void;
  setGlossaryChildTerms: (glossaryChildTerms: ModifiedGlossary[]) => void;
  insertNewGlossaryTermToChildTerms: (glossary: GlossaryTerm) => void;
  termsLoading: boolean;
  setTermsLoading: (termsLoading: boolean) => void;
  onAddGlossaryTerm: (glossaryTerm?: GlossaryTerm) => void;
  onEditGlossaryTerm: (glossaryTerm?: GlossaryTerm) => void;
  refreshGlossaryTerms: () => void;
  loadMoreTerms: () => void;
  setGlossaryFunctionRef: (glossaryFunctionRef: GlossaryFunctionRef) => void;
  // The Terms table's live, already-'all'-filtered entityStatus param. Seeded
  // with the table's own default filter (not undefined) so "not yet
  // published" and "user explicitly selected All statuses" are
  // distinguishable — only the latter is a real undefined, since the table
  // always pushes at least once on mount.
  termsStatusFilter: string | undefined;
  setTermsStatusFilter: (termsStatusFilter: string | undefined) => void;
  // The Terms table's live search box query, pushed the same way as
  // termsStatusFilter above — so the children-count badge can tell when the
  // table has switched from the plain listing API to the search API and
  // mirror that, instead of only ever counting the unfiltered listing.
  termsSearchTerm: string | undefined;
  setTermsSearchTerm: (termsSearchTerm: string | undefined) => void;
  // Direct-children counts for a glossary/glossary-term fqn, filtered to the
  // same entityStatus AND search term the Terms table is currently using
  // (termsStatusFilter / termsSearchTerm above) — keyed by fqn since both the
  // Glossary root page and every Glossary Term page's Terms tab badge read
  // from this same map.
  childrenCounts: Record<string, number>;
  fetchChildrenCount: (fqn: string) => Promise<void>;
  // Clears the childrenCounts data map, so a previously-viewed entity's
  // cached count can't flash on a page for a different (or the same,
  // revisited) fqn before its own fresh fetch lands. Also bumps
  // childrenCountRequestSeqRef forward (never resets it — see its own
  // comment above) so any request still in-flight at reset time is
  // discarded on arrival, even if no replacement fetch for that fqn has
  // fired yet.
  resetChildrenCounts: () => void;
}>()((set, get) => ({
  glossaries: [],
  activeGlossary: {} as ModifiedGlossary,
  glossaryChildTerms: [],
  termsLoading: false,
  termsStatusFilter: DEFAULT_GLOSSARY_TERM_STATUS_FILTER.join(','),
  termsSearchTerm: undefined,
  childrenCounts: {},

  setGlossaries: (glossaries: Glossary[]) => {
    set({ glossaries });
  },
  updateGlossary: (glossary: Glossary) => {
    const { glossaries } = get();

    const newGlossaries = glossaries.map((g) =>
      g.fullyQualifiedName === glossary.fullyQualifiedName ? glossary : g
    );

    set({ glossaries: newGlossaries });
  },
  setActiveGlossary: (glossary: ModifiedGlossary) => {
    set({ activeGlossary: glossary });
  },
  updateActiveGlossary: (glossary: Partial<ModifiedGlossary>) => {
    const { activeGlossary, glossaries } = get();

    const updatedGlossary = {
      ...activeGlossary,
      ...glossary,
    } as ModifiedGlossary;

    // Update the active glossary
    set({ activeGlossary: updatedGlossary });

    // Update the corresponding glossary in the glossaries list
    const index = glossaries.findIndex(
      (g) => g.fullyQualifiedName === updatedGlossary.fullyQualifiedName
    );

    if (index !== -1) {
      glossaries[index] = updatedGlossary;
    }
  },
  insertNewGlossaryTermToChildTerms: (glossary: GlossaryTerm) => {
    const { glossaryChildTerms, activeGlossary } = get();

    const glossaryTerm = 'glossary' in activeGlossary;

    // If activeGlossary is Glossary term & User is adding term to the activeGlossary term
    // we don't need to find in hierarchy
    if (
      glossaryTerm &&
      activeGlossary.fullyQualifiedName === glossary.parent?.fullyQualifiedName
    ) {
      set({
        glossaryChildTerms: [
          ...glossaryChildTerms,
          glossary,
        ] as ModifiedGlossary[],
      });
    } else {
      // Typically used to updated the glossary term list in the glossary page
      set({
        glossaryChildTerms: findAndUpdateNested(glossaryChildTerms, glossary),
      });
    }
  },
  setGlossaryChildTerms: (glossaryChildTerms: ModifiedGlossary[]) => {
    // Ensure glossaryChildTerms is always an array
    const validTerms = Array.isArray(glossaryChildTerms)
      ? glossaryChildTerms
      : [];
    set({ glossaryChildTerms: validTerms });
  },
  setTermsLoading: (termsLoading: boolean) => {
    set({ termsLoading });
  },
  setTermsStatusFilter: (termsStatusFilter: string | undefined) => {
    set({ termsStatusFilter });
  },
  setTermsSearchTerm: (termsSearchTerm: string | undefined) => {
    set({ termsSearchTerm });
  },
  fetchChildrenCount: async (fqn: string) => {
    const { termsStatusFilter, termsSearchTerm } = get();

    // Mirrors GlossaryTermTab.component.tsx's fetchAllTerms's own
    // fetchRequestSeqRef pattern: increment before the request, and only
    // apply the result if this is still the latest request issued for this
    // fqn — otherwise a slower, earlier request (e.g. superseded by a
    // rapid filter/search change) can overwrite a newer one's result.
    childrenCountRequestSeqRef[fqn] =
      (childrenCountRequestSeqRef[fqn] ?? 0) + 1;
    const requestSeq = childrenCountRequestSeqRef[fqn];

    try {
      // Mirrors GlossaryTermTab.component.tsx's fetchAllTerms: the table
      // itself switches from the plain listing API to the search API the
      // moment a search term is active, so the count must switch with it —
      // otherwise it keeps counting the unfiltered listing while the table
      // shows only the search matches.
      let count: number;
      if (termsSearchTerm) {
        // The search endpoint's `limit` has a server-side @Min(1) constraint
        // (GlossaryTermResource#searchGlossaryTerms) — limit: 0 is rejected
        // outright, not "count only". Its `paging.total` also isn't a real
        // count for search results: GlossaryTermRepository#searchGlossary
        // TermsInternal deliberately skips the COUNT query and derives
        // `knownTotal` from `offset + terms.size() + (hasMore ? 1 : 0)`,
        // which is only accurate when the true total is <= limit + 1. The
        // table itself already works around this the same way — see its own
        // `setTotalTermsCount(data.length)` in fetchAllTerms — so this
        // mirrors that: count the returned rows, not paging.total.
        //
        // A single fetch is NOT a one-shot count here: fetchAllTerms's own
        // search branch supports "load more" via offset/hasMore exactly
        // like the plain listing does, so a term with more matches than
        // one page can still grow past whatever limit a single request
        // uses. A single AGGREGATE_PAGE_SIZE_LARGE (1000) request silently
        // truncated the count for any term with over 1000 matches. Fix:
        // page through with the same offset/hasMore shape as fetchAllTerms,
        // AGGREGATE_PAGE_SIZE_LARGE (1000) rows at a time — not
        // PAGE_SIZE_LARGE (50), so a large-but-typical match count still
        // resolves in one or two round trips instead of dozens — summing
        // every page until one comes back short of the limit (no more
        // matches left).
        count = 0;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { data } = await searchGlossaryTermsPaginated({
            q: termsSearchTerm,
            glossaryFqn: fqn,
            limit: AGGREGATE_PAGE_SIZE_LARGE,
            offset,
            entityStatus: termsStatusFilter,
          });
          count += data.length;
          hasMore = data.length === AGGREGATE_PAGE_SIZE_LARGE;
          offset += AGGREGATE_PAGE_SIZE_LARGE;

          // Bail out mid-pagination if a newer request for this fqn has
          // since been issued, instead of paging through a result set
          // whose count is about to be discarded anyway.
          if (requestSeq !== childrenCountRequestSeqRef[fqn]) {
            return;
          }
        }
      } else {
        const { paging } = await getFirstLevelGlossaryTermsPaginated(
          fqn,
          0,
          undefined,
          termsStatusFilter
        );
        count = paging.total ?? 0;
      }

      if (requestSeq !== childrenCountRequestSeqRef[fqn]) {
        return;
      }

      const { childrenCounts } = get();
      set({ childrenCounts: { ...childrenCounts, [fqn]: count } });
    } catch {
      if (requestSeq !== childrenCountRequestSeqRef[fqn]) {
        return;
      }

      const { childrenCounts } = get();
      set({ childrenCounts: { ...childrenCounts, [fqn]: 0 } });
    }
  },
  resetChildrenCounts: () => {
    // Bump (never reset to 0 — see the module-level comment above) every
    // fqn's counter that's been fetched before, so any request still
    // in-flight for it at reset time captured a requestSeq strictly less
    // than the bumped value and is discarded when it resolves — even if no
    // replacement request for that fqn has fired yet. Without this, a
    // stale success/error from a previous view could still pass the
    // staleness check and repopulate the badge with an obsolete count
    // until the next fetch overwrites it.
    for (const fqn of Object.keys(childrenCountRequestSeqRef)) {
      childrenCountRequestSeqRef[fqn] += 1;
    }
    set({ childrenCounts: {} });
  },
  setGlossaryFunctionRef: (glossaryFunctionRef: GlossaryFunctionRef) => {
    set({
      ...glossaryFunctionRef,
      loadMoreTerms:
        glossaryFunctionRef.loadMoreTerms ||
        (() => {
          // Placeholder function
        }),
    });
  },

  onAddGlossaryTerm: (_glossaryTerm?: GlossaryTerm) => {
    // This is a placeholder function that will be replaced by the actual function
  },

  onEditGlossaryTerm: (_glossaryTerm?: GlossaryTerm) => {
    // This is a placeholder function that will be replaced by the actual function
  },

  refreshGlossaryTerms: () => {
    // This is a placeholder function that will be replaced by the actual function
  },

  loadMoreTerms: () => {
    // This is a placeholder function that will be replaced by the actual function
  },
}));
