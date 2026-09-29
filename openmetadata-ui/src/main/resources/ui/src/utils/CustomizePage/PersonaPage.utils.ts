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

import { isUndefined, omit, omitBy } from 'lodash';
import { DEFAULT_APP_MODE } from '../../constants/appMode.constants';
import {
  DEFAULT_LANDING_PAGE,
  LANDING_PAGE_SECTIONS,
} from '../../constants/platform/personaLandingPage.constants';
import { APP_ROUTER_ROUTES } from '../../constants/router.constants';
import { Document } from '../../generated/entity/docStore/document';
import { Persona } from '../../generated/entity/teams/persona';
import { Page } from '../../generated/system/ui/page';
import { PersonaPreferences } from '../../generated/type/personaPreferences';

export type PersonaGeneralPreferences = Pick<
  PersonaPreferences,
  'appMode' | 'defaultLandingPage'
>;

const GENERAL_PREFERENCE_KEYS: Array<keyof PersonaGeneralPreferences> = [
  'appMode',
  'defaultLandingPage',
];

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

export const getPersonaPreferences = (
  document: Document | null | undefined,
  personaId: string | undefined
): PersonaPreferences | undefined =>
  (
    document?.data?.personaPreferences as PersonaPreferences[] | undefined
  )?.find((entry) => entry.personaId === personaId);

/**
 * Replaces the persona's general preferences. An undefined field is removed
 * rather than stored, so "no value" keeps meaning "fall through to the next
 * default" (see `resolveEffectiveAppMode` and `resolvePersonaLandingPage`).
 */
export const updatePersonaGeneralPreferences = (
  preferences: PersonaPreferences[],
  persona: Pick<Persona, 'id' | 'name'>,
  changes: PersonaGeneralPreferences
): PersonaPreferences[] => {
  const values = omitBy(changes, isUndefined);
  const hasEntry = preferences.some((entry) => entry.personaId === persona.id);

  if (!hasEntry) {
    return Object.keys(values).length
      ? [
          ...preferences,
          { personaId: persona.id, personaName: persona.name, ...values },
        ]
      : preferences;
  }

  return preferences.map((entry) =>
    entry.personaId === persona.id
      ? { ...omit(entry, GENERAL_PREFERENCE_KEYS), ...values }
      : entry
  );
};

export const isLandingPageOption = (path?: string): path is string =>
  LANDING_PAGE_SECTIONS.some((section) =>
    section.options.some((option) => option.path === path)
  );

/**
 * Where a user of this persona lands after signing in. Only paths from the
 * curated option list are honoured, so a stale or hand-edited value falls
 * back to Home instead of navigating somewhere unexpected.
 */
export const resolvePersonaLandingPage = (
  document: Document | null | undefined,
  personaId: string | undefined
): string => {
  const path = getPersonaPreferences(document, personaId)?.defaultLandingPage;

  return isLandingPageOption(path) ? path : DEFAULT_LANDING_PAGE;
};

/**
 * Where a fresh sign-in lands. Only Classic honours the persona's default
 * landing page: the AI shell owns `/`, and many Classic pages don't exist in
 * its route tree. Home keeps routing to `/`, as it did before this setting.
 */
export const getSignInLandingPath = (
  appMode: string,
  document: Document | null | undefined,
  personaId: string | undefined
): string => {
  if (appMode !== DEFAULT_APP_MODE) {
    return APP_ROUTER_ROUTES.HOME;
  }

  const landingPage = resolvePersonaLandingPage(document, personaId);

  return landingPage === DEFAULT_LANDING_PAGE
    ? APP_ROUTER_ROUTES.HOME
    : landingPage;
};
