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
  AppMode,
  PageViewMode,
  PersonaPreferences,
} from '../../generated/type/personaPreferences';
import {
  getPersonaPage,
  normalizePersonaDocument,
  resolvePersonaLandingPage,
  resolvePersonaViewMode,
  updatePersonaAppLayout,
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

const createPreferencesDocument = (
  preferences: Partial<PersonaPreferences>
): Document => ({
  ...createDocument([]),
  data: {
    personaPreferences: [
      { personaId: 'persona-1', personaName: 'analytics', ...preferences },
    ],
  },
});

const createLandingPageDocument = (defaultLandingPage?: string) =>
  createPreferencesDocument({ defaultLandingPage });

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

describe('updatePersonaAppLayout', () => {
  const persona = { id: 'persona-1', name: 'analytics' };
  const otherEntry: PersonaPreferences = {
    personaId: 'persona-2',
    personaName: 'engineering',
    appMode: AppMode.AI,
  };

  it('adds an entry when the persona has none', () => {
    expect(
      updatePersonaAppLayout([otherEntry], persona, {
        appMode: AppMode.AI,
        defaultLandingPage: '/explore',
      })
    ).toEqual([
      otherEntry,
      {
        personaId: 'persona-1',
        personaName: 'analytics',
        appMode: AppMode.AI,
        defaultLandingPage: '/explore',
      },
    ]);
  });

  it('updates only the matching persona and keeps its other preferences', () => {
    const entry: PersonaPreferences = {
      personaId: 'persona-1',
      personaName: 'analytics',
      appMode: AppMode.Classic,
      landingPageSettings: { headerColor: '#fff' },
    };

    expect(
      updatePersonaAppLayout([entry, otherEntry], persona, {
        appMode: AppMode.AI,
        defaultLandingPage: '/glossary',
      })
    ).toEqual([
      { ...entry, appMode: AppMode.AI, defaultLandingPage: '/glossary' },
      otherEntry,
    ]);
  });

  it('removes cleared fields but keeps the entry', () => {
    const entry: PersonaPreferences = {
      personaId: 'persona-1',
      personaName: 'analytics',
      appMode: AppMode.AI,
      defaultLandingPage: '/explore',
      landingPageSettings: { headerColor: '#fff' },
    };

    const [updated] = updatePersonaAppLayout([entry], persona, {});

    expect(updated).toEqual({
      personaId: 'persona-1',
      personaName: 'analytics',
      landingPageSettings: { headerColor: '#fff' },
    });
  });

  it('returns the same array when clearing a persona that has no entry', () => {
    const preferences = [otherEntry];

    expect(updatePersonaAppLayout(preferences, persona, {})).toBe(preferences);
  });
});

describe('resolvePersonaLandingPage', () => {
  it('returns the persona landing page when it is a known option', () => {
    expect(
      resolvePersonaLandingPage(
        createLandingPageDocument('/glossary'),
        'persona-1'
      )
    ).toBe('/glossary');
  });

  it.each([
    ['unset', undefined],
    ['not a curated option', '/settings'],
    ['an external URL', '//example.com'],
  ])('falls back to Home when the value is %s', (_, path) => {
    expect(
      resolvePersonaLandingPage(createLandingPageDocument(path), 'persona-1')
    ).toBe('/my-data');
  });

  it('falls back to Home without a document or persona', () => {
    expect(resolvePersonaLandingPage(undefined, 'persona-1')).toBe('/my-data');
    expect(
      resolvePersonaLandingPage(
        createLandingPageDocument('/glossary'),
        undefined
      )
    ).toBe('/my-data');
  });
});

describe('resolvePersonaViewMode', () => {
  const document = createPreferencesDocument({
    defaultViewModes: {
      domains: PageViewMode.Tree,
      dataProducts: PageViewMode.Card,
      subDomains: PageViewMode.Tree,
    },
  });

  it('returns the view saved for the page', () => {
    expect(resolvePersonaViewMode(document, 'persona-1', 'domains')).toBe(
      PageViewMode.Tree
    );
    expect(resolvePersonaViewMode(document, 'persona-1', 'dataProducts')).toBe(
      PageViewMode.Card
    );
  });

  it('falls back to Table when the page does not offer the saved view', () => {
    expect(resolvePersonaViewMode(document, 'persona-1', 'subDomains')).toBe(
      PageViewMode.Table
    );
  });

  it('falls back to Table when nothing is saved for the page', () => {
    expect(
      resolvePersonaViewMode(document, 'persona-1', 'learningResources')
    ).toBe(PageViewMode.Table);
    expect(resolvePersonaViewMode(undefined, 'persona-1', 'domains')).toBe(
      PageViewMode.Table
    );
  });
});
