/*
 *  Copyright 2021 Collate
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

import i18next from 'i18next';
import { uniq } from 'lodash';
import {
  BasicConfig,
  Fields,
  JsonTree,
  SelectFieldSettings,
  Utils as QbUtils,
} from 'react-awesome-query-builder';
import AntdConfig from 'react-awesome-query-builder/lib/config/antd';
import { suggestQuery } from '../axiosAPIs/searchAPI';
import { SuggestionField } from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';
import { renderAdvanceSearchButtons } from '../utils/AdvancedSearchUtils';

const BaseConfig = AntdConfig as BasicConfig;

export const COMMON_DROPDOWN_ITEMS = [
  {
    label: i18next.t('label.owner'),
    key: 'owner.name',
  },
  {
    label: i18next.t('label.tag'),
    key: 'tags.tagFQN',
  },
  {
    label: i18next.t('label.service'),
    key: 'service.name',
  },
];

export const TABLE_DROPDOWN_ITEMS = [
  {
    label: i18next.t('label.column'),
    key: 'columns.name',
  },

  {
    label: i18next.t('label.schema'),
    key: 'databaseSchema.name',
  },
  {
    label: i18next.t('label.database'),
    key: 'database.name',
  },
];

export const DASHBOARD_DROPDOWN_ITEMS = [
  {
    label: i18next.t('label.chart'),
    key: 'charts.displayName',
  },
];

export const PIPELINE_DROPDOWN_ITEMS = [
  {
    label: i18next.t('label.task'),
    key: 'tasks.displayName',
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
            field: 'owner.name',
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
export const autocomplete: (
  searchIndex: SearchIndex | SearchIndex[],
  suggestField?: SuggestionField
) => SelectFieldSettings['asyncFetch'] =
  (searchIndex, suggestField) => (search) =>
    suggestQuery({
      query: search ?? '*',
      searchIndex: searchIndex,
      field: suggestField,
      fetchSource: false,
    }).then((resp) => ({
      values: uniq(resp).map(({ text }) => ({ value: text, title: text })),
      hasMore: false,
    }));

const mainWidgetProps = {
  fullWidth: true,
  valueLabel: i18next.t('label.criteria') + ':',
};

/**
 * Common fields that exit for all searchable entities
 */
const commonQueryBuilderFields: Fields = {
  deleted: {
    label: 'Deleted',
    type: 'boolean',
    defaultValue: true,
  },

  'owner.name': {
    label: 'Owner',
    type: 'select',
    mainWidgetProps,
    fieldSettings: {
      asyncFetch: autocomplete([SearchIndex.USER, SearchIndex.TEAM]),
    },
  },

  'tags.tagFQN': {
    label: 'Tags',
    type: 'select',
    mainWidgetProps,
    fieldSettings: {
      asyncFetch: autocomplete([SearchIndex.TAG, SearchIndex.GLOSSARY]),
    },
  },

  'tier.tagFQN': {
    label: 'Tier',
    type: 'select',
    mainWidgetProps,
    fieldSettings: {
      asyncFetch: autocomplete([SearchIndex.TAG, SearchIndex.GLOSSARY]),
    },
  },
};

/**
 * Fields specific to services
 */
const serviceQueryBuilderFields: Fields = {
  'service.name': {
    label: 'Service',
    type: 'select',
    mainWidgetProps,
    fieldSettings: {
      asyncFetch: autocomplete(SearchIndex.TABLE, SuggestionField.SERVICE),
    },
  },
};

/**
 * Fields specific to tables
 */
const tableQueryBuilderFields: Fields = {
  'database.name': {
    label: 'Database',
    type: 'select',
    mainWidgetProps,
    fieldSettings: {
      asyncFetch: autocomplete(SearchIndex.TABLE, SuggestionField.DATABASE),
    },
  },

  'databaseSchema.name': {
    label: 'Database Schema',
    type: 'select',
    mainWidgetProps,
    fieldSettings: {
      asyncFetch: autocomplete(SearchIndex.TABLE, SuggestionField.SCHEMA),
    },
  },

  'columns.name': {
    label: 'Column',
    type: 'select',
    mainWidgetProps,
    fieldSettings: {
      asyncFetch: autocomplete(SearchIndex.TABLE, SuggestionField.COLUMN),
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
        // Removes NULL check operators
        excludeOperators: ['is_null', 'is_not_null'],
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
        excludeOperators: ['is_null', 'is_not_null'],
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
      fieldLabel: i18next.t('label.field-plural') + ':',
      operatorLabel: i18next.t('label.condition') + ':',
      showNot: false,
      valueLabel: i18next.t('label.criteria') + ':',
      renderButton: renderAdvanceSearchButtons,
    },
  };

  return initialConfigWithoutFields;
};

/**
 * Builds search index specific configuration for the query builder
 */
export const getQbConfigs: (searchIndex: SearchIndex) => BasicConfig = (
  searchIndex
) => {
  switch (searchIndex) {
    case SearchIndex.MLMODEL:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...commonQueryBuilderFields,
          ...serviceQueryBuilderFields,
        },
      };

    case SearchIndex.PIPELINE:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...commonQueryBuilderFields,
          ...serviceQueryBuilderFields,
        },
      };

    case SearchIndex.DASHBOARD:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...commonQueryBuilderFields,
          ...serviceQueryBuilderFields,
        },
      };

    case SearchIndex.TABLE:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...commonQueryBuilderFields,
          ...serviceQueryBuilderFields,
          ...tableQueryBuilderFields,
        },
      };

    case SearchIndex.TOPIC:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...commonQueryBuilderFields,
          ...serviceQueryBuilderFields,
        },
      };

    default:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...commonQueryBuilderFields,
        },
      };
  }
};

export const MISC_FIELDS = ['owner.name', 'tags.tagFQN'];
