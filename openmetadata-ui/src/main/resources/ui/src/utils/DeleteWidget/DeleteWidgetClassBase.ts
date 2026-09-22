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
import { startCase } from 'lodash';
import { EntityType } from '../../enums/entity.enum';
import { getEntityDeleteMessage } from '../EntityDisplayPureUtils';
import i18n from '../i18next/LocalUtil';

const ENTITY_TYPE_PATH_MAP: Record<string, string> = {
  [EntityType.GLOSSARY]: 'glossaries',
  [EntityType.GLOSSARY_TERM]: 'glossaryTerms',
  [EntityType.POLICY]: 'policies',
  [EntityType.KPI]: EntityType.KPI,
  [EntityType.DASHBOARD_DATA_MODEL]: 'dashboard/datamodels',
  [EntityType.SEARCH_INDEX]: 'searchIndexes',
  [EntityType.DIRECTORY]: 'drives/directories',
  [EntityType.KNOWLEDGE_CENTER]: 'contextCenter/pages',
  [EntityType.KNOWLEDGE_PAGE]: 'contextCenter/pages',
};

const ENTITY_TYPE_PATH_GROUPS: { prefix: string; types: string[] }[] = [
  {
    prefix: 'services',
    types: [
      EntityType.DASHBOARD_SERVICE,
      EntityType.DATABASE_SERVICE,
      EntityType.MESSAGING_SERVICE,
      EntityType.PIPELINE_SERVICE,
      EntityType.METADATA_SERVICE,
      EntityType.STORAGE_SERVICE,
      EntityType.MLMODEL_SERVICE,
      EntityType.SEARCH_SERVICE,
      EntityType.API_SERVICE,
      EntityType.DRIVE_SERVICE,
    ],
  },
  {
    prefix: 'dataQuality',
    types: [EntityType.TEST_SUITE, EntityType.TEST_CASE],
  },
  {
    prefix: 'events',
    types: [EntityType.SUBSCRIPTION],
  },
  {
    prefix: 'drives',
    types: [EntityType.FILE, EntityType.SPREADSHEET, EntityType.WORKSHEET],
  },
];

class DeleteWidgetClassBase {
  public prepareEntityType(entityType: string) {
    const staticPath = ENTITY_TYPE_PATH_MAP[entityType];
    if (staticPath) {
      return staticPath;
    }

    const group = ENTITY_TYPE_PATH_GROUPS.find((item) =>
      item.types.includes(entityType)
    );
    if (group) {
      return `${group.prefix}/${entityType}s`;
    }

    return `${entityType}s`;
  }

  public getDeleteMessage(
    entityName: string,
    entityType: string,
    softDelete = false
  ) {
    const softDeleteText = i18n.t('message.soft-delete-message-for-entity', {
      entity: entityName,
    });
    const hardDeleteText = getEntityDeleteMessage(startCase(entityType), '');

    return softDelete ? softDeleteText : hardDeleteText;
  }
}

const deleteWidgetClassBase = new DeleteWidgetClassBase();

export default deleteWidgetClassBase;
export { DeleteWidgetClassBase };
