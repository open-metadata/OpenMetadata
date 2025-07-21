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

import { EntityFields } from '../enums/AdvancedSearch.enum';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { LabelType } from '../generated/type/tagLabel';
import { t } from '../utils/i18next/LocalUtil';

export const COMMON_DROPDOWN_ITEMS = [
  {
    label: t('label.domain-plural'),
    key: EntityFields.DOMAINS,
  },
  {
    label: t('label.owner-plural'),
    key: EntityFields.OWNERS,
  },
  {
    label: t('label.tag'),
    key: EntityFields.TAG,
  },
  {
    label: t('label.tier'),
    key: EntityFields.TIER,
  },
  {
    label: t('label.service'),
    key: EntityFields.SERVICE,
  },
  {
    label: t('label.service-type'),
    key: EntityFields.SERVICE_TYPE,
  },
];

export const DATA_ASSET_DROPDOWN_ITEMS = [
  {
    label: t('label.data-asset-plural'),
    key: EntityFields.ENTITY_TYPE,
  },
  {
    label: t('label.domain-plural'),
    key: EntityFields.DOMAINS,
  },
  {
    label: t('label.owner-plural'),
    key: EntityFields.OWNERS,
  },
  {
    label: t('label.tag'),
    key: EntityFields.TAG,
  },
  {
    label: t('label.tier'),
    key: EntityFields.TIER,
  },
  {
    label: t('label.certification'),
    key: EntityFields.CERTIFICATION,
  },
  {
    label: t('label.service'),
    key: EntityFields.SERVICE,
  },
  {
    label: t('label.service-type'),
    key: EntityFields.SERVICE_TYPE,
  },
];

export const TABLE_DROPDOWN_ITEMS = [
  {
    label: t('label.database'),
    key: EntityFields.DATABASE,
  },
  {
    label: t('label.schema'),
    key: EntityFields.DATABASE_SCHEMA,
  },
  {
    label: t('label.column'),
    key: EntityFields.COLUMN,
  },
  {
    label: t('label.table-type'),
    key: EntityFields.TABLE_TYPE,
  },
  {
    label: t('label.column-description'),
    key: EntityFields.COLUMN_DESCRIPTION_STATUS,
  },
];

export const DASHBOARD_DROPDOWN_ITEMS = [
  {
    label: t('label.data-model'),
    key: EntityFields.DATA_MODEL,
  },
  {
    label: t('label.chart'),
    key: EntityFields.CHART,
  },
  {
    label: t('label.project'),
    key: EntityFields.PROJECT,
  },
];

export const DASHBOARD_DATA_MODEL_TYPE = [
  {
    label: t('label.data-model-type'),
    key: EntityFields.DATA_MODEL_TYPE,
  },
  {
    label: t('label.column'),
    key: EntityFields.COLUMN,
  },
  {
    label: t('label.project'),
    key: EntityFields.PROJECT,
  },
];

export const PIPELINE_DROPDOWN_ITEMS = [
  {
    label: t('label.task'),
    key: EntityFields.TASK,
  },
];

export const SEARCH_INDEX_DROPDOWN_ITEMS = [
  {
    label: t('label.field'),
    key: EntityFields.FIELD,
  },
];

export const ML_MODEL_DROPDOWN_ITEMS = [
  {
    label: t('label.feature'),
    key: EntityFields.FEATURE,
  },
];

export const TOPIC_DROPDOWN_ITEMS = [
  {
    label: t('label.schema-field'),
    key: EntityFields.SCHEMA_FIELD,
  },
];
export const API_ENDPOINT_DROPDOWN_ITEMS = [
  {
    label: t('label.request-schema-field'),
    key: EntityFields.REQUEST_SCHEMA_FIELD,
  },
  {
    label: t('label.response-schema-field'),
    key: EntityFields.RESPONSE_SCHEMA_FIELD,
  },
];

export const CONTAINER_DROPDOWN_ITEMS = [
  {
    label: t('label.column'),
    key: EntityFields.CONTAINER_COLUMN,
  },
];

export const GLOSSARY_DROPDOWN_ITEMS = [
  {
    label: t('label.domain-plural'),
    key: EntityFields.DOMAINS,
  },
  {
    label: t('label.owner-plural'),
    key: EntityFields.OWNERS,
  },
  {
    label: t('label.tag'),
    key: EntityFields.TAG,
  },
  {
    label: t('label.glossary-plural'),
    key: EntityFields.GLOSSARY,
  },
  {
    label: t('label.status'),
    key: EntityFields.GLOSSARY_TERM_STATUS,
  },
];

