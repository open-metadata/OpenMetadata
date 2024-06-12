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

import { t } from 'i18next';
import { JsonTree, Utils as QbUtils } from 'react-awesome-query-builder';
import { EntityFields } from '../enums/AdvancedSearch.enum';

export const COMMON_DROPDOWN_ITEMS = [
  {
    label: t('label.domain'),
    key: EntityFields.DOMAIN,
  },
  {
    label: t('label.owner'),
    key: EntityFields.OWNER,
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

export const CONTAINER_DROPDOWN_ITEMS = [
  {
    label: t('label.column'),
    key: EntityFields.CONTAINER_COLUMN,
  },
];

export const GLOSSARY_DROPDOWN_ITEMS = [
  {
    label: t('label.domain'),
    key: EntityFields.DOMAIN,
  },
  {
    label: t('label.owner'),
    key: EntityFields.OWNER,
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
    label: t('label.domain'),
    key: EntityFields.DOMAIN,
  },
  {
    label: t('label.classification'),
    key: EntityFields.CLASSIFICATION,
  },
];

export const DATA_PRODUCT_DROPDOWN_ITEMS = [
  {
    label: t('label.domain'),
    key: EntityFields.DOMAIN,
  },
  {
    label: t('label.owner'),
    key: EntityFields.OWNER,
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
    label: t('label.owner'),
    key: EntityFields.OWNER,
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
    label: t('label.domain'),
    key: EntityFields.DOMAIN,
  },
  {
    label: t('label.owner'),
    key: EntityFields.OWNER,
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

/**
 * Generates a query builder tree with a group containing an empty rule
 */
export const emptyJsonTree: JsonTree = {
  id: QbUtils.uuid(),
  type: 'group',
  properties: {
    conjunction: 'AND',
    not: false,
  },
  children1: {
    [QbUtils.uuid()]: {
      type: 'group',
      properties: {
        conjunction: 'AND',
        not: false,
      },
      children1: {
        [QbUtils.uuid()]: {
          type: 'rule',
          properties: {
            // owner is common field , so setting owner as default field here
            field: EntityFields.OWNER,
            operator: null,
            value: [],
            valueSrc: ['value'],
          },
        },
      },
    },
  },
};

export const MISC_FIELDS = ['owner.displayName', 'tags.tagFQN'];

export const OWNER_QUICK_FILTER_DEFAULT_OPTIONS_KEY = 'displayName.keyword';

export const NULL_OPTION_KEY = 'OM_NULL_FIELD';
