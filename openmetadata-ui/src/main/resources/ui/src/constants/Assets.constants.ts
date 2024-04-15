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
import { AssetsUnion } from '../components/DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import i18n from '../utils/i18next/LocalUtil';

export const AssetsFilterOptions: Array<{
  label: string;
  key: AssetsUnion;
  value: SearchIndex;
}> = [
  {
    label: i18n.t('label.table-plural'),
    key: EntityType.TABLE,
    value: SearchIndex.TABLE,
  },
  {
    label: i18n.t('label.topic-plural'),
    key: EntityType.TOPIC,
    value: SearchIndex.TOPIC,
  },
  {
    label: i18n.t('label.dashboard-plural'),
    key: EntityType.DASHBOARD,
    value: SearchIndex.DASHBOARD,
  },
  {
    label: i18n.t('label.pipeline-plural'),
    key: EntityType.PIPELINE,
    value: SearchIndex.PIPELINE,
  },
  {
    label: i18n.t('label.ml-model-plural'),
    key: EntityType.MLMODEL,
    value: SearchIndex.MLMODEL,
  },
  {
    label: i18n.t('label.container-plural'),
    key: EntityType.CONTAINER,
    value: SearchIndex.CONTAINER,
  },
  {
    label: i18n.t('label.glossary-plural'),
    key: EntityType.GLOSSARY_TERM,
    value: SearchIndex.GLOSSARY_TERM,
  },
  {
    label: i18n.t('label.stored-procedure-plural'),
    key: EntityType.STORED_PROCEDURE,
    value: SearchIndex.STORED_PROCEDURE,
  },
  {
    label: i18n.t('label.data-model-plural'),
    key: EntityType.DASHBOARD_DATA_MODEL,
    value: SearchIndex.DASHBOARD_DATA_MODEL,
  },
  {
    label: i18n.t('label.database'),
    key: EntityType.DATABASE,
    value: SearchIndex.DATABASE,
  },
  {
    label: i18n.t('label.database-schema'),
    key: EntityType.DATABASE_SCHEMA,
    value: SearchIndex.DATABASE_SCHEMA,
  },

  {
    label: i18n.t('label.search-index'),
    key: EntityType.SEARCH_INDEX,
    value: SearchIndex.SEARCH_INDEX,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.database'),
    }),
    key: EntityType.DATABASE_SERVICE,
    value: SearchIndex.DATABASE_SERVICE,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.messaging'),
    }),
    key: EntityType.MESSAGING_SERVICE,
    value: SearchIndex.MESSAGING_SERVICE,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.dashboard'),
    }),
    key: EntityType.DASHBOARD_SERVICE,
    value: SearchIndex.DASHBOARD_SERVICE,
  },

  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.pipeline'),
    }),
    key: EntityType.PIPELINE_SERVICE,
    value: SearchIndex.PIPELINE_SERVICE,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.ml-model'),
    }),
    key: EntityType.MLMODEL_SERVICE,
    value: SearchIndex.ML_MODEL_SERVICE,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.storage'),
    }),
    key: EntityType.STORAGE_SERVICE,
    value: SearchIndex.STORAGE_SERVICE,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.search-index'),
    }),
    key: EntityType.SEARCH_SERVICE,
    value: SearchIndex.SEARCH_SERVICE,
  },
];

export const ASSET_MENU_KEYS = [
  EntityType.DOMAIN,
  EntityType.DATABASE,
  EntityType.TOPIC,
  EntityType.PIPELINE,
  EntityType.DASHBOARD,
  EntityType.MLMODEL,
  EntityType.CONTAINER,
  EntityType.SEARCH_INDEX,
  EntityType.GOVERN,
];
