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
import {
  AsyncFetchListValues,
  AsyncFetchListValuesResult,
  BasicConfig,
  Fields,
  JsonTree,
  ListItem,
  SelectFieldSettings,
  Utils as QbUtils,
} from 'react-awesome-query-builder';
import AntdConfig from 'react-awesome-query-builder/lib/config/antd';
import { EntityFields, SuggestionField } from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';
import { getAggregateFieldOptions } from '../rest/miscAPI';
import { renderAdvanceSearchButtons } from '../utils/AdvancedSearchUtils';
import { getCombinedQueryFilterObject } from '../utils/ExplorePage/ExplorePageUtils';

const BaseConfig = AntdConfig as BasicConfig;

export const SUFFIX_WILDCARD = '.*';

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
    }) as string,
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
    }) as string,
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

export const ALL_DROPDOWN_ITEMS = [
  ...COMMON_DROPDOWN_ITEMS,
  ...TABLE_DROPDOWN_ITEMS,
  ...DASHBOARD_DROPDOWN_ITEMS,
  ...PIPELINE_DROPDOWN_ITEMS,
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

/**
 * Create an autocomplete function using elasctisearch's suggestion API
 * @param searchIndex Index to search
 * @param suggestField `suggest_` field to use
 */
export const autocomplete: (args: {
  searchIndex: SearchIndex | SearchIndex[];
  entityField: EntityFields;
  suggestField?: SuggestionField;
}) => SelectFieldSettings['asyncFetch'] = ({ searchIndex, entityField }) => {
  return (search) => {
    return getAggregateFieldOptions(
      searchIndex,
      entityField,
      search ?? '',
      JSON.stringify(getCombinedQueryFilterObject())
    ).then((response) => {
      const buckets =
        response.data.aggregations[`sterms#${entityField}`].buckets;

      return {
        values: buckets.map((bucket) => ({
          value: bucket.key,
          title: bucket.label ?? bucket.key,
        })),
        hasMore: false,
      };
    });
  };
};

export const autoCompleteTier: (
  tierOptions: Promise<AsyncFetchListValues>
) => SelectFieldSettings['asyncFetch'] = (tierOptions) => {
  return async (search) => {
    const resolvedTierOptions = (await tierOptions) as ListItem[];

    return {
      values: !search
        ? resolvedTierOptions
        : resolvedTierOptions.filter((tier) =>
            tier.title?.toLowerCase()?.includes(search.toLowerCase())
          ),
      hasMore: false,
    } as AsyncFetchListValuesResult;
  };
};

const mainWidgetProps = {
  fullWidth: true,
  valueLabel: t('label.criteria') + ':',
};

/**
 * Common fields that exit for all searchable entities
 */
const getCommonQueryBuilderFields = (
  entitySearchIndex: SearchIndex = SearchIndex.TABLE,
  tierOptions: Promise<AsyncFetchListValues> = Promise.resolve([])
) => {
  const commonQueryBuilderFields: Fields = {
    deleted: {
      label: t('label.deleted'),
      type: 'boolean',
      defaultValue: true,
    },

    'owner.displayName.keyword': {
      label: t('label.owner'),
      type: 'select',
      mainWidgetProps,

      fieldSettings: {
        asyncFetch: autocomplete({
          searchIndex: [SearchIndex.USER, SearchIndex.TEAM],
          entityField: EntityFields.OWNER,
        }),
        useAsyncSearch: true,
      },
    },

    'tags.tagFQN': {
      label: t('label.tag-plural'),
      type: 'select',
      mainWidgetProps,
      fieldSettings: {
        asyncFetch: autocomplete({
          searchIndex: entitySearchIndex ?? [
            (SearchIndex.TAG, SearchIndex.GLOSSARY_TERM),
          ],
          entityField: EntityFields.TAG,
        }),
        useAsyncSearch: true,
      },
    },

    'tier.tagFQN': {
      label: t('label.tier'),
      type: 'select',
      mainWidgetProps,
      fieldSettings: {
        asyncFetch: autoCompleteTier(tierOptions),
        useAsyncSearch: true,
      },
    },
    extension: {
      label: t('label.custom-property-plural'),
      type: '!group',
      mainWidgetProps,
      subfields: {},
    },
  };

  return commonQueryBuilderFields;
};

/**
 * Fields specific to services
 */
const getServiceQueryBuilderFields = (index: SearchIndex) => {
  const serviceQueryBuilderFields: Fields = {
    'service.displayName.keyword': {
      label: t('label.service'),
      type: 'select',
      mainWidgetProps,
      fieldSettings: {
        asyncFetch: autocomplete({
          searchIndex: index,
          entityField: EntityFields.SERVICE,
        }),
        useAsyncSearch: true,
      },
    },
  };

  return serviceQueryBuilderFields;
};

/**
 * Fields specific to tables
 */
const tableQueryBuilderFields: Fields = {
  'database.displayName.keyword': {
    label: t('label.database'),
    type: 'select',
    mainWidgetProps,
    fieldSettings: {
      asyncFetch: autocomplete({
        searchIndex: SearchIndex.TABLE,
        entityField: EntityFields.DATABASE,
      }),
      useAsyncSearch: true,
    },
  },

  'databaseSchema.displayName.keyword': {
    label: t('label.database-schema'),
    type: 'select',
    mainWidgetProps,
    fieldSettings: {
      asyncFetch: autocomplete({
        searchIndex: SearchIndex.TABLE,
        entityField: EntityFields.DATABASE_SCHEMA,
      }),
      useAsyncSearch: true,
    },
  },

  'columns.name.keyword': {
    label: t('label.column'),
    type: 'select',
    mainWidgetProps,
    fieldSettings: {
      asyncFetch: autocomplete({
        searchIndex: SearchIndex.TABLE,
        entityField: EntityFields.COLUMN,
      }),
      useAsyncSearch: true,
    },
  },
};

/**
 * Overriding default configurations.
 * Basic attributes that fields inherit from.
 */
const getInitialConfigWithoutFields = () => {
  const initialConfigWithoutFields: BasicConfig = {
    ...BaseConfig,
    types: {
      ...BaseConfig.types,
      multiselect: {
        ...BaseConfig.types.multiselect,
        widgets: {
          ...BaseConfig.types.multiselect.widgets,
          // Adds the "Contains" and "Not contains" options for fields with type multiselect
          text: {
            operators: ['like', 'not_like'],
          },
        },
        // Limits source to user input values, not other fields
        valueSources: ['value'],
      },
      select: {
        ...BaseConfig.types.select,
        widgets: {
          ...BaseConfig.types.select.widgets,
          text: {
            operators: ['like', 'not_like'],
          },
        },
        valueSources: ['value'],
      },
      text: {
        ...BaseConfig.types.text,
        valueSources: ['value'],
      },
    },
    widgets: {
      ...BaseConfig.widgets,
      multiselect: {
        ...BaseConfig.widgets.multiselect,
        showSearch: true,
        showCheckboxes: true,
        useAsyncSearch: true,
        useLoadMore: false,
      },
      select: {
        ...BaseConfig.widgets.select,
        showSearch: true,
        showCheckboxes: true,
        useAsyncSearch: true,
        useLoadMore: false,
      },
      text: {
        ...BaseConfig.widgets.text,
      },
    },
    operators: {
      ...BaseConfig.operators,
      like: {
        ...BaseConfig.operators.like,
        elasticSearchQueryType: 'wildcard',
      },
    },
    settings: {
      ...BaseConfig.settings,
      showLabels: true,
      canReorder: false,
      renderSize: 'medium',
      fieldLabel: t('label.field-plural') + ':',
      operatorLabel: t('label.condition') + ':',
      showNot: false,
      valueLabel: t('label.criteria') + ':',
      renderButton: renderAdvanceSearchButtons,
    },
  };

  return initialConfigWithoutFields;
};

/**
 * Builds search index specific configuration for the query builder
 */
export const getQbConfigs: (
  searchIndex: SearchIndex,
  tierOptions: Promise<AsyncFetchListValues>
) => BasicConfig = (searchIndex, tierOptions) => {
  switch (searchIndex) {
    case SearchIndex.MLMODEL:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...getCommonQueryBuilderFields(SearchIndex.MLMODEL, tierOptions),
          ...getServiceQueryBuilderFields(SearchIndex.MLMODEL),
        },
      };

    case SearchIndex.PIPELINE:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...getCommonQueryBuilderFields(SearchIndex.PIPELINE, tierOptions),
          ...getServiceQueryBuilderFields(SearchIndex.PIPELINE),
        },
      };

    case SearchIndex.DASHBOARD:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...getCommonQueryBuilderFields(SearchIndex.DASHBOARD, tierOptions),
          ...getServiceQueryBuilderFields(SearchIndex.DASHBOARD),
        },
      };

    case SearchIndex.TABLE:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...getCommonQueryBuilderFields(SearchIndex.TABLE, tierOptions),
          ...getServiceQueryBuilderFields(SearchIndex.TABLE),
          ...tableQueryBuilderFields,
        },
      };

    case SearchIndex.TOPIC:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...getCommonQueryBuilderFields(SearchIndex.TOPIC, tierOptions),
          ...getServiceQueryBuilderFields(SearchIndex.TOPIC),
        },
      };

    default:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...getCommonQueryBuilderFields(undefined, tierOptions),
        },
      };
  }
};

export const MISC_FIELDS = ['owner.displayName', 'tags.tagFQN'];

export const OWNER_QUICK_FILTER_DEFAULT_OPTIONS_KEY = 'displayName.keyword';
