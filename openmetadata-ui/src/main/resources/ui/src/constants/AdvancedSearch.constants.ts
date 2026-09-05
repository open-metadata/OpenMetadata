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

/**
 * Aggregation field -> `_source` path used to recover the original casing of a
 * quick-filter option.
 *
 * Every `.keyword` field listed here is indexed through `lowercase_normalizer`,
 * so terms aggregations return lowercased bucket keys while `_source` keeps the
 * value as the user typed it. Passing the `_source` path as `sourceFields` adds
 * a `top_hits` sub-aggregation the UI reads the display label from; the bucket
 * key stays the filter value, so query building and shared URLs are unaffected.
 *
 * Fields indexed without the normalizer (`columnDescriptionStatus`, `fileType`,
 * `fileExtension`, `mlFeatures.name`) already aggregate in their original case
 * and are deliberately absent — an entry there would only cost an extra
 * `top_hits` round trip.
 */
export const QUICK_FILTER_SOURCE_FIELDS: Partial<Record<EntityFields, string>> =
  {
    [EntityFields.OWNERS]: 'ownerDisplayName',
    [EntityFields.DOMAINS]: 'domains.displayName',
    [EntityFields.DATA_PRODUCT]: 'dataProducts.displayName',
    [EntityFields.TAG]: 'tags.tagFQN',
    [EntityFields.COLUMN_TAG]: 'columns.tags.tagFQN',
    [EntityFields.TIER]: 'tier.tagFQN',
    [EntityFields.CERTIFICATION]: 'certification.tagLabel.tagFQN',
    [EntityFields.CLASSIFICATION_TAGS]: 'classificationTags',
    [EntityFields.GLOSSARY_TERMS]: 'glossaryTags',
    [EntityFields.GLOSSARY]: 'glossary.name',
    [EntityFields.CLASSIFICATION]: 'classification.name',
    [EntityFields.SERVICE]: 'service.displayName',
    [EntityFields.SERVICE_NAME]: 'service.name',
    [EntityFields.DATABASE]: 'database.displayName',
    [EntityFields.DATABASE_NAME]: 'database.name',
    [EntityFields.DATABASE_SCHEMA]: 'databaseSchema.displayName',
    [EntityFields.DATABASE_SCHEMA_NAME]: 'databaseSchema.name',
    [EntityFields.TABLE_NAME]: 'table.name',
    [EntityFields.TABLE_DISPLAY_NAME]: 'table.displayName',
    [EntityFields.COLUMN]: 'columns.name',
    [EntityFields.CONTAINER_COLUMN]: 'dataModel.columns.name',
    [EntityFields.FIELD]: 'fields.name',
    [EntityFields.SCHEMA_FIELD]: 'messageSchema.schemaFields.name',
    [EntityFields.REQUEST_SCHEMA_FIELD]: 'requestSchema.schemaFields.name',
    [EntityFields.RESPONSE_SCHEMA_FIELD]: 'responseSchema.schemaFields.name',
    [EntityFields.CHART]: 'charts.displayName',
    [EntityFields.TASK]: 'tasks.displayName',
    [EntityFields.DATA_MODEL]: 'dataModels.displayName',
    [EntityFields.API_COLLECTION]: 'apiCollection.displayName',
    [EntityFields.PARENT]: 'parent.displayName',
    [EntityFields.DIRECTORY]: 'directory.displayName',
    [EntityFields.SPREADSHEET]: 'spreadsheet.displayName',
    [EntityFields.PROJECT]: 'project',
    [EntityFields.NAME_KEYWORD]: 'name',
    [EntityFields.DISPLAY_NAME_KEYWORD]: 'displayName',
    [EntityFields.FULLY_QUALIFIED_NAME]: 'fullyQualifiedName',
    [EntityFields.SERVICE_TYPE]: 'serviceType',
    [EntityFields.DATA_MODEL_TYPE]: 'dataModelType',
    [EntityFields.DATA_PRODUCT_TYPE]: 'dataProductType',
    [EntityFields.DOMAIN_TYPE]: 'domainType',
    [EntityFields.VISIBILITY]: 'visibility',
    [EntityFields.PORTFOLIO_PRIORITY]: 'portfolioPriority',
    [EntityFields.LIFECYCLE_STAGE]: 'lifecycleStage',
    [EntityFields.TABLE_TYPE]: 'tableType',
    [EntityFields.DATA_TYPE]: 'dataType',
    [EntityFields.ENTITY_STATUS]: 'entityStatus',
  };

