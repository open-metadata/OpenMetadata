/*
 *  Copyright 2021 Collate
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
  IN_PAGE_SEARCH_ROUTES,
  PLACEHOLDER_ROUTE_INGESTION_FQN,
  PLACEHOLDER_ROUTE_INGESTION_TYPE,
  PLACEHOLDER_ROUTE_SEARCHQUERY,
  PLACEHOLDER_ROUTE_SERVICE_CAT,
  PLACEHOLDER_ROUTE_SERVICE_FQN,
  PLACEHOLDER_ROUTE_TAB,
  ROUTES,
} from '../constants/constants';
import { initialFilterQS } from '../constants/explore.constants';

export const isDashboard = (pathname: string): boolean => {
  return pathname === ROUTES.FEEDS;
};

export const isInPageSearchAllowed = (pathname: string): boolean => {
  return Boolean(
    Object.keys(IN_PAGE_SEARCH_ROUTES).find((route) => pathname.includes(route))
  );
};

export const inPageSearchOptions = (pathname: string): Array<string> => {
  let strOptions: Array<string> = [];
  for (const route in IN_PAGE_SEARCH_ROUTES) {
    if (pathname.includes(route)) {
      strOptions = IN_PAGE_SEARCH_ROUTES[route];

      break;
    }
  }

  return strOptions;
};

export const getAddServicePath = (serviceCategory: string) => {
  let path = ROUTES.ADD_SERVICE;
  path = path.replace(PLACEHOLDER_ROUTE_SERVICE_CAT, serviceCategory);

  return path;
};

export const getAddIngestionPath = (
  serviceCategory: string,
  serviceFQN: string,
  ingestionType: string
) => {
  let path = ROUTES.ADD_INGESTION;
  path = path
    .replace(PLACEHOLDER_ROUTE_SERVICE_CAT, serviceCategory)
    .replace(PLACEHOLDER_ROUTE_SERVICE_FQN, serviceFQN)
    .replace(PLACEHOLDER_ROUTE_INGESTION_TYPE, ingestionType);

  return path;
};

export const getEditIngestionPath = (
  serviceCategory: string,
  serviceFQN: string,
  ingestionFQN: string,
  ingestionType: string
) => {
  let path = ROUTES.EDIT_INGESTION;
  path = path
    .replace(PLACEHOLDER_ROUTE_SERVICE_CAT, serviceCategory)
    .replace(PLACEHOLDER_ROUTE_SERVICE_FQN, serviceFQN)
    .replace(PLACEHOLDER_ROUTE_INGESTION_FQN, ingestionFQN)
    .replace(PLACEHOLDER_ROUTE_INGESTION_TYPE, ingestionType);

  return path;
};

/**
 *
 * @param searchQuery search text
 * @param tab selected explore result tab
 * @param filter selected facet filters
 * @returns
 */
export const getExplorePathWithInitFilters = (
  searchQuery = '',
  tab = 'tables',
  filter = ''
) => {
  let path = ROUTES.EXPLORE_WITH_SEARCH;
  path = path
    .replace(PLACEHOLDER_ROUTE_SEARCHQUERY, searchQuery)
    .replace(PLACEHOLDER_ROUTE_TAB, tab);

  return filter
    ? `${path}?${initialFilterQS}=${encodeURIComponent(filter)}`
    : path;
};

export const getServicesWithTabPath = (serviceCat: string) => {
  let path = ROUTES.SERVICES_WITH_TAB;
  path = path.replace(PLACEHOLDER_ROUTE_SERVICE_CAT, serviceCat);

  return path;
};
