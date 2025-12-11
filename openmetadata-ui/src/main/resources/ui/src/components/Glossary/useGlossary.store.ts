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
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { GlossaryTermWithChildren } from '../../rest/glossaryAPI';
import { findAndUpdateNested } from '../../utils/GlossaryUtils';

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
}>()((set, get) => ({
  glossaries: [],
  activeGlossary: {} as ModifiedGlossary,
  glossaryChildTerms: [],
  termsLoading: false,

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
