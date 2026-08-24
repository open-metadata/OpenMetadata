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
import { Page, PageType } from '../../generated/system/ui/page';
import {
  getPersonaPage,
  normalizePersonaDocument,
  updatePersonaDocumentPage,
} from './PersonaPage.utils';

const tablePage = {
  pageType: PageType.Table,
  tabs: [{ id: 'overview', layout: [], name: 'overview' }],
} as unknown as Page;

const dashboardPage = {
  pageType: PageType.Dashboard,
  layout: [],
} as unknown as Page;

const createDocument = (pages: unknown[]): Document => ({
  data: { pages, navigation: [{ name: 'Explore' }] },
  entityType: 'Page',
  fullyQualifiedName: 'persona.test',
  name: 'test',
});

describe('PersonaPage utilities', () => {
  it('finds a valid page after invalid legacy entries', () => {
    const document = createDocument([null, undefined, {}, tablePage]);

    expect(getPersonaPage(document, PageType.Table)).toBe(tablePage);
  });

  it('normalizes invalid page entries without mutating the response', () => {
    const document = createDocument([null, tablePage, undefined]);

    const normalizedDocument = normalizePersonaDocument(document);

    expect(normalizedDocument).not.toBe(document);
    expect(normalizedDocument.data).not.toBe(document.data);
    expect(normalizedDocument.data.pages).toEqual([tablePage]);
    expect(normalizedDocument.data.navigation).toBe(document.data.navigation);
    expect(document.data.pages).toEqual([null, tablePage, undefined]);
  });

  it('preserves tab-based pages without a top-level layout', () => {
    const document = createDocument([tablePage]);

    expect(normalizePersonaDocument(document)).toBe(document);
  });

  it('does not add an undefined page when resetting an unsaved layout', () => {
    const document = {
      ...createDocument([]),
      data: { navigation: [{ name: 'Explore' }] },
    };

    expect(updatePersonaDocumentPage(document, PageType.DataMarketplace)).toBe(
      document
    );
  });

  it('adds, replaces, and removes pages while cleaning legacy entries', () => {
    const document = createDocument([null, tablePage]);

    const withDashboard = updatePersonaDocumentPage(
      document,
      PageType.Dashboard,
      dashboardPage
    );
    const replacement = {
      ...dashboardPage,
      layout: [{ i: 'updated' }],
    } as Page;
    const withReplacement = updatePersonaDocumentPage(
      withDashboard,
      PageType.Dashboard,
      replacement
    );
    const withoutTable = updatePersonaDocumentPage(
      withReplacement,
      PageType.Table
    );

    expect(withDashboard.data.pages).toEqual([tablePage, dashboardPage]);
    expect(withReplacement.data.pages).toEqual([tablePage, replacement]);
    expect(withoutTable.data.pages).toEqual([replacement]);
  });
});
