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
import { getBotByName, getUserByName } from '../rest/userAPI';

export const getEntityByFqnUtil = (
  entityType: string,
  entityFQN: string,
  fields?: string
): Promise<EntityUnion> | null => {
  switch (entityType) {
    case EntityType.TABLE:
      return getTableDetailsByFQN(entityFQN, { fields });

    case EntityType.TEST_CASE:
      return getTestCaseByFqn(entityFQN, {
        fields: [TabSpecificField.OWNERS],
      });

    case EntityType.TOPIC:
      return getTopicByFqn(entityFQN, { fields });

    case EntityType.DASHBOARD:
      return getDashboardByFqn(entityFQN, { fields });

    case EntityType.CHART:
      return getChartByFqn(entityFQN, { fields });

    case EntityType.PIPELINE:
      return getPipelineByFqn(entityFQN, { fields });

    case EntityType.MLMODEL:
      return getMlModelByFQN(entityFQN, { fields });

    case EntityType.DATABASE:
      return getDatabaseDetailsByFQN(entityFQN, {
        fields: TabSpecificField.OWNERS,
      });

    case EntityType.DATABASE_SCHEMA:
      return getDatabaseSchemaDetailsByFQN(entityFQN, {
        fields: TabSpecificField.OWNERS,
        include: Include.All,
      });

    case EntityType.GLOSSARY_TERM:
      return getGlossaryTermByFQN(entityFQN, {
        fields: TabSpecificField.OWNERS,
      });

    case EntityType.GLOSSARY:
      return getGlossariesByName(entityFQN, {
        fields: TabSpecificField.OWNERS,
      });

    case EntityType.CONTAINER:
      return getContainerByFQN(entityFQN, {
        fields: TabSpecificField.OWNERS,
        include: Include.All,
      });

    case EntityType.DASHBOARD_DATA_MODEL:
      return getDataModelByFqn(entityFQN, { fields });

    case EntityType.STORED_PROCEDURE:
      return getStoredProceduresByFqn(entityFQN, { fields });

    case EntityType.DOMAIN:
      return getDomainByName(entityFQN, {
        fields: TabSpecificField.OWNERS,
      });

    case EntityType.DATA_PRODUCT:
      return getDataProductByName(entityFQN, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.DOMAINS],
      });

    case EntityType.TAG:
      return getTagByFqn(entityFQN);

    case EntityType.API_COLLECTION:
      return getApiCollectionByFQN(entityFQN, { fields });

    case EntityType.API_ENDPOINT:
      return getApiEndPointByFQN(entityFQN, { fields });

    case EntityType.METRIC:
      return getMetricByFqn(entityFQN, {
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.DOMAINS,
        ],
      });

    case EntityType.BOT:
      return getBotByName(entityFQN, {
        fields: [EntityType.BOT],
      });

    case EntityType.EVENT_SUBSCRIPTION:
      return getAlertsFromName(entityFQN);

    case EntityType.ROLE:
      return getRoleByName(entityFQN, '');

    case EntityType.POLICY:
      return getPolicyByName(entityFQN, '');

    case EntityType.CLASSIFICATION:
      return getClassificationByName(entityFQN);

    case EntityType.DATABASE_SERVICE:
    case EntityType.MESSAGING_SERVICE:
    case EntityType.DASHBOARD_SERVICE:
    case EntityType.PIPELINE_SERVICE:
    case EntityType.MLMODEL_SERVICE:
    case EntityType.STORAGE_SERVICE:
    case EntityType.SEARCH_SERVICE:
    case EntityType.API_SERVICE:
    case EntityType.SECURITY_SERVICE:
    case EntityType.METADATA_SERVICE:
      return getServiceByFQN(ServiceCategoryPlural[entityType], entityFQN);

    case EntityType.TYPE:
      return getTypeByFQN(entityFQN);

    case EntityType.TEAM:
      return getTeamByName(entityFQN);

    case EntityType.USER:
      return getUserByName(entityFQN);

    case EntityType.TEST_SUITE:
      return getTestSuiteByName(entityFQN);

    case EntityType.KPI:
      return getKPIByName(entityFQN);

    case EntityType.SEARCH_INDEX:
      return getSearchIndexDetailsByFQN(entityFQN);

    case EntityType.APP_MARKET_PLACE_DEFINITION:
      return getMarketPlaceApplicationByFqn(entityFQN);

    case EntityType.APPLICATION:
      return getApplicationByName(entityFQN);

    case EntityType.PERSONA:
      return getPersonaByName(entityFQN);

    case EntityType.INGESTION_PIPELINE:
      return getIngestionPipelineByFqn(entityFQN);

    case EntityType.SERVICE:
      return getServiceByFQN(EntityType.SERVICE, entityFQN);

    case EntityType.DATA_CONTRACT:
      return getContract(entityFQN);

    case EntityType.QUERY:
      return getQueryByFqn(entityFQN);

    default:
      return null;
  }
};
