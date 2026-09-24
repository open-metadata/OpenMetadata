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
import { DefaultViewMode } from '../../../generated/api/configuration/appConfiguration';
import { ViewModeRow } from './DefaultAppModePage.types';

// Domains is the only page context whose toggle also offers a Tree view
// (DomainListPage's `views={[Table, Card, Tree]}`) — called out by id so the
// View options list and the page-change reset below share one source of truth.
export const DOMAIN_PAGE_ID = 'domains';

// The 4 page contexts that have a Table/Card view toggle today — a fixed
// list, not something derived from the router.
export const PAGE_OPTIONS: { id: string; labelKey: string }[] = [
  { id: 'dataProducts', labelKey: 'label.data-product-plural' },
  { id: DOMAIN_PAGE_ID, labelKey: 'label.domain-plural' },
  { id: 'subDomains', labelKey: 'label.sub-domain-plural' },
  { id: 'learningResources', labelKey: 'label.learning-resources' },
];

export const VIEW_OPTIONS: { id: DefaultViewMode; labelKey: string }[] = [
  { id: DefaultViewMode.List, labelKey: 'label.table' },
  { id: DefaultViewMode.Grid, labelKey: 'label.grid' },
];

export const DOMAIN_VIEW_OPTIONS: { id: DefaultViewMode; labelKey: string }[] =
  [...VIEW_OPTIONS, { id: DefaultViewMode.Tree, labelKey: 'label.tree' }];

export const getViewOptionsForPage = (page: string | null) =>
  page === DOMAIN_PAGE_ID ? DOMAIN_VIEW_OPTIONS : VIEW_OPTIONS;

// Row identity is only needed for React keys / add-remove bookkeeping in
// this form — not persisted — so a module-local counter is enough.
let rowIdCounter = 0;

export const generateRowId = () => String(rowIdCounter++);

export const buildRowsFromViewModes = (
  viewModes?: Record<string, DefaultViewMode>
): ViewModeRow[] =>
  Object.entries(viewModes ?? {}).map(([page, view]) => ({
    id: generateRowId(),
    page,
    view,
  }));

// Only rows with both a page and a view selected are real entries — a row
// still being filled in (page picked, view not yet picked) is dropped
// rather than saved half-finished.
export const buildViewModesMap = (
  rows: ViewModeRow[]
): Record<string, DefaultViewMode> => {
  const map: Record<string, DefaultViewMode> = {};
  rows.forEach((row) => {
    if (row.page && row.view) {
      map[row.page] = row.view;
    }
  });

  return map;
};

export const serializeViewModes = (map: Record<string, DefaultViewMode>) =>
  JSON.stringify(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
