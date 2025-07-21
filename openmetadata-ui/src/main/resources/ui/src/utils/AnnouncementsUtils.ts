/*
 *  Copyright 2022 Collate.
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
import { EntityType } from '../enums/entity.enum';
import { FieldOperation } from '../generated/entity/feed/thread';
import { t } from './i18next/LocalUtil';

export const ANNOUNCEMENT_ENTITIES = [
  EntityType.TABLE,
  EntityType.DASHBOARD,
  EntityType.TOPIC,
  EntityType.PIPELINE,
  EntityType.MLMODEL,
  EntityType.CONTAINER,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.STORED_PROCEDURE,
  EntityType.SEARCH_INDEX,
  EntityType.DATABASE,
  EntityType.DATABASE_SCHEMA,
  EntityType.DATABASE_SERVICE,
  EntityType.MESSAGING_SERVICE,
  EntityType.DASHBOARD_SERVICE,
  EntityType.PIPELINE_SERVICE,
  EntityType.MLMODEL_SERVICE,
  EntityType.STORAGE_SERVICE,
  EntityType.METADATA_SERVICE,
  EntityType.SEARCH_SERVICE,
  EntityType.API_SERVICE,
  EntityType.API_COLLECTION,
  EntityType.API_ENDPOINT,
  EntityType.METRIC,
];

/* 
    @param startTime: number  -> Milliseconds
    @param endTime: number -> Milliseconds
    @returns boolean
    
*/
export const isActiveAnnouncement = (startTime: number, endTime: number) => {
  const currentTime = Date.now();

  return currentTime > startTime && currentTime < endTime;
};

export const getFieldOperationText = (operation: FieldOperation) => {
  switch (operation) {
    case FieldOperation.Added:
      return t('label.added-lowercase');
    case FieldOperation.Deleted:
      return t('label.deleted-lowercase');
    case FieldOperation.Updated:
      return t('label.updated-lowercase');
    default:
      return operation;
  }
};
