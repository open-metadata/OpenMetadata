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
import {
  DefaultViewModes,
  PageViewMode,
} from '../../generated/type/personaPreferences';

export type ViewModePage = keyof DefaultViewModes;

export const VIEW_MODE_PAGE = {
  Domains: 'domains',
  SubDomains: 'subDomains',
  DataProducts: 'dataProducts',
  LearningResources: 'learningResources',
} as const satisfies Record<string, ViewModePage>;

export interface ViewModePageOption {
  page: ViewModePage;
  labelKey: string;
  views: PageViewMode[];
}

export const DEFAULT_PAGE_VIEW_MODE = PageViewMode.Table;

const TABLE_AND_GRID = [PageViewMode.Table, PageViewMode.Card];

// Only pages that render a ViewToggle, each with the views its toggle offers.
export const VIEW_MODE_PAGES: ViewModePageOption[] = [
  {
    page: VIEW_MODE_PAGE.Domains,
    labelKey: 'label.domain-plural',
    views: [...TABLE_AND_GRID, PageViewMode.Tree],
  },
  {
    page: VIEW_MODE_PAGE.SubDomains,
    labelKey: 'label.sub-domain-plural',
    views: TABLE_AND_GRID,
  },
  {
    page: VIEW_MODE_PAGE.DataProducts,
    labelKey: 'label.data-product-plural',
    views: TABLE_AND_GRID,
  },
  {
    page: VIEW_MODE_PAGE.LearningResources,
    labelKey: 'label.learning-resources',
    views: TABLE_AND_GRID,
  },
];

export const PAGE_VIEW_MODE_LABEL_KEYS: Record<PageViewMode, string> = {
  [PageViewMode.Table]: 'label.table',
  [PageViewMode.Card]: 'label.grid',
  [PageViewMode.Tree]: 'label.tree',
};
