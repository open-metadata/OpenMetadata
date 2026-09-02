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
import { PAGE_SIZE_LARGE } from '../../constants/constants';
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

// Per-fqn request counters so a slower, older fetchChildrenCount request
// can't overwrite a newer one's result. Never reset to {} — reset bumps
// each counter forward instead, so in-flight stale requests still lose.
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
  // Live status filter the Terms table is using; the badge reads this to
  // stay in sync with what the table actually shows.
  termsStatusFilter: string | undefined;
  setTermsStatusFilter: (termsStatusFilter: string | undefined) => void;
  // Live search query the Terms table is using; same purpose as above.
  termsSearchTerm: string | undefined;
  setTermsSearchTerm: (termsSearchTerm: string | undefined) => void;
  // Direct-children counts per glossary/term fqn, filtered by the two
  // fields above.
  childrenCounts: Record<string, number>;
  fetchChildrenCount: (fqn: string) => Promise<void>;
  // Clears cached counts so a stale one can't flash before a fresh fetch
  // lands, and bumps request counters so in-flight requests are discarded.
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

    // Only apply the result if this is still the latest request for this
    // fqn, so a slower, superseded request can't overwrite a newer one.
    childrenCountRequestSeqRef[fqn] =
      (childrenCountRequestSeqRef[fqn] ?? 0) + 1;
    const requestSeq = childrenCountRequestSeqRef[fqn];

    try {
      // Switch to the search API whenever a search term is active, so the
      // count matches what the table shows instead of the unfiltered list.
      let count: number;
      if (termsSearchTerm) {
        // paging.total from the search endpoint is not a real count --
        // GlossaryTermRepository#searchGlossaryTermsInternal derives it as
        // offset + results.size() + (hasMore ? 1 : 0). Count the returned
        // rows instead, one page of PAGE_SIZE_LARGE (50) -- matching the
        // table's own row count, this badge does not aggregate past the
        // first page (shows at most 50 for a larger match count).
        const { data } = await searchGlossaryTermsPaginated({
          q: termsSearchTerm,
          glossaryFqn: fqn,
          limit: PAGE_SIZE_LARGE,
          offset: 0,
          entityStatus: termsStatusFilter,
        });
        count = data.length;
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
    // Bump every tracked fqn's counter so any in-flight request is
    // discarded on arrival instead of repopulating a stale count.
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