export const TAG_DROPDOWN_ITEMS = [
  {
    label: t('label.domain-plural'),
    key: EntityFields.DOMAINS,
  },
  {
    label: t('label.classification'),
    key: EntityFields.CLASSIFICATION,
  },
];

export const DATA_PRODUCT_DROPDOWN_ITEMS = [
  {
    label: t('label.domain-plural'),
    key: EntityFields.DOMAINS,
  },
  {
    label: t('label.owner-plural'),
    key: EntityFields.OWNERS,
  },
];

export const DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS = [
  {
    label: t('label.entity-type-plural', {
      entity: t('label.entity'),
    }),
    key: EntityFields.ENTITY_TYPE,
  },
  {
    label: t('label.owner-plural'),
    key: EntityFields.OWNERS,
  },
  {
    label: t('label.tag'),
    key: EntityFields.TAG,
  },
  {
    label: t('label.tier'),
    key: EntityFields.TIER,
  },
  {
    label: t('label.service'),
    key: EntityFields.SERVICE,
  },
  {
    label: t('label.service-type'),
    key: EntityFields.SERVICE_TYPE,
  },
];

export const GLOSSARY_ASSETS_DROPDOWN_ITEMS = [
  {
    label: t('label.entity-type-plural', {
      entity: t('label.entity'),
    }),
    key: EntityFields.ENTITY_TYPE,
  },
  {
    label: t('label.domain-plural'),
    key: EntityFields.DOMAINS,
  },
  {
    label: t('label.owner-plural'),
    key: EntityFields.OWNERS,
  },
  {
    label: t('label.tag'),
    key: EntityFields.TAG,
  },
  {
    label: t('label.tier'),
    key: EntityFields.TIER,
  },
  {
    label: t('label.service'),
    key: EntityFields.SERVICE,
  },
  {
    label: t('label.service-type'),
    key: EntityFields.SERVICE_TYPE,
  },
];

export const LINEAGE_DROPDOWN_ITEMS = [
  ...COMMON_DROPDOWN_ITEMS,
  {
    label: t('label.column'),
    key: EntityFields.COLUMN,
  },
];

export const TEXT_FIELD_OPERATORS = [
  'equal',
  'not_equal',
  'like',
  'not_like',
  'is_null',
  'is_not_null',
];

export const RANGE_FIELD_OPERATORS = ['between', 'not_between'];

export const LIST_VALUE_OPERATORS = ['select_equals', 'select_not_equals'];

export const NULL_CHECK_OPERATORS = ['is_null', 'is_not_null'];

export const MISC_FIELDS = ['owner.displayName', 'tags.tagFQN'];

export const OWNER_QUICK_FILTER_DEFAULT_OPTIONS_KEY = 'displayName.keyword';

export const NULL_OPTION_KEY = 'OM_NULL_FIELD';

export const SEARCH_INDICES_WITH_COLUMNS_FIELD = [
  SearchIndex.TABLE,
  SearchIndex.DASHBOARD_DATA_MODEL,
  SearchIndex.DATA_ASSET,
  SearchIndex.ALL,
];

export const TAG_LABEL_TYPE_LIST_VALUES = {
  [LabelType.Manual]: t('label.manual'),
  [LabelType.Derived]: t('label.derived'),
  [LabelType.Propagated]: t('label.propagated'),
  [LabelType.Automated]: t('label.automated'),
  [LabelType.Generated]: t('label.generated'),
};

export const CURATED_ASSETS_LIST = [
  EntityType.ALL,
  EntityType.API_COLLECTION,
  EntityType.API_ENDPOINT,
  EntityType.CHART,
  EntityType.CONTAINER,
  EntityType.DASHBOARD,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.DATABASE,
  EntityType.DATABASE_SCHEMA,
  EntityType.GLOSSARY_TERM,
  EntityType.METRIC,
  EntityType.MLMODEL,
  EntityType.PIPELINE,
  EntityType.SEARCH_INDEX,
  EntityType.STORED_PROCEDURE,
  EntityType.TABLE,
  EntityType.TOPIC,
];
