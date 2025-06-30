/*
 *  Copyright 2023 Collate.
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
import { Operation } from 'fast-json-patch';
import { MapPatchAPIResponse } from '../../components/DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { AssetsOfEntity } from '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { EntityType } from '../../enums/entity.enum';
import { ListParams } from '../../interface/API.interface';
import {
  getApiCollectionByFQN,
  patchApiCollection,
} from '../../rest/apiCollectionsAPI';
import {
  getApiEndPointByFQN,
  patchApiEndPoint,
} from '../../rest/apiEndpointsAPI';
import {
  getDashboardByFqn,
  patchDashboardDetails,
} from '../../rest/dashboardAPI';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemaDetailsByFQN,
  patchDatabaseDetails,
  patchDatabaseSchemaDetails,
} from '../../rest/databaseAPI';
import {
  getDataModelByFqn,
  patchDataModelDetails,
} from '../../rest/dataModelsAPI';
import { getDomainByName, patchDomains } from '../../rest/domainAPI';
import {
  getGlossariesByName,
  getGlossaryTermByFQN,
  patchGlossaries,
  patchGlossaryTerm,
} from '../../rest/glossaryAPI';
import { getMetricByFqn, patchMetric } from '../../rest/metricsAPI';
import { getMlModelByFQN, patchMlModelDetails } from '../../rest/mlModelAPI';
import { getPipelineByFqn, patchPipelineDetails } from '../../rest/pipelineAPI';
import {
  getSearchIndexDetailsByFQN,
  patchSearchIndexDetails,
} from '../../rest/SearchIndexAPI';
import {
  getDomainSupportedServiceByFQN,
  patchDomainSupportedService,
} from '../../rest/serviceAPI';
import {
  getContainerByName,
  patchContainerDetails,
} from '../../rest/storageAPI';
import {
  getStoredProceduresByFqn,
  patchStoredProceduresDetails,
} from '../../rest/storedProceduresAPI';
import { getTableDetailsByFQN, patchTableDetails } from '../../rest/tableAPI';
import {
  getClassificationByName,
  getTagByFqn,
  patchClassification,
  patchTag,
} from '../../rest/tagAPI';
import { getTeamByName, patchTeamDetail } from '../../rest/teamsAPI';
import { getTopicByFqn, patchTopicDetails } from '../../rest/topicsAPI';
import { getUserByName, updateUserDetail } from '../../rest/userAPI';
import { getServiceCategoryFromEntityType } from '../../utils/ServiceUtils';
import { t } from '../i18next/LocalUtil';

export const getAPIfromSource = (
  source: keyof MapPatchAPIResponse
): ((
  id: string,
  jsonPatch: Operation[]
) => Promise<MapPatchAPIResponse[typeof source]>) => {
  switch (source) {
    case EntityType.TABLE:
      return patchTableDetails;
    case EntityType.DASHBOARD:
      return patchDashboardDetails;
    case EntityType.MLMODEL:
      return patchMlModelDetails;
    case EntityType.PIPELINE:
      return patchPipelineDetails;
    case EntityType.TOPIC:
      return patchTopicDetails;
    case EntityType.CONTAINER:
      return patchContainerDetails;
    case EntityType.SEARCH_INDEX:
      return patchSearchIndexDetails;
    case EntityType.STORED_PROCEDURE:
      return patchStoredProceduresDetails;
    case EntityType.DASHBOARD_DATA_MODEL:
      return patchDataModelDetails;
    case EntityType.GLOSSARY_TERM:
      return patchGlossaryTerm;
    case EntityType.GLOSSARY:
      return patchGlossaries;
    case EntityType.TAG:
      return patchTag;
    case EntityType.CLASSIFICATION:
      return patchClassification;
    case EntityType.DATABASE_SCHEMA:
      return patchDatabaseSchemaDetails;
    case EntityType.DATABASE:
      return patchDatabaseDetails;
    case EntityType.TEAM:
      return patchTeamDetail;
    case EntityType.USER:
      return updateUserDetail;
    case EntityType.API_COLLECTION:
      return patchApiCollection;
    case EntityType.API_ENDPOINT:
      return patchApiEndPoint;
    case EntityType.METRIC:
      return patchMetric;
    case EntityType.DOMAIN:
      return patchDomains;
    case EntityType.MESSAGING_SERVICE:
    case EntityType.DASHBOARD_SERVICE:
    case EntityType.PIPELINE_SERVICE:
    case EntityType.MLMODEL_SERVICE:
    case EntityType.STORAGE_SERVICE:
    case EntityType.DATABASE_SERVICE:
    case EntityType.SEARCH_SERVICE:
    case EntityType.API_SERVICE:
      return (id, queryFields) => {
        const serviceCat = getServiceCategoryFromEntityType(source);

        return patchDomainSupportedService(serviceCat, id, queryFields);
      };
  }
};

export const getEntityAPIfromSource = (
  source: keyof MapPatchAPIResponse
): ((
  fqn: string,
  params?: ListParams
) => Promise<MapPatchAPIResponse[typeof source]>) => {
  switch (source) {
    case EntityType.TABLE:
      return getTableDetailsByFQN;
    case EntityType.DASHBOARD:
      return getDashboardByFqn;
    case EntityType.MLMODEL:
      return getMlModelByFQN;
    case EntityType.PIPELINE:
      return getPipelineByFqn;
    case EntityType.TOPIC:
      return getTopicByFqn;
    case EntityType.CONTAINER:
      return getContainerByName;
    case EntityType.STORED_PROCEDURE:
      return getStoredProceduresByFqn;
    case EntityType.DASHBOARD_DATA_MODEL:
      return getDataModelByFqn;
    case EntityType.GLOSSARY_TERM:
      return getGlossaryTermByFQN;
    case EntityType.GLOSSARY:
      return getGlossariesByName;
    case EntityType.CLASSIFICATION:
      return getClassificationByName;
    case EntityType.TAG:
      return getTagByFqn;
    case EntityType.DATABASE_SCHEMA:
      return getDatabaseSchemaDetailsByFQN;
    case EntityType.DATABASE:
      return getDatabaseDetailsByFQN;
    case EntityType.SEARCH_INDEX:
      return getSearchIndexDetailsByFQN;
    case EntityType.TEAM:
      return getTeamByName;
    case EntityType.USER:
      return getUserByName;
    case EntityType.API_COLLECTION:
      return getApiCollectionByFQN;
    case EntityType.API_ENDPOINT:
      return getApiEndPointByFQN;
    case EntityType.METRIC:
      return getMetricByFqn;
    case EntityType.DOMAIN:
      return getDomainByName;
    case EntityType.MESSAGING_SERVICE:
    case EntityType.DASHBOARD_SERVICE:
    case EntityType.PIPELINE_SERVICE:
    case EntityType.MLMODEL_SERVICE:
    case EntityType.STORAGE_SERVICE:
    case EntityType.DATABASE_SERVICE:
    case EntityType.SEARCH_SERVICE:
    case EntityType.API_SERVICE:
      return (id, queryFields) => {
        const serviceCat = getServiceCategoryFromEntityType(source);

        return getDomainSupportedServiceByFQN(serviceCat, id, queryFields);
      };
  }
};

export const getAssetsFields = (source: AssetsOfEntity) => {
  if (source === AssetsOfEntity.GLOSSARY) {
    return 'tags';
  } else if (source === AssetsOfEntity.DOMAIN) {
    return 'domain';
  } else {
    return 'dataProducts';
  }
};

export function getEntityTypeString(type: string) {
  switch (type) {
    case AssetsOfEntity.GLOSSARY:
      return t('label.glossary-term-lowercase');
    case AssetsOfEntity.DOMAIN:
      return t('label.domain-lowercase');
    case AssetsOfEntity.TAG:
      return t('label.tag-lowercase');
    default:
      return t('label.data-product-lowercase');
  }
}
