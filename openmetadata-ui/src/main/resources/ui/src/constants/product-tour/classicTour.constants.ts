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
import { ProductTourStep } from '../../interface/product-tour/productTour.interface';
import { getSettingPath } from '../../utils/RouterPaths';
import { ROUTES } from '../constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../GlobalSettings.constants';

// Settings › Services › Databases; a bare /settings/services opens the menu.
const SERVICES_ROUTE = getSettingPath(
  GlobalSettingsMenuCategory.SERVICES,
  GlobalSettingOptions.DATABASES
);

/**
 * The Classic tour: the product's main pages. Each step highlights the element
 * its page marks `data-tour-step`, never a test id, and every page is served
 * from `classicTour.fixtures.json` while the tour runs.
 */
export const CLASSIC_TOUR_STEPS: ProductTourStep[] = [
  {
    route: ROUTES.MY_DATA,
    selector: '[data-tour-step="topics-to-catch-up-on"]',
    i18nKey: 'message.product-tour-step-topics-to-catch-up-on',
    labelKey: 'label.topics-to-catch-up-on',
  },
  {
    route: ROUTES.EXPLORE,
    selector: '[data-tour-step="explore-search"]',
    i18nKey: 'message.product-tour-step-explore',
    labelKey: 'label.explore',
  },
  {
    route: SERVICES_ROUTE,
    selector: '[data-tour-step="services"]',
    i18nKey: 'message.product-tour-step-services',
    labelKey: 'label.service-plural',
  },
  {
    route: ROUTES.GLOSSARY,
    selector: '[data-tour-step="glossary"]',
    i18nKey: 'message.product-tour-step-glossary',
    labelKey: 'label.glossary',
    position: 'right',
  },
  {
    route: ROUTES.ONTOLOGY_EXPLORER,
    selector: '[data-tour-step="ontology-studio"]',
    i18nKey: 'message.product-tour-step-ontology-studio',
    labelKey: 'label.ontology-studio',
  },
  {
    route: ROUTES.DATA_QUALITY,
    selector: '[data-tour-step="data-quality-data-health"]',
    i18nKey: 'message.product-tour-step-data-quality',
    labelKey: 'label.data-quality',
  },
  {
    route: ROUTES.DATA_MARKETPLACE,
    selector: '[data-tour-step="data-marketplace"]',
    i18nKey: 'message.product-tour-step-data-marketplace',
    labelKey: 'label.data-marketplace',
  },
  {
    route: ROUTES.CONTEXT_CENTER_OVERVIEW,
    selector: '[data-tour-step="context-center"]',
    i18nKey: 'message.product-tour-step-context-center',
    labelKey: 'label.context-center',
  },
  {
    route: ROUTES.CONTEXT_CENTER_MEMORIES,
    selector: '[data-tour-step="memories"]',
    i18nKey: 'message.product-tour-step-memories',
    labelKey: 'label.memory-plural',
  },
];

// What a step whose target is missing points at: the page content, marked
// `data-tour-page` in each shell.
export const TOUR_PAGE_SELECTOR = '[data-tour-page]';
