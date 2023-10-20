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
import { MapPatchAPIResponse } from '../../components/Assets/AssetsSelectionModal/AssetSelectionModal.interface';
import { AssetsOfEntity } from '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
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
  getDataModelsByName,
  patchDataModelDetails,
} from '../../rest/dataModelsAPI';
import {
  getGlossariesByName,
  getGlossaryTermByFQN,
  patchGlossaries,
  patchGlossaryTerm,
} from '../../rest/glossaryAPI';
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
  getStoredProceduresByName,
  patchStoredProceduresDetails,
} from '../../rest/storedProceduresAPI';
import { getTableDetailsByFQN, patchTableDetails } from '../../rest/tableAPI';
import { getTeamByName, patchTeamDetail } from '../../rest/teamsAPI';
import { getTopicByFqn, patchTopicDetails } from '../../rest/topicsAPI';
import { getServiceCategoryFromEntityType } from '../../utils/ServiceUtils';

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
    case EntityType.DATABASE_SCHEMA:
      return patchDatabaseSchemaDetails;
    case EntityType.DATABASE:
      return patchDatabaseDetails;
    case EntityType.TEAM:
      return patchTeamDetail;
    case EntityType.MESSAGING_SERVICE:
    case EntityType.DASHBOARD_SERVICE:
    case EntityType.PIPELINE_SERVICE:
    case EntityType.MLMODEL_SERVICE:
    case EntityType.STORAGE_SERVICE:
    case EntityType.DATABASE_SERVICE:
    case EntityType.SEARCH_SERVICE:
      return (id, queryFields) => {
        const serviceCat = getServiceCategoryFromEntityType(source);

        return patchDomainSupportedService(serviceCat, id, queryFields);
      };
  }
};

export const getEntityAPIfromSource = (
  source: keyof MapPatchAPIResponse
): ((
  id: string,
  queryFields: string | string[]
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
      return getStoredProceduresByName;
    case EntityType.DASHBOARD_DATA_MODEL:
      return getDataModelsByName;
    case EntityType.GLOSSARY_TERM:
      return getGlossaryTermByFQN;
    case EntityType.GLOSSARY:
      return getGlossariesByName;
    case EntityType.DATABASE_SCHEMA:
      return getDatabaseSchemaDetailsByFQN;
    case EntityType.DATABASE:
      return getDatabaseDetailsByFQN;
    case EntityType.SEARCH_INDEX:
      return getSearchIndexDetailsByFQN;
    case EntityType.TEAM:
      return getTeamByName;
    case EntityType.MESSAGING_SERVICE:
    case EntityType.DASHBOARD_SERVICE:
    case EntityType.PIPELINE_SERVICE:
    case EntityType.MLMODEL_SERVICE:
    case EntityType.STORAGE_SERVICE:
    case EntityType.DATABASE_SERVICE:
    case EntityType.SEARCH_SERVICE:
      return (id, queryFields) => {
        const serviceCat = getServiceCategoryFromEntityType(source);

        return getDomainSupportedServiceByFQN(serviceCat, id, queryFields);
      };
  }
};

export const getAssetsSearchIndex = (source: AssetsOfEntity) => {
  const commonAssets: Record<string, SearchIndex> = {
    [EntityType.TABLE]: SearchIndex.TABLE,
    [EntityType.PIPELINE]: SearchIndex.PIPELINE,
    [EntityType.DASHBOARD]: SearchIndex.DASHBOARD,
    [EntityType.MLMODEL]: SearchIndex.MLMODEL,
    [EntityType.TOPIC]: SearchIndex.TOPIC,
    [EntityType.CONTAINER]: SearchIndex.CONTAINER,
    [EntityType.STORED_PROCEDURE]: SearchIndex.STORED_PROCEDURE,
    [EntityType.DASHBOARD_DATA_MODEL]: SearchIndex.DASHBOARD_DATA_MODEL,
    [EntityType.SEARCH_INDEX]: SearchIndex.SEARCH_INDEX,
    [EntityType.DATABASE_SERVICE]: SearchIndex.DATABASE_SERVICE,
    [EntityType.MESSAGING_SERVICE]: SearchIndex.MESSAGING_SERVICE,
    [EntityType.DASHBOARD_SERVICE]: SearchIndex.DASHBOARD_SERVICE,
    [EntityType.PIPELINE_SERVICE]: SearchIndex.PIPELINE_SERVICE,
    [EntityType.MLMODEL_SERVICE]: SearchIndex.ML_MODEL_SERVICE,
    [EntityType.STORAGE_SERVICE]: SearchIndex.STORAGE_SERVICE,
    [EntityType.SEARCH_SERVICE]: SearchIndex.SEARCH_SERVICE,
  };

  if (
    source === AssetsOfEntity.DOMAIN ||
    source === AssetsOfEntity.DATA_PRODUCT
  ) {
    commonAssets[EntityType.GLOSSARY] = SearchIndex.GLOSSARY;
  }

  return commonAssets;
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
