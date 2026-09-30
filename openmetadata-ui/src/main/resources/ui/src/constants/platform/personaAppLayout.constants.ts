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
import { ROUTES } from '../constants';

export interface LandingPageOption {
  path: string;
  labelKey: string;
}

export interface LandingPageSection {
  titleKey: string;
  options: LandingPageOption[];
}

export const DEFAULT_LANDING_PAGE = ROUTES.MY_DATA;

// Curated rather than derived from the sidebar: only top-level pages that
// make sense as a first screen are offered.
export const LANDING_PAGE_SECTIONS: LandingPageSection[] = [
  {
    titleKey: 'label.general',
    options: [
      { path: ROUTES.MY_DATA, labelKey: 'label.home-my-data' },
      { path: ROUTES.EXPLORE, labelKey: 'label.explore' },
      { path: ROUTES.PLATFORM_LINEAGE, labelKey: 'label.lineage' },
    ],
  },
  {
    titleKey: 'label.data-marketplace-section',
    options: [
      { path: ROUTES.DATA_MARKETPLACE, labelKey: 'label.data-marketplace' },
      { path: ROUTES.DOMAIN, labelKey: 'label.domain-plural' },
      { path: ROUTES.DATA_PRODUCT, labelKey: 'label.data-product-plural' },
    ],
  },
  {
    titleKey: 'label.observability',
    options: [
      { path: ROUTES.DATA_QUALITY, labelKey: 'label.data-quality' },
      { path: ROUTES.INCIDENT_MANAGER, labelKey: 'label.incident-manager' },
      { path: ROUTES.DATA_INSIGHT, labelKey: 'label.insight-plural' },
    ],
  },
  {
    titleKey: 'label.govern',
    options: [
      { path: ROUTES.GLOSSARY, labelKey: 'label.glossary' },
      { path: ROUTES.TAGS, labelKey: 'label.classification' },
      { path: ROUTES.METRICS, labelKey: 'label.metric-plural' },
    ],
  },
];

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