/**
 * Strips the classification prefix from a `tagFQN`-shaped value.
 *
 * Tier and Certification quick-filter options aggregate on `tagFQN` (e.g.
 * `Tier.Tier1`, `Certification.Gold`), but the classification name already
 * appears as the dropdown label, so repeating it inside every option adds no
 * information. This transform produces the short form (`Tier1`, `Gold`) that
 * Family B surfaces (Data Quality dashboard, Data Insight) already show via
 * `getEntityName(source)`.
 */
export const stripClassificationPrefix = (tagFQN: string): string => {
  const dotIndex = tagFQN.indexOf('.');

  return dotIndex >= 0 ? tagFQN.substring(dotIndex + 1) : tagFQN;
};

/**
 * Per-field label transforms applied after the `_source`-based label is
 * resolved. Only fields whose raw label shape differs from the desired display
 * shape need an entry here.
 */
export const QUICK_FILTER_LABEL_TRANSFORMS: Partial<
  Record<EntityFields, (label: string) => string>
> = {
  [EntityFields.TIER]: stripClassificationPrefix,
  [EntityFields.CERTIFICATION]: stripClassificationPrefix,
};

export const COMMON_DROPDOWN_ITEMS = [
  {
    label: 'label.domain-plural',
    key: EntityFields.DOMAINS,
  },
  {
    label: 'label.data-product-plural',
    key: EntityFields.DATA_PRODUCT,
  },
  {
    label: 'label.owner-plural',
    key: EntityFields.OWNERS,
  },
  {
    label: 'label.tag',
    key: EntityFields.TAG,
  },
  {
    label: 'label.tier',
    key: EntityFields.TIER,
  },
  {
    label: 'label.service',
    key: EntityFields.SERVICE,
  },
  {
    label: 'label.service-type',
    key: EntityFields.SERVICE_TYPE,
  },
];

export const DATA_ASSET_DROPDOWN_ITEMS = [
  {
    label: 'label.data-asset-plural',
    key: EntityFields.ENTITY_TYPE_KEYWORD,
  },
  {
    label: 'label.domain-plural',
    key: EntityFields.DOMAINS,
  },
  {
    label: 'label.data-product-plural',
    key: EntityFields.DATA_PRODUCT,
  },
  {
    label: 'label.owner-plural',
    key: EntityFields.OWNERS,
  },
  {
    label: 'label.tag',
    key: EntityFields.TAG,
  },
  {
    label: 'label.tier',
    key: EntityFields.TIER,
  },
  {
    label: 'label.certification',
    key: EntityFields.CERTIFICATION,
  },
  {
    label: 'label.service',
    key: EntityFields.SERVICE,
  },
  {
    label: 'label.service-type',
    key: EntityFields.SERVICE_TYPE,
  },
];

export const TABLE_DROPDOWN_ITEMS = [
  {
    label: 'label.database',
    key: EntityFields.DATABASE,
  },
  {
    label: 'label.schema',
    key: EntityFields.DATABASE_SCHEMA,
  },
  {
    label: 'label.column',
    key: EntityFields.COLUMN,
  },
  {
    label: 'label.table-type',
    key: EntityFields.TABLE_TYPE,
  },
  {
    label: 'label.column-description',
    key: EntityFields.COLUMN_DESCRIPTION_STATUS,
  },
];

