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

import { Document } from '../../generated/entity/docStore/document';
import { Page, PageType } from '../../generated/system/ui/page';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import {
  getPersonaPage,
  normalizePersonaDocument,
  updatePersonaDocumentPage,
} from '../../utils/CustomizePage/PersonaPage.utils';

interface CustomizePageStore {
  document: Document | null;
  currentPageType: PageType | null;
  currentPage: Page | null;
  currentPersonaDocStore: Document | null;
  setDocument: (document: Document) => void;

  setPage: (page: Page) => void;

  getPage: (pageType: string) => Page | null;

  getNavigation: () => NavigationItem[] | null;
  setCurrentPageType: (pageType: PageType) => void;
  updateCurrentPage: (page: Page) => void;
  setCurrentPersonaDocStore: (document: Document) => void;
  resetCurrentPersonaDocStore: () => void;
}

export const useCustomizeStore = create<CustomizePageStore>()((set, get) => ({
  document: null,
  currentPage: null,
  currentPageType: null,
  currentPersonaDocStore: null,
  setDocument: (document: Document) => {
    const { updateCurrentPage, currentPageType } = get();
    const normalizedDocument = normalizePersonaDocument(document);
    const newPage = getPersonaPage(normalizedDocument, currentPageType);

    updateCurrentPage(newPage ?? ({ pageType: currentPageType } as Page));

    set({ document: normalizedDocument });
  },

  setPage: (page: Page) => {
    const { document } = get();

    if (document) {
      set({
        document: updatePersonaDocumentPage(document, page.pageType, page),
      });
    }
  },

  getPage: (pageType: string) => {
    const { document } = get();

    return getPersonaPage(document, pageType) ?? null;
  },

  getNavigation: () => {
    const { document } = get();

    return document?.data?.navigation;
  },

  updateCurrentPage: (page: Page) => {
    set({ currentPage: page });
  },

  setCurrentPageType: (pageType: PageType) => {
    const { getPage } = get();

    const currentPage = getPage(pageType);

    set({
      currentPage: currentPage ?? ({ pageType } as Page),
      currentPageType: pageType,
    });
  },

  setCurrentPersonaDocStore: (document: Document) => {
    set({ currentPersonaDocStore: document });
  },

  reset: () => {
    set({ document: null, currentPage: null });
  },

  resetCurrentPage: () => {
    set({ currentPage: null });
  },
  resetCurrentPersonaDocStore: () => {
    set({ currentPersonaDocStore: null });
  },
}));
