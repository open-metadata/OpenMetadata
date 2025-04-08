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
import { EntityType } from '../../enums/entity.enum';
import { getEntityDeleteMessage } from '../CommonUtils';
import { getTitleCase } from '../EntityUtils';
import i18n from '../i18next/LocalUtil';

class DeleteWidgetClassBase {
  public prepareEntityType(entityType: string) {
    const services = [
      EntityType.DASHBOARD_SERVICE,
      EntityType.DATABASE_SERVICE,
      EntityType.MESSAGING_SERVICE,
      EntityType.PIPELINE_SERVICE,
      EntityType.METADATA_SERVICE,
      EntityType.STORAGE_SERVICE,
      EntityType.MLMODEL_SERVICE,
      EntityType.SEARCH_SERVICE,
      EntityType.API_SERVICE,
    ];

    const dataQuality = [EntityType.TEST_SUITE, EntityType.TEST_CASE];

    if (services.includes((entityType || '') as EntityType)) {
      return `services/${entityType}s`;
    } else if (entityType === EntityType.GLOSSARY) {
      return `glossaries`;
    } else if (entityType === EntityType.GLOSSARY_TERM) {
      return `glossaryTerms`;
    } else if (entityType === EntityType.POLICY) {
      return 'policies';
    } else if (entityType === EntityType.KPI) {
      return entityType;
    } else if (entityType === EntityType.DASHBOARD_DATA_MODEL) {
      return `dashboard/datamodels`;
    } else if (dataQuality.includes(entityType as EntityType)) {
      return `dataQuality/${entityType}s`;
    } else if (entityType === EntityType.SEARCH_INDEX) {
      return `searchIndexes`;
    } else if (entityType === EntityType.SUBSCRIPTION) {
      return `events/${entityType}s`;
    } else {
      return `${entityType}s`;
    }
  }

  public getDeleteMessage(
    entityName: string,
    entityType: string,
    softDelete = false
  ) {
    const softDeleteText = i18n.t('message.soft-delete-message-for-entity', {
      entity: entityName,
    });
    const hardDeleteText = getEntityDeleteMessage(getTitleCase(entityType), '');

    return softDelete ? softDeleteText : hardDeleteText;
  }
}

const deleteWidgetClassBase = new DeleteWidgetClassBase();

export default deleteWidgetClassBase;
export { DeleteWidgetClassBase };
