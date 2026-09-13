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

import { ServicesOverview } from '../../../generated/api/services/servicesOverview';
import {
  getServicesOverview,
  ServicesOverviewParams,
} from '../../../rest/serviceAPI';
import {
  CONNECTIONS_ENTITY_TYPES,
  SERVICES_ESTATE_LIMIT,
} from './ConnectionsPage.constants';

export const SERVICES_OVERVIEW_QUERY_KEY = [
  'connections',
  'services',
  'overview',
] as const;

// Matches the pipeline-stats cache so returning to the page within the window is free, while a
// websocket 'dirty' signal or an explicit invalidation still refetches immediately.
export const SERVICES_OVERVIEW_TTL_MS = 60 * 1000;
export const SERVICES_OVERVIEW_GC_TIME_MS =
  SERVICES_OVERVIEW_TTL_MS + 5 * 60 * 1000;

/**
 * The whole estate, unfiltered. Below the threshold this single response backs every tab, page,
 * sort and search on the Connections page — so it is deliberately one shared cache key rather
 * than one per view.
 *
 * `excludeProvider: 'system'` drops the built-in OpenMetadata metadata service server-side, which
 * keeps it out of the counts as well as the list; the page used to filter it out client-side and
 * carry a count that was one too high.
 */
export const ESTATE_PARAMS: ServicesOverviewParams = {
  entityType: CONNECTIONS_ENTITY_TYPES,
  excludeProvider: 'system',
  includeHealth: true,
  limit: SERVICES_ESTATE_LIMIT,
  offset: 0,
};

export const getServicesOverviewQueryOptions = (
  params: ServicesOverviewParams
) => ({
  gcTime: SERVICES_OVERVIEW_GC_TIME_MS,
  queryFn: (): Promise<ServicesOverview> => getServicesOverview(params),
  queryKey: [...SERVICES_OVERVIEW_QUERY_KEY, params],
  staleTime: SERVICES_OVERVIEW_TTL_MS,
});
