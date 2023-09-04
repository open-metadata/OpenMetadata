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
import {
  AssetsUnion,
  MapPatchAPIResponse,
} from 'components/Assets/AssetsSelectionModal/AssetSelectionModal.interface';
import { AssetsOfEntity } from 'components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { EntityType } from 'enums/entity.enum';
import { SearchIndex } from 'enums/search.enum';
import { Operation } from 'fast-json-patch';
import { getDashboardByFqn, patchDashboardDetails } from 'rest/dashboardAPI';
import { getGlossariesByName, patchGlossaries } from 'rest/glossaryAPI';
import { getMlModelByFQN, patchMlModelDetails } from 'rest/mlModelAPI';
import { getPipelineByFqn, patchPipelineDetails } from 'rest/pipelineAPI';
import { getContainerByName, patchContainerDetails } from 'rest/storageAPI';
import { getTableDetailsByFQN, patchTableDetails } from 'rest/tableAPI';
import { getTopicByFqn, patchTopicDetails } from 'rest/topicsAPI';

export const getAPIfromSource = (
  source: AssetsUnion
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
    case EntityType.GLOSSARY:
      return patchGlossaries;
  }
};

export const getEntityAPIfromSource = (
  source: AssetsUnion
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
    case EntityType.GLOSSARY:
      return getGlossariesByName;
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
  };

  if (source === AssetsOfEntity.DOMAIN) {
    commonAssets[EntityType.GLOSSARY] = SearchIndex.GLOSSARY;
  }

  return commonAssets;
};

export const getAssetsFields = (source: AssetsOfEntity) => {
  if (source === AssetsOfEntity.GLOSSARY) {
    return 'tags';
  } else {
    return 'domain';
  }
};
