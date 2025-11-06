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
import { Operation } from 'fast-json-patch';
import { EntityType } from '../enums/entity.enum';
import { patchApiCollection } from '../rest/apiCollectionsAPI';
import { patchApiEndPoint } from '../rest/apiEndpointsAPI';
import { patchChartDetails } from '../rest/chartsAPI';
import { patchDashboardDetails } from '../rest/dashboardAPI';
import {
  patchDatabaseDetails,
  patchDatabaseSchemaDetails,
} from '../rest/databaseAPI';
import { patchDataModelDetails } from '../rest/dataModelsAPI';
import { patchDataProduct } from '../rest/dataProductAPI';
import { patchMlModelDetails } from '../rest/mlModelAPI';
import { patchPipelineDetails } from '../rest/pipelineAPI';
import { patchSearchIndexDetails } from '../rest/SearchIndexAPI';
import { patchContainerDetails } from '../rest/storageAPI';
import { patchStoredProceduresDetails } from '../rest/storedProceduresAPI';
import { patchTableDetails } from '../rest/tableAPI';
import { patchTopicDetails } from '../rest/topicsAPI';

type PatchAPIFunction = (id: string, patch: Operation[]) => Promise<any>;

class EntityPatchClassBase {
  protected ENTITY_PATCH_API_MAP: Record<EntityType, PatchAPIFunction> = {
    [EntityType.TABLE]: patchTableDetails,
    [EntityType.DASHBOARD]: patchDashboardDetails,
    [EntityType.TOPIC]: patchTopicDetails,
    [EntityType.PIPELINE]: patchPipelineDetails,
    [EntityType.MLMODEL]: patchMlModelDetails,
    [EntityType.CHART]: patchChartDetails,
    [EntityType.API_COLLECTION]: patchApiCollection,
    [EntityType.API_ENDPOINT]: patchApiEndPoint,
    [EntityType.DATABASE]: patchDatabaseDetails,
    [EntityType.DATABASE_SCHEMA]: patchDatabaseSchemaDetails,
    [EntityType.STORED_PROCEDURE]: patchStoredProceduresDetails,
    [EntityType.CONTAINER]: patchContainerDetails,
    [EntityType.DASHBOARD_DATA_MODEL]: patchDataModelDetails,
    [EntityType.SEARCH_INDEX]: patchSearchIndexDetails,
    [EntityType.DATA_PRODUCT]: patchDataProduct,
  } as Record<EntityType, PatchAPIFunction>;

  public getEntityPatchAPI(entityType?: EntityType): PatchAPIFunction {
    if (!entityType) {
      throw new Error('Entity type is required');
    }

    const api = this.ENTITY_PATCH_API_MAP[entityType];

    if (!api) {
      throw new Error(`No patch API available for entity type: ${entityType}`);
    }

    return api;
  }
}

const entityPatchClassBase = new EntityPatchClassBase();

export default entityPatchClassBase;
export { EntityPatchClassBase };
