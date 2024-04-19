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

export const COMMON_DROPDOWN_ITEMS = [
  {
    label: t('label.domain'),
    key: 'domain.displayName.keyword',
  },
  {
    label: t('label.owner'),
    key: 'owner.displayName.keyword',
  },
  {
    label: t('label.tag'),
    key: 'tags.tagFQN',
  },
  {
    label: t('label.tier'),
    key: 'tier.tagFQN',
  },
  {
    label: t('label.service'),
    key: 'service.displayName.keyword',
  },
  {
    label: t('label.service-type'),
    key: 'serviceType',
  },
];

export const TABLE_DROPDOWN_ITEMS = [
  {
    label: t('label.database'),
    key: 'database.displayName.keyword',
  },
  {
    label: t('label.schema'),
    key: 'databaseSchema.displayName.keyword',
  },
  {
    label: t('label.column'),
    key: 'columns.name.keyword',
  },
  {
    label: t('label.table-type'),
    key: 'tableType',
  },
];

export const DASHBOARD_DROPDOWN_ITEMS = [
  {
    label: t('label.data-model'),
    key: 'dataModels.displayName.keyword',
  },
  {
    label: t('label.chart'),
    key: 'charts.displayName.keyword',
  },
  {
    label: t('label.project'),
    key: 'project.keyword',
  },
];

export const DASHBOARD_DATA_MODEL_TYPE = [
  {
    label: t('label.data-model-type'),
    key: 'dataModelType',
  },
  {
    label: t('label.column'),
    key: 'columns.name.keyword',
  },
  {
    label: t('label.project'),
    key: 'project.keyword',
  },
];

export const PIPELINE_DROPDOWN_ITEMS = [
  {
    label: t('label.task'),
    key: 'tasks.displayName.keyword',
  },
];

export const SEARCH_INDEX_DROPDOWN_ITEMS = [
  {
    label: t('label.field'),
    key: 'fields.name.keyword',
  },
];

export const TOPIC_DROPDOWN_ITEMS = [
  {
    label: t('label.schema-field'),
    key: 'messageSchema.schemaFields.name',
  },
];

export const CONTAINER_DROPDOWN_ITEMS = [
  {
    label: t('label.column'),
    key: 'dataModel.columns.name.keyword',
  },
];

export const GLOSSARY_DROPDOWN_ITEMS = [
  {
    label: t('label.domain'),
    key: 'domain.displayName.keyword',
  },
  {
    label: t('label.owner'),
    key: 'owner.displayName.keyword',
  },
  {
    label: t('label.tag'),
    key: 'tags.tagFQN',
  },
  {
    label: t('label.glossary-plural'),
    key: 'glossary.name.keyword',
  },
];

export const TAG_DROPDOWN_ITEMS = [
  {
    label: t('label.domain'),
    key: 'domain.displayName.keyword',
  },
  {
    label: t('label.classification'),
    key: 'classification.name.keyword',
  },
];

export const DATA_PRODUCT_DROPDOWN_ITEMS = [
  {
    label: t('label.domain'),
    key: 'domain.displayName.keyword',
  },
  {
    label: t('label.owner'),
    key: 'owner.displayName.keyword',
  },
];

export const DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS = [
  {
    label: t('label.entity-type-plural', {
      entity: t('label.entity'),
    }),
    key: 'entityType',
  },
  {
    label: t('label.owner'),
    key: 'owner.displayName.keyword',
  },
  {
    label: t('label.tag'),
    key: 'tags.tagFQN',
  },
  {
    label: t('label.tier'),
    key: 'tier.tagFQN',
  },
  {
    label: t('label.service'),
    key: 'service.displayName.keyword',
  },
  {
    label: t('label.service-type'),
    key: 'serviceType',
  },
];

export const GLOSSARY_ASSETS_DROPDOWN_ITEMS = [
  {
    label: t('label.entity-type-plural', {
      entity: t('label.entity'),
    }),
    key: 'entityType',
  },
  {
    label: t('label.domain'),
    key: 'domain.displayName.keyword',
  },
  {
    label: t('label.owner'),
    key: 'owner.displayName.keyword',
  },
  {
    label: t('label.tag'),
    key: 'tags.tagFQN',
  },
  {
    label: t('label.tier'),
    key: 'tier.tagFQN',
  },
  {
    label: t('label.service'),
    key: 'service.displayName.keyword',
  },
  {
    label: t('label.service-type'),
    key: 'serviceType',
  },
];

export const LINEAGE_DROPDOWN_ITEMS = [
  ...COMMON_DROPDOWN_ITEMS,
  {
    label: t('label.column'),
    key: 'columns.name.keyword',
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
            field: 'owner.displayName.keyword',
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
