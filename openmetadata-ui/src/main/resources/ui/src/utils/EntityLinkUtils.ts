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

import { EntityTabs, EntityType } from '../enums/entity.enum';
import { ServiceCategory } from '../enums/service.enum';
import {
  AlertType,
  type EventSubscription,
} from '../generated/events/eventSubscription';
import type { SearchSourceAlias } from '../interface/search.interface';
import { getKnowledgePagePath } from './KnowledgePagePureUtils';
import {
  getApplicationDetailsPath,
  getBotsPath,
  getClassificationTagPath,
  getDataProductDetailsPath,
  getDomainDetailsPath,
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
  getKpiPath,
  getNotificationAlertDetailsPath,
  getObservabilityAlertDetailsPath,
  getPersonaDetailsPath,
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
  getServiceDetailsPath,
  getTagsDetailsPath,
  getTeamsWithFqnPath,
  getTestCaseDetailPagePath,
} from './RouterUtils';

const DIRECT_DETAILS_PATH_ENTITY_TYPES: ReadonlyArray<EntityType> = [
  EntityType.TABLE,
  EntityType.TOPIC,
  EntityType.DASHBOARD,
  EntityType.CHART,
  EntityType.PIPELINE,
  EntityType.MLMODEL,
  EntityType.CONTAINER,
  EntityType.DATABASE,
  EntityType.DATABASE_SCHEMA,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.STORED_PROCEDURE,
  EntityType.SEARCH_INDEX,
  EntityType.API_COLLECTION,
  EntityType.API_ENDPOINT,
  EntityType.DIRECTORY,
  EntityType.FILE,
  EntityType.SPREADSHEET,
  EntityType.WORKSHEET,
  EntityType.METRIC,
];

const SERVICE_CATEGORY_BY_ENTITY_TYPE: Partial<
  Record<EntityType, ServiceCategory>
> = {
  [EntityType.DATABASE_SERVICE]: ServiceCategory.DATABASE_SERVICES,
  [EntityType.MESSAGING_SERVICE]: ServiceCategory.MESSAGING_SERVICES,
  [EntityType.DASHBOARD_SERVICE]: ServiceCategory.DASHBOARD_SERVICES,
  [EntityType.PIPELINE_SERVICE]: ServiceCategory.PIPELINE_SERVICES,
  [EntityType.MLMODEL_SERVICE]: ServiceCategory.ML_MODEL_SERVICES,
  [EntityType.STORAGE_SERVICE]: ServiceCategory.STORAGE_SERVICES,
  [EntityType.SEARCH_SERVICE]: ServiceCategory.SEARCH_SERVICES,
  [EntityType.METADATA_SERVICE]: ServiceCategory.METADATA_SERVICES,
  [EntityType.API_SERVICE]: ServiceCategory.API_SERVICES,
  [EntityType.DRIVE_SERVICE]: ServiceCategory.DRIVE_SERVICES,
};

const getEventSubscriptionLink = (
  fullyQualifiedName: string,
  entity?: SearchSourceAlias
) =>
  (entity as EventSubscription)?.alertType === AlertType.Observability
    ? getObservabilityAlertDetailsPath(fullyQualifiedName)
    : getNotificationAlertDetailsPath(fullyQualifiedName);

const SIMPLE_ENTITY_LINK_BUILDERS: Partial<
  Record<EntityType, (fullyQualifiedName: string) => string>
> = {
  [EntityType.DATA_PRODUCT]: getDataProductDetailsPath,
  [EntityType.GLOSSARY]: getGlossaryTermDetailsPath,
  [EntityType.GLOSSARY_TERM]: getGlossaryTermDetailsPath,
  [EntityType.TAG]: getClassificationTagPath,
  [EntityType.CLASSIFICATION]: getTagsDetailsPath,
  [EntityType.BOT]: getBotsPath,
  [EntityType.TEAM]: getTeamsWithFqnPath,
  [EntityType.APPLICATION]: getApplicationDetailsPath,
  [EntityType.TEST_CASE]: getTestCaseDetailPagePath,
  [EntityType.TEST_SUITE]: (fullyQualifiedName: string) =>
    getEntityDetailsPath(
      EntityType.TABLE,
      fullyQualifiedName,
      EntityTabs.PROFILER
    ),
  [EntityType.DOMAIN]: getDomainDetailsPath,
  [EntityType.ROLE]: getRoleWithFqnPath,
  [EntityType.POLICY]: getPolicyWithFqnPath,
  [EntityType.PERSONA]: getPersonaDetailsPath,
  [EntityType.KPI]: getKpiPath,
  [EntityType.KNOWLEDGE_PAGE]: getKnowledgePagePath,
};

export const getEntityLinkFromType = (
  fullyQualifiedName: string,
  entityType: EntityType,
  entity?: SearchSourceAlias
) => {
  if (DIRECT_DETAILS_PATH_ENTITY_TYPES.includes(entityType)) {
    return getEntityDetailsPath(entityType, fullyQualifiedName);
  }

  const serviceCategory = SERVICE_CATEGORY_BY_ENTITY_TYPE[entityType];
  if (serviceCategory) {
    return getServiceDetailsPath(fullyQualifiedName, serviceCategory);
  }

  if (entityType === EntityType.EVENT_SUBSCRIPTION) {
    return getEventSubscriptionLink(fullyQualifiedName, entity);
  }

  const simpleBuilder = SIMPLE_ENTITY_LINK_BUILDERS[entityType];

  return simpleBuilder ? simpleBuilder(fullyQualifiedName) : '';
};
