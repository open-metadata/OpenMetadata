/*
 *  Copyright 2025 Collate.
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

import { SearchLg } from '@untitledui/icons';
import {
  ServiceEmptyStateConfig,
  SERVICE_EMPTY_STATE,
} from '../../../constants/ServiceEmptyState.constant';
import { SearchIndex } from '../../../enums/search.enum';
import { ServiceCategory } from '../../../enums/service.enum';

export interface CategoryConfig {
  key: ServiceCategory;
  titleKey: string;
  // Bespoke subtitle for the long-standing tabs. Tabs without one fall back to the
  // generic parameterized `connections-service-type-description` message.
  descriptionKey?: string;
}

export const CATEGORY_CONFIGS = [
  {
    key: ServiceCategory.DATABASE_SERVICES,
    titleKey: 'label.database-service',
    descriptionKey: 'message.connections-database-services-description',
  },
  {
    key: ServiceCategory.DASHBOARD_SERVICES,
    titleKey: 'label.dashboard-service',
    descriptionKey: 'message.connections-dashboard-services-description',
  },
  {
    key: ServiceCategory.MESSAGING_SERVICES,
    titleKey: 'label.messaging-service',
    descriptionKey: 'message.connections-messaging-services-description',
  },
  {
    key: ServiceCategory.PIPELINE_SERVICES,
    titleKey: 'label.pipeline-service',
    descriptionKey: 'message.connections-pipeline-services-description',
  },
  {
    key: ServiceCategory.STORAGE_SERVICES,
    titleKey: 'label.storage-service',
    descriptionKey: 'message.connections-storage-services-description',
  },
  {
    key: ServiceCategory.API_SERVICES,
    titleKey: 'label.api-service',
    descriptionKey: 'message.connections-api-services-description',
  },
  {
    key: ServiceCategory.ML_MODEL_SERVICES,
    titleKey: 'label.ml-model',
    descriptionKey: 'message.connections-ml-model-services-description',
  },
  {
    key: ServiceCategory.METADATA_SERVICES,
    titleKey: 'label.metadata-service',
    descriptionKey: 'message.connections-metadata-services-description',
  },
  {
    key: ServiceCategory.SEARCH_SERVICES,
    titleKey: 'label.search-service',
  },
  {
    key: ServiceCategory.DRIVE_SERVICES,
    titleKey: 'label.drive',
  },
  {
    key: ServiceCategory.SECURITY_SERVICES,
    titleKey: 'label.security-service',
  },
] satisfies CategoryConfig[];

export type ConnectionsServiceCategory =
  (typeof CATEGORY_CONFIGS)[number]['key'];

export const ENTITY_TYPE_TO_CATEGORY: Record<
  string,
  ConnectionsServiceCategory
> = {
  databaseService: ServiceCategory.DATABASE_SERVICES,
  messagingService: ServiceCategory.MESSAGING_SERVICES,
  pipelineService: ServiceCategory.PIPELINE_SERVICES,
  dashboardService: ServiceCategory.DASHBOARD_SERVICES,
  mlmodelService: ServiceCategory.ML_MODEL_SERVICES,
  storageService: ServiceCategory.STORAGE_SERVICES,
  apiService: ServiceCategory.API_SERVICES,
  metadataService: ServiceCategory.METADATA_SERVICES,
  searchService: ServiceCategory.SEARCH_SERVICES,
  driveService: ServiceCategory.DRIVE_SERVICES,
  securityService: ServiceCategory.SECURITY_SERVICES,
};

// The service entity types this page tabs over, i.e. the universe the overview endpoint counts.
// Deliberately not every service type the server knows — llm/mcp services are not listed here.
export const CONNECTIONS_ENTITY_TYPES = Object.keys(ENTITY_TYPE_TO_CATEGORY);

// Inverse of ENTITY_TYPE_TO_CATEGORY, derived rather than hand-written so the two cannot drift.
export const CATEGORY_TO_ENTITY_TYPE = Object.fromEntries(
  Object.entries(ENTITY_TYPE_TO_CATEGORY).map(([entityType, category]) => [
    category,
    entityType,
  ])
) as Record<ConnectionsServiceCategory, string>;

// At or below this many services the page loads the whole estate once and does all paging,
// filtering, sorting and search in the browser; above it each of those goes back to the server.
// The mode is derived from the response's own `total`, never guessed.
export const SERVICES_ESTATE_LIMIT = 500;

export const GRID_PAGE_SIZE_OPTIONS = [12, 24, 48];
// Same steps as the grid so switching layout keeps the page you were on rather than resizing it.
export const LIST_PAGE_SIZE_OPTIONS = [12, 24, 48];
export const VIEW_MODE_PARAM = 'viewMode';
export const CATEGORY_PARAM = 'category';
// Health filter, set either by this page's own dropdown or by the landing Platform Health
// widget's footer links. Carries a comma-separated list of ServiceHealth values; the legacy
// single values (failing / healthy / notRun) those links still use are expanded on read.
export const HEALTH_PARAM = 'health';

// Mirrors the classic service list's deleted switch: on means show only soft-deleted services.
export const DELETED_PARAM = 'deleted';

// The search term belongs in the URL for the same reasons the filters do: a filtered view stays
// shareable and survives reload and back/forward.
export const SEARCH_PARAM = 'search';
// Connector filter, comma-separated. In the URL so it survives reload and back/forward.
export const SERVICE_TYPE_PARAM = 'serviceType';

// Security Service has no member of its own in the shared SearchIndex enum (it is a smaller,
// less commonly indexed service type), so its index name is inlined here rather than imported
// from a downstream-only enum — the string is the index name the server actually exposes.
const SECURITY_SERVICE_SEARCH_INDEX =
  'securityService' as unknown as SearchIndex;

// One search index per tab.
export const CATEGORY_TO_SEARCH_INDEX: Record<
  ConnectionsServiceCategory,
  SearchIndex
> = {
  [ServiceCategory.DATABASE_SERVICES]: SearchIndex.DATABASE_SERVICE,
  [ServiceCategory.DASHBOARD_SERVICES]: SearchIndex.DASHBOARD_SERVICE,
  [ServiceCategory.MESSAGING_SERVICES]: SearchIndex.MESSAGING_SERVICE,
  [ServiceCategory.PIPELINE_SERVICES]: SearchIndex.PIPELINE_SERVICE,
  [ServiceCategory.STORAGE_SERVICES]: SearchIndex.STORAGE_SERVICE,
  [ServiceCategory.API_SERVICES]: SearchIndex.API_SERVICE,
  [ServiceCategory.ML_MODEL_SERVICES]: SearchIndex.ML_MODEL_SERVICE,
  [ServiceCategory.METADATA_SERVICES]: SearchIndex.METADATA_SERVICE,
  [ServiceCategory.SEARCH_SERVICES]: SearchIndex.SEARCH_SERVICE,
  [ServiceCategory.DRIVE_SERVICES]: SearchIndex.DRIVE_SERVICE,
  [ServiceCategory.SECURITY_SERVICES]: SECURITY_SERVICE_SEARCH_INDEX,
};

// The "All Connections" tab queries exactly the indexes we tab (not the broader `service`
// alias, which also spans llm/mcp services we do not list).
export const ALL_SERVICES_SEARCH_INDEX = Object.values(
  CATEGORY_TO_SEARCH_INDEX
);

// The per-category first-run placeholders are shared with the classic services list
// (SERVICE_EMPTY_STATE); "All Connections" spans every category, so it needs its own copy. Icon
// matches the "All Connections" entry in the tab rail (ConnectionsSecondaryNav's CATEGORY_ICONS
// covers only the per-category tabs, not this one) rather than reusing a per-category icon.
export const ALL_CONNECTIONS_EMPTY_STATE: ServiceEmptyStateConfig = {
  icon: SearchLg,
  titleKey: 'message.empty-all-connections-title',
  descriptionKey: 'message.empty-all-connections-description',
};

// Typed structurally rather than importing ConnectionsCategory from useConnectionsData, which
// imports this module — the import would be a cycle.
export const getConnectionsEmptyState = (
  category: ConnectionsServiceCategory | 'all'
): ServiceEmptyStateConfig =>
  category === 'all'
    ? ALL_CONNECTIONS_EMPTY_STATE
    : SERVICE_EMPTY_STATE[category];
