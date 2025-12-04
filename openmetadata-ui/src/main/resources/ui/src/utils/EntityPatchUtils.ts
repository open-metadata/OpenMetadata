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
import { patchApplication } from '../rest/applicationAPI';
import { patchChartDetails } from '../rest/chartsAPI';
import { patchDashboardDetails } from '../rest/dashboardAPI';
import {
  patchDatabaseDetails,
  patchDatabaseSchemaDetails,
} from '../rest/databaseAPI';
import { patchDataModelDetails } from '../rest/dataModelsAPI';
import { patchDataProduct } from '../rest/dataProductAPI';
import { patchDomains } from '../rest/domainAPI';
import { patchDriveAssetDetails } from '../rest/driveAPI';
import { patchGlossaries, patchGlossaryTerm } from '../rest/glossaryAPI';
import { patchKPI } from '../rest/KpiAPI';
import { patchMetric } from '../rest/metricsAPI';
import { patchMlModelDetails } from '../rest/mlModelAPI';
import { patchPipelineDetails } from '../rest/pipelineAPI';
import { patchQueries } from '../rest/queryAPI';
import { patchPolicy, patchRole } from '../rest/rolesAPIV1';
import { patchSearchIndexDetails } from '../rest/SearchIndexAPI';
import { patchService } from '../rest/serviceAPI';
import { patchContainerDetails } from '../rest/storageAPI';
import { patchStoredProceduresDetails } from '../rest/storedProceduresAPI';
import { patchTableDetails } from '../rest/tableAPI';
import { patchClassification, patchTag } from '../rest/tagAPI';
import { patchTeamDetail } from '../rest/teamsAPI';
import { patchTopicDetails } from '../rest/topicsAPI';

type PatchAPIFunction = (id: string, patch: Operation[]) => Promise<any>;

class EntityPatchClassBase {
  protected ENTITY_PATCH_API_MAP: Partial<
    Record<EntityType, PatchAPIFunction>
  > = {
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
    [EntityType.METRIC]: patchMetric,
    [EntityType.GLOSSARY]: patchGlossaries,
    [EntityType.GLOSSARY_TERM]: patchGlossaryTerm,
    [EntityType.DOMAIN]: patchDomains,
    [EntityType.TAG]: patchTag,
    [EntityType.DIRECTORY]: (id: string, patch: Operation[]) =>
      patchDriveAssetDetails(id, patch, EntityType.DIRECTORY),
    [EntityType.FILE]: (id: string, patch: Operation[]) =>
      patchDriveAssetDetails(id, patch, EntityType.FILE),
    [EntityType.SPREADSHEET]: (id: string, patch: Operation[]) =>
      patchDriveAssetDetails(id, patch, EntityType.SPREADSHEET),
    [EntityType.WORKSHEET]: (id: string, patch: Operation[]) =>
      patchDriveAssetDetails(id, patch, EntityType.WORKSHEET),
    [EntityType.DATABASE_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('databaseServices', id, patch),
    [EntityType.DASHBOARD_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('dashboardServices', id, patch),
    [EntityType.MESSAGING_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('messagingServices', id, patch),
    [EntityType.PIPELINE_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('pipelineServices', id, patch),
    [EntityType.MLMODEL_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('mlmodelServices', id, patch),
    [EntityType.METADATA_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('metadataServices', id, patch),
    [EntityType.STORAGE_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('storageServices', id, patch),
    [EntityType.SEARCH_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('searchServices', id, patch),
    [EntityType.API_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('apiServices', id, patch),
    [EntityType.SECURITY_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('securityServices', id, patch),
    [EntityType.DRIVE_SERVICE]: (id: string, patch: Operation[]) =>
      patchService('driveServices', id, patch),
    [EntityType.KPI]: patchKPI,
    [EntityType.APPLICATION]: patchApplication,
    [EntityType.QUERY]: patchQueries,
    [EntityType.ROLE]: (id: string, patch: Operation[]) => patchRole(patch, id),
    [EntityType.POLICY]: (id: string, patch: Operation[]) =>
      patchPolicy(patch, id),
    [EntityType.CLASSIFICATION]: patchClassification,
    [EntityType.TEAM]: patchTeamDetail,
  };

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