export const DASHBOARD_DROPDOWN_ITEMS = [
  {
    label: 'label.data-model',
    key: EntityFields.DATA_MODEL,
  },
  {
    label: 'label.chart',
    key: EntityFields.CHART,
  },
  {
    label: 'label.project',
    key: EntityFields.PROJECT,
  },
];

export const DASHBOARD_DATA_MODEL_TYPE = [
  {
    label: 'label.data-model-type',
    key: EntityFields.DATA_MODEL_TYPE,
  },
  {
    label: 'label.column',
    key: EntityFields.COLUMN,
  },
  {
    label: 'label.project',
    key: EntityFields.PROJECT,
  },
];

export const PIPELINE_DROPDOWN_ITEMS = [
  {
    label: 'label.task',
    key: EntityFields.TASK,
  },
];

export const SEARCH_INDEX_DROPDOWN_ITEMS = [
  {
    label: 'label.field',
    key: EntityFields.FIELD,
  },
];

export const ML_MODEL_DROPDOWN_ITEMS = [
  {
    label: 'label.feature',
    key: EntityFields.FEATURE,
  },
];

export const TOPIC_DROPDOWN_ITEMS = [
  {
    label: 'label.schema-field',
    key: EntityFields.SCHEMA_FIELD,
  },
];
export const API_ENDPOINT_DROPDOWN_ITEMS = [
  {
    label: 'label.request-schema-field',
    key: EntityFields.REQUEST_SCHEMA_FIELD,
  },
  {
    label: 'label.response-schema-field',
    key: EntityFields.RESPONSE_SCHEMA_FIELD,
  },
];

export const CONTAINER_DROPDOWN_ITEMS = [
  {
    label: 'label.column',
    key: EntityFields.CONTAINER_COLUMN,
  },
];

export const COLUMN_DROPDOWN_ITEMS = [
  {
    label: 'label.data-type',
    key: EntityFields.DATA_TYPE,
  },
  {
    label: 'label.table',
    key: EntityFields.TABLE_NAME,
  },
  {
    label: 'label.database',
    key: EntityFields.DATABASE,
  },
  {
    label: 'label.schema',
    key: EntityFields.DATABASE_SCHEMA,
  },
];

export const GLOSSARY_DROPDOWN_ITEMS = [
  {
    label: 'label.domain-plural',
    key: EntityFields.DOMAINS,
  },
  {
    label: 'label.owner-plural',
    key: EntityFields.OWNERS,
  },
  {
    label: 'label.tag',
    key: EntityFields.TAG,
  },
  {
    label: 'label.glossary-plural',
    key: EntityFields.GLOSSARY,
  },
  {
    label: 'label.status',
    key: EntityFields.ENTITY_STATUS,
  },
];

export const TAG_DROPDOWN_ITEMS = [
  {
    label: 'label.domain-plural',
    key: EntityFields.DOMAINS,
  },
  {
    label: 'label.classification',
    key: EntityFields.CLASSIFICATION,
  },
];

export const DATA_PRODUCT_DROPDOWN_ITEMS = [
  {
    label: 'label.domain-plural',
    key: EntityFields.DOMAINS,
  },
  {
    label: 'label.owner-plural',
    key: EntityFields.OWNERS,
  },
];

export const DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS = [
  {
    label: 'label.entity-type-plural',
    labelKeyOptions: {
      entity: 'label.entity',
    },
    key: EntityFields.ENTITY_TYPE,
  },
  {
    label: 'label.owner-plural',
    key: EntityFields.OWNERS,
  },
  {
    label: 'label.tag',
    key: EntityFields.TAG,
  },
  {
    label: 'label.tier',
    key: EntityFields.TIER,
  },
  {
    label: 'label.service',
    key: EntityFields.SERVICE,
  },
  {
    label: 'label.service-type',
    key: EntityFields.SERVICE_TYPE,
  },
];

