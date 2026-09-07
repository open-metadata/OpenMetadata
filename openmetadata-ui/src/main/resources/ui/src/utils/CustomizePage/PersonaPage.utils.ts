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

import { Document } from '../../generated/entity/docStore/document';
import { Page } from '../../generated/system/ui/page';

const getPageEntries = (document?: Document | null): unknown[] | undefined => {
  const pages = document?.data?.pages as unknown;

  return Array.isArray(pages) ? pages : undefined;
};

const isPersonaPage = (value: unknown): value is Page =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { pageType?: unknown }).pageType === 'string';

export const getPersonaPage = (
  document: Document | null | undefined,
  pageType: string | null | undefined
): Page | undefined => {
  if (!pageType) {
    return undefined;
  }

  return getPageEntries(document)?.find(
    (page): page is Page => isPersonaPage(page) && page.pageType === pageType
  );
};

export const normalizePersonaDocument = (document: Document): Document => {
  const pageEntries = getPageEntries(document);

  if (!pageEntries) {
    return document;
  }

  const pages = pageEntries.filter(isPersonaPage);

  if (pages.length === pageEntries.length) {
    return document;
  }

  return {
    ...document,
    data: {
      ...document.data,
      pages,
    },
  };
};

export const updatePersonaDocumentPage = (
  document: Document,
  pageType: string,
  newPage?: Page
): Document => {
  const pageEntries = getPageEntries(document);
  const pages = pageEntries?.filter(isPersonaPage) ?? [];
  const hasPage = pages.some((page) => page.pageType === pageType);
  const hasInvalidPage =
    pageEntries !== undefined && pageEntries.length !== pages.length;

  if (!newPage && !hasPage && !hasInvalidPage) {
    return document;
  }

  let updatedPages: Page[];

  if (!newPage) {
    updatedPages = pages.filter((page) => page.pageType !== pageType);
  } else if (hasPage) {
    updatedPages = pages.map((page) =>
      page.pageType === pageType ? newPage : page
    );
  } else {
    updatedPages = [...pages, newPage];
  }

  return {
    ...document,
    data: {
      ...document.data,
      pages: updatedPages,
    },
  };
};
