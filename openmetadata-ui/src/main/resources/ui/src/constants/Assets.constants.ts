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
import { AssetsUnion } from '../components/Assets/AssetsSelectionModal/AssetSelectionModal.interface';
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
    value: SearchIndex.GLOSSARY,
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
    label: i18n.t('label.chart'),
    key: EntityType.CHART,
    value: SearchIndex.CHART,
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

export const ASSET_SUB_MENU_FILTER: Array<{
  label: string;
  key: EntityType;
  children: {
    label: string;
    value: EntityType;
    key: SearchIndex;
  }[];
}> = [
  {
    key: EntityType.DOMAIN,
    label: i18n.t('label.domain-plural'),
    children: [
      {
        key: SearchIndex.DOMAIN,
        label: i18n.t('label.domain-plural'),
        value: EntityType.DOMAIN,
      },
      {
        key: SearchIndex.DATA_PRODUCT,
        label: i18n.t('label.data-product-plural'),
        value: EntityType.DATA_PRODUCT,
      },
    ],
  },
  {
    label: i18n.t('label.database-plural'),
    key: EntityType.DATABASE,
    children: [
      {
        label: i18n.t('label.entity-service', {
          entity: i18n.t('label.database'),
        }),
        value: EntityType.SEARCH_SERVICE,
        key: SearchIndex.DATABASE_SERVICE,
      },
      {
        key: SearchIndex.DATABASE,
        label: i18n.t('label.database'),
        value: EntityType.DATABASE,
      },
      {
        key: SearchIndex.DATABASE_SCHEMA,
        label: i18n.t('label.database-schema'),
        value: EntityType.DATABASE_SCHEMA,
      },
      {
        key: SearchIndex.TABLE,
        label: i18n.t('label.table'),
        value: EntityType.TABLE,
      },
      {
        key: SearchIndex.STORED_PROCEDURE,
        label: i18n.t('label.stored-procedure'),
        value: EntityType.STORED_PROCEDURE,
      },
    ],
  },
  {
    key: EntityType.TOPIC,
    label: i18n.t('label.messaging-plural'),
    children: [
      {
        key: SearchIndex.MESSAGING_SERVICE,
        label: i18n.t('label.entity-service', {
          entity: i18n.t('label.messaging'),
        }),
        value: EntityType.MESSAGING_SERVICE,
      },
      {
        key: SearchIndex.TOPIC,
        label: i18n.t('label.topic'),
        value: EntityType.TOPIC,
      },
    ],
  },
  {
    key: EntityType.DASHBOARD,
    label: i18n.t('label.dashboard-plural'),
    children: [
      {
        key: SearchIndex.DASHBOARD_SERVICE,
        label: i18n.t('label.entity-service', {
          entity: i18n.t('label.dashboard'),
        }),
        value: EntityType.DASHBOARD_SERVICE,
      },
      {
        key: SearchIndex.DASHBOARD,
        label: i18n.t('label.dashboard'),
        value: EntityType.DASHBOARD,
      },
      {
        key: SearchIndex.CHART,
        label: i18n.t('label.chart'),
        value: EntityType.CHART,
      },
      {
        key: SearchIndex.DASHBOARD_DATA_MODEL,
        label: i18n.t('label.dashboard-data-model-plural'),
        value: EntityType.DASHBOARD_DATA_MODEL,
      },
    ],
  },
  {
    key: EntityType.MLMODEL,
    label: i18n.t('label.machine-learning'),
    children: [
      {
        key: SearchIndex.ML_MODEL_SERVICE,
        label: i18n.t('label.entity-service', {
          entity: i18n.t('label.ml-model'),
        }),
        value: EntityType.MLMODEL_SERVICE,
      },
      {
        key: SearchIndex.MLMODEL,
        label: i18n.t('label.ml-model'),
        value: EntityType.MLMODEL,
      },
    ],
  },
  {
    key: EntityType.PIPELINE,
    label: i18n.t('label.pipeline-plural'),
    children: [
      {
        key: SearchIndex.PIPELINE_SERVICE,
        label: i18n.t('label.entity-service', {
          entity: i18n.t('label.pipeline'),
        }),
        value: EntityType.PIPELINE_SERVICE,
      },
      {
        key: SearchIndex.PIPELINE,
        label: i18n.t('label.pipeline'),
        value: EntityType.PIPELINE,
      },
    ],
  },
  {
    key: EntityType.CONTAINER,
    label: i18n.t('label.storage'),
    children: [
      {
        key: SearchIndex.STORAGE_SERVICE,
        label: i18n.t('label.entity-service', {
          entity: i18n.t('label.storage'),
        }),
        value: EntityType.STORAGE_SERVICE,
      },
      {
        key: SearchIndex.CONTAINER,
        label: i18n.t('label.container'),
        value: EntityType.CONTAINER,
      },
    ],
  },
  {
    key: EntityType.SEARCH_INDEX,
    label: i18n.t('label.search'),
    children: [
      {
        key: SearchIndex.SEARCH_SERVICE,
        label: i18n.t('label.entity-service', {
          entity: i18n.t('label.search'),
        }),
        value: EntityType.SEARCH_SERVICE,
      },
      {
        key: SearchIndex.SEARCH_INDEX,
        label: i18n.t('label.search-index'),
        value: EntityType.SEARCH_INDEX,
      },
    ],
  },
  {
    key: EntityType.GOVERN,
    label: i18n.t('label.governance'),
    children: [
      {
        key: SearchIndex.GLOSSARY,
        label: i18n.t('label.glossary-plural'),
        value: EntityType.GLOSSARY,
      },
      {
        key: SearchIndex.TAG,
        label: i18n.t('label.tag-plural'),
        value: EntityType.TAG,
      },
    ],
  },
];

export const ASSETS_INDEXES = [
  SearchIndex.TABLE,
  SearchIndex.TOPIC,
  SearchIndex.DASHBOARD,
  SearchIndex.PIPELINE,
  SearchIndex.MLMODEL,
  SearchIndex.CONTAINER,
  SearchIndex.STORED_PROCEDURE,
  SearchIndex.DASHBOARD_DATA_MODEL,
  SearchIndex.DATABASE,
  SearchIndex.DATABASE_SCHEMA,
  SearchIndex.SEARCH_INDEX,
  SearchIndex.DATABASE_SERVICE,
  SearchIndex.MESSAGING_SERVICE,
  SearchIndex.DASHBOARD_SERVICE,
  SearchIndex.ML_MODEL_SERVICE,
  SearchIndex.PIPELINE_SERVICE,
  SearchIndex.STORAGE_SERVICE,
  SearchIndex.SEARCH_SERVICE,
  SearchIndex.DOMAIN,
  SearchIndex.DATA_PRODUCT,
  SearchIndex.CHART,
  SearchIndex.TAG,
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
