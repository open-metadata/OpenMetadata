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
    switch (entityType) {
      case EntityType.DASHBOARD_SERVICE:
      case EntityType.DATABASE_SERVICE:
      case EntityType.MESSAGING_SERVICE:
      case EntityType.PIPELINE_SERVICE:
      case EntityType.METADATA_SERVICE:
      case EntityType.STORAGE_SERVICE:
      case EntityType.MLMODEL_SERVICE:
      case EntityType.SEARCH_SERVICE:
      case EntityType.API_SERVICE:
      case EntityType.DRIVE_SERVICE:
        return `services/${entityType}s`;
      case EntityType.GLOSSARY:
        return `glossaries`;
      case EntityType.GLOSSARY_TERM:
        return `glossaryTerms`;
      case EntityType.POLICY:
        return 'policies';
      case EntityType.KPI:
        return entityType;
      case EntityType.DASHBOARD_DATA_MODEL:
        return `dashboard/datamodels`;
      case EntityType.TEST_SUITE:
      case EntityType.TEST_CASE:
        return `dataQuality/${entityType}s`;
      case EntityType.SEARCH_INDEX:
        return `searchIndexes`;
      case EntityType.SUBSCRIPTION:
        return `events/${entityType}s`;
      case EntityType.DIRECTORY:
        return 'drives/directories';
      case EntityType.FILE:
      case EntityType.SPREADSHEET:
      case EntityType.WORKSHEET:
        return `drives/${entityType}s`;
      default:
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
