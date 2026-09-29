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
      { path: ROUTES.DATA_INSIGHT, labelKey: 'label.insight-plural' },
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
