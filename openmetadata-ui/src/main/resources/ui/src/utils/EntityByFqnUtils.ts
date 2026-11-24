/*
 *  Copyright 2024 Collate.
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

import { EntityUnion } from '../components/Explore/ExplorePage.interface';
import { EntityType, TabSpecificField } from '../enums/entity.enum';
import { ServiceCategoryPlural } from '../enums/service.enum';
import { Include } from '../generated/type/include';
import { getAlertsFromName } from '../rest/alertsAPI';
import { getApiCollectionByFQN } from '../rest/apiCollectionsAPI';
import { getApiEndPointByFQN } from '../rest/apiEndpointsAPI';
import { getApplicationByName } from '../rest/applicationAPI';
import { getMarketPlaceApplicationByFqn } from '../rest/applicationMarketPlaceAPI';
import { getBotByName } from '../rest/botsAPI';
import { getChartByFqn } from '../rest/chartsAPI';
import { getContract } from '../rest/contractAPI';
import { getDashboardByFqn } from '../rest/dashboardAPI';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemaDetailsByFQN,
} from '../rest/databaseAPI';
import { getDataModelByFqn } from '../rest/dataModelsAPI';
import { getDataProductByName } from '../rest/dataProductAPI';
import { getDomainByName } from '../rest/domainAPI';
import { getGlossariesByName, getGlossaryTermByFQN } from '../rest/glossaryAPI';
import { getIngestionPipelineByFqn } from '../rest/ingestionPipelineAPI';
import { getKnowledgePageByFqn } from '../rest/knowledgeCenterAPI';
import { getKPIByName } from '../rest/KpiAPI';
import { getTypeByFQN } from '../rest/metadataTypeAPI';
import { getMetricByFqn } from '../rest/metricsAPI';
import { getMlModelByFQN } from '../rest/mlModelAPI';
import { getPersonaByName } from '../rest/PersonaAPI';
import { getPipelineByFqn } from '../rest/pipelineAPI';
import { getQueryByFqn } from '../rest/queryAPI';
import { getPolicyByName, getRoleByName } from '../rest/rolesAPIV1';
import { getSearchIndexDetailsByFQN } from '../rest/SearchIndexAPI';
import { getServiceByFQN } from '../rest/serviceAPI';
import { getContainerByFQN } from '../rest/storageAPI';
import { getStoredProceduresByFqn } from '../rest/storedProceduresAPI';
import { getTableDetailsByFQN } from '../rest/tableAPI';
import { getClassificationByName, getTagByFqn } from '../rest/tagAPI';
import { getTeamByName } from '../rest/teamsAPI';
import { getTestCaseByFqn, getTestSuiteByName } from '../rest/testAPI';
import { getTopicByFqn } from '../rest/topicsAPI';
import { getUserByName } from '../rest/userAPI';
import { getOwnHandler } from './RecordUtils';

type EntityByFqnHandler = (
  entityFQN: string,
  fields?: string
) => Promise<EntityUnion>;

const SERVICE_ENTITY_TYPES: readonly (keyof typeof ServiceCategoryPlural)[] = [
  EntityType.DATABASE_SERVICE,
  EntityType.MESSAGING_SERVICE,
  EntityType.DASHBOARD_SERVICE,
  EntityType.PIPELINE_SERVICE,
  EntityType.MLMODEL_SERVICE,
  EntityType.STORAGE_SERVICE,
  EntityType.SEARCH_SERVICE,
  EntityType.API_SERVICE,
  EntityType.SECURITY_SERVICE,
  EntityType.METADATA_SERVICE,
];

const entityByFqnHandlerEntries: [string, EntityByFqnHandler][] = [
  [EntityType.TABLE, (fqn, fields) => getTableDetailsByFQN(fqn, { fields })],
  [
    EntityType.TEST_CASE,
    (fqn) =>
      getTestCaseByFqn(fqn, {
        fields: [TabSpecificField.OWNERS],
      }),
  ],
  [EntityType.TOPIC, (fqn, fields) => getTopicByFqn(fqn, { fields })],
  [EntityType.DASHBOARD, (fqn, fields) => getDashboardByFqn(fqn, { fields })],
  [EntityType.CHART, (fqn, fields) => getChartByFqn(fqn, { fields })],
  [EntityType.PIPELINE, (fqn, fields) => getPipelineByFqn(fqn, { fields })],
  [EntityType.MLMODEL, (fqn, fields) => getMlModelByFQN(fqn, { fields })],
  [
    EntityType.DATABASE,
    (fqn) =>
      getDatabaseDetailsByFQN(fqn, {
        fields: TabSpecificField.OWNERS,
      }),
  ],
  [
    EntityType.DATABASE_SCHEMA,
    (fqn) =>
      getDatabaseSchemaDetailsByFQN(fqn, {
        fields: TabSpecificField.OWNERS,
        include: Include.All,
      }),
  ],
  [
    EntityType.GLOSSARY_TERM,
    (fqn) =>
      getGlossaryTermByFQN(fqn, {
        fields: TabSpecificField.OWNERS,
      }),
  ],
  [
    EntityType.GLOSSARY,
    (fqn) =>
      getGlossariesByName(fqn, {
        fields: TabSpecificField.OWNERS,
      }),
  ],
  [
    EntityType.CONTAINER,
    (fqn) =>
      getContainerByFQN(fqn, {
        fields: TabSpecificField.OWNERS,
        include: Include.All,
      }),
  ],
  [
    EntityType.DASHBOARD_DATA_MODEL,
    (fqn, fields) => getDataModelByFqn(fqn, { fields }),
  ],
  [
    EntityType.STORED_PROCEDURE,
    (fqn, fields) => getStoredProceduresByFqn(fqn, { fields }),
  ],
  [
    EntityType.DOMAIN,
    (fqn) =>
      getDomainByName(fqn, {
        fields: TabSpecificField.OWNERS,
      }),
  ],
  [
    EntityType.DATA_PRODUCT,
    (fqn) =>
      getDataProductByName(fqn, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.DOMAINS],
      }),
  ],
  [EntityType.TAG, (fqn) => getTagByFqn(fqn)],
  [
    EntityType.API_COLLECTION,
    (fqn, fields) => getApiCollectionByFQN(fqn, { fields }),
  ],
  [
    EntityType.API_ENDPOINT,
    (fqn, fields) => getApiEndPointByFQN(fqn, { fields }),
  ],
  [
    EntityType.METRIC,
    (fqn) =>
      getMetricByFqn(fqn, {
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.DOMAINS,
        ],
      }),
  ],
  [
    EntityType.BOT,
    (fqn) =>
      getBotByName(fqn, {
        fields: [EntityType.BOT],
      }),
  ],
  [EntityType.EVENT_SUBSCRIPTION, (fqn) => getAlertsFromName(fqn)],
  [EntityType.ROLE, (fqn) => getRoleByName(fqn, '')],
  [EntityType.POLICY, (fqn) => getPolicyByName(fqn, '')],
  [EntityType.CLASSIFICATION, (fqn) => getClassificationByName(fqn)],
  [EntityType.TYPE, (fqn) => getTypeByFQN(fqn)],
  [EntityType.TEAM, (fqn) => getTeamByName(fqn)],
  [EntityType.USER, (fqn) => getUserByName(fqn)],
  [EntityType.TEST_SUITE, (fqn) => getTestSuiteByName(fqn)],
  [EntityType.KPI, (fqn) => getKPIByName(fqn)],
  [EntityType.SEARCH_INDEX, (fqn) => getSearchIndexDetailsByFQN(fqn)],
  [
    EntityType.APP_MARKET_PLACE_DEFINITION,
    (fqn) => getMarketPlaceApplicationByFqn(fqn),
  ],
  [EntityType.APPLICATION, (fqn) => getApplicationByName(fqn)],
  [EntityType.PERSONA, (fqn) => getPersonaByName(fqn)],
  [EntityType.INGESTION_PIPELINE, (fqn) => getIngestionPipelineByFqn(fqn)],
  [EntityType.SERVICE, (fqn) => getServiceByFQN(EntityType.SERVICE, fqn)],
  [EntityType.DATA_CONTRACT, (fqn) => getContract(fqn)],
  [EntityType.QUERY, (fqn) => getQueryByFqn(fqn)],
  [
    EntityType.KNOWLEDGE_PAGE,
    (fqn, fields) => getKnowledgePageByFqn(fqn, { fields }),
  ],
  [
    EntityType.KNOWLEDGE_CENTER,
    (fqn, fields) => getKnowledgePageByFqn(fqn, { fields }),
  ],
  ...SERVICE_ENTITY_TYPES.map<[string, EntityByFqnHandler]>((serviceType) => [
    serviceType,
    (fqn) => getServiceByFQN(ServiceCategoryPlural[serviceType], fqn),
  ]),
];

const entityByFqnHandlers: Record<string, EntityByFqnHandler> =
  Object.fromEntries(entityByFqnHandlerEntries);

export const getEntityByFqnUtil = (
  entityType: string,
  entityFQN: string,
  fields?: string
): Promise<EntityUnion> | null => {
  const handler = getOwnHandler(entityByFqnHandlers, entityType);

  return handler ? handler(entityFQN, fields) : null;
};