export const GLOSSARY_ASSETS_DROPDOWN_ITEMS = [
  {
    label: 'label.entity-type-plural',
    labelKeyOptions: {
      entity: 'label.entity',
    },
    key: EntityFields.ENTITY_TYPE,
  },
  {
    label: 'label.domain-plural',
    key: EntityFields.DOMAINS,
  },
  {
    label: 'label.owner-plural',
    key: EntityFields.OWNERS,
  },
  {
    label: 'label.tag',
    key: EntityFields.TAG,
  },
  {
    label: 'label.tier',
    key: EntityFields.TIER,
  },
  {
    label: 'label.service',
    key: EntityFields.SERVICE,
  },
  {
    label: 'label.service-type',
    key: EntityFields.SERVICE_TYPE,
  },
];

export const TAG_ASSETS_DROPDOWN_ITEMS = [
  {
    label: 'label.entity-type-plural',
    labelKeyOptions: {
      entity: 'label.entity',
    },
    key: EntityFields.ENTITY_TYPE,
  },
  {
    label: 'label.domain-plural',
    key: EntityFields.DOMAINS,
  },
  {
    label: 'label.owner-plural',
    key: EntityFields.OWNERS,
  },
  {
    label: 'label.tag',
    key: EntityFields.TAG,
  },
  {
    label: 'label.tier',
    key: EntityFields.TIER,
  },
  {
    label: 'label.service',
    key: EntityFields.SERVICE,
  },
  {
    label: 'label.service-type',
    key: EntityFields.SERVICE_TYPE,
  },
];

export const LINEAGE_DROPDOWN_ITEMS = [
  ...COMMON_DROPDOWN_ITEMS,
  {
    label: 'label.database',
    key: EntityFields.DATABASE,
  },
  {
    label: 'label.schema',
    key: EntityFields.DATABASE_SCHEMA,
  },
  {
    label: 'label.column',
    key: EntityFields.COLUMN,
  },
];

export const KNOWLEDGE_PAGE_DROPDOWN_ITEMS = [
  {
    label: t('label.owner-plural'),
    key: EntityFields.OWNERS,
  },
  {
    label: t('label.tag'),
    key: EntityFields.TAG,
  },
];

export const getLineageDropdownItems = (includeGlossaryTerms = false) =>
  includeGlossaryTerms
    ? [
        ...LINEAGE_DROPDOWN_ITEMS,
        {
          label: 'label.glossary-term-plural',
          key: EntityFields.GLOSSARY_TERMS,
        },
      ]
    : [...LINEAGE_DROPDOWN_ITEMS];

export const TEXT_FIELD_OPERATORS = [
  'equal',
  'not_equal',
  'like',
  'not_like',
  'is_null',
  'is_not_null',
];

export const TEXT_FIELD_DESCRIPTION_OPERATORS = [
  'like',
  'not_like',
  'is_null',
  'is_not_null',
];

export const MULTISELECT_FIELD_OPERATORS = [
  'multiselect_contains',
  'multiselect_not_contains',
  'multiselect_equals',
  'multiselect_not_equals',
  'is_null',
  'is_not_null',
];

export const RANGE_FIELD_OPERATORS = ['between', 'not_between'];

export const NUMBER_FIELD_OPERATORS = [
  'equal',
  'not_equal',
  ...RANGE_FIELD_OPERATORS,
  'is_null',
  'is_not_null',
];

export const LIST_VALUE_OPERATORS = ['select_equals', 'select_not_equals'];

export const NULL_CHECK_OPERATORS = ['is_null', 'is_not_null'];

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
  EntityType.DATA_PRODUCT,
  EntityType.GLOSSARY_TERM,
  EntityType.KNOWLEDGE_PAGE,
  EntityType.METRIC,
  EntityType.MLMODEL,
  EntityType.PIPELINE,
  EntityType.SEARCH_INDEX,
  EntityType.STORED_PROCEDURE,
  EntityType.TABLE,
  EntityType.TOPIC,
];

export const CP_TYPE_WITHOUT_KEYWORD_FIELD = ['number', 'integer', 'timestamp'];
