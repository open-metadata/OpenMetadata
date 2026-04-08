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
import apiCollectionIconUrl from '../../../assets/svg/ic-api-collection-default.svg';
import apiEndpointIconUrl from '../../../assets/svg/ic-api-endpoint-default.svg';
import dashboardIconUrl from '../../../assets/svg/ic-dashboard.svg';
import dataProductIconUrl from '../../../assets/svg/ic-data-product.svg';
import databaseIconUrl from '../../../assets/svg/ic-database.svg';
import directoryIconUrl from '../../../assets/svg/ic-directory.svg';
import fileIconUrl from '../../../assets/svg/ic-file.svg';
import mlModelIconUrl from '../../../assets/svg/ic-ml-model.svg';
import pipelineIconUrl from '../../../assets/svg/ic-pipeline.svg';
import schemaIconUrl from '../../../assets/svg/ic-schema.svg';
import searchIndexIconUrl from '../../../assets/svg/ic-search.svg';
import spreadsheetIconUrl from '../../../assets/svg/ic-spreadsheet.svg';
import containerIconUrl from '../../../assets/svg/ic-storage.svg';
import storedProcedureIconUrl from '../../../assets/svg/ic-stored-procedure.svg';
import tableIconUrl from '../../../assets/svg/ic-table.svg';
import topicIconUrl from '../../../assets/svg/ic-topic.svg';
import worksheetIconUrl from '../../../assets/svg/ic-worksheet.svg';
import metricIconUrl from '../../../assets/svg/metric.svg';
import { EntityType } from '../../../enums/entity.enum';

export const ENTITY_TYPE_ICON_URL_MAP: Record<string, string> = {
  [EntityType.TABLE]: tableIconUrl,
  [EntityType.DASHBOARD]: dashboardIconUrl,
  [EntityType.PIPELINE]: pipelineIconUrl,
  [EntityType.TOPIC]: topicIconUrl,
  [EntityType.MLMODEL]: mlModelIconUrl,
  [EntityType.CONTAINER]: containerIconUrl,
  [EntityType.DATABASE_SCHEMA]: schemaIconUrl,
  [EntityType.DATABASE]: databaseIconUrl,
  [EntityType.DATA_PRODUCT]: dataProductIconUrl,
  [EntityType.API_COLLECTION]: apiCollectionIconUrl,
  [EntityType.API_ENDPOINT]: apiEndpointIconUrl,
  [EntityType.METRIC]: metricIconUrl,
  [EntityType.STORED_PROCEDURE]: storedProcedureIconUrl,
  [EntityType.SEARCH_INDEX]: searchIndexIconUrl,
  [EntityType.DIRECTORY]: directoryIconUrl,
  [EntityType.FILE]: fileIconUrl,
  [EntityType.SPREADSHEET]: spreadsheetIconUrl,
  [EntityType.WORKSHEET]: worksheetIconUrl,
};

export function getEntityIconUrl(entityType?: string): string | undefined {
  return entityType ? ENTITY_TYPE_ICON_URL_MAP[entityType] : undefined;
}
