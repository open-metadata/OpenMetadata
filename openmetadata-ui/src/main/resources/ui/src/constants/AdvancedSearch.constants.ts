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

import i18next from 'i18next';
import { isUndefined, uniq } from 'lodash';
import {
  BasicConfig,
  Fields,
  JsonTree,
  SelectFieldSettings,
  Utils as QbUtils,
} from 'react-awesome-query-builder';
import AntdConfig from 'react-awesome-query-builder/lib/config/antd';
import { getAdvancedFieldDefaultOptions } from 'rest/miscAPI';
import { suggestQuery } from 'rest/searchAPI';
import { EntityFields, SuggestionField } from '../enums/AdvancedSearch.enum';
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
    key: 'charts.name',
  },
];

export const PIPELINE_DROPDOWN_ITEMS = [
  {
    label: i18next.t('label.task'),
    key: 'tasks.name',
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
export const autocomplete: (args: {
  searchIndex: SearchIndex | SearchIndex[];
  suggestField?: SuggestionField;
  entitySearchIndex?: SearchIndex;
  entityField?: EntityFields;
}) => SelectFieldSettings['asyncFetch'] = ({
  searchIndex,
  suggestField,
  entitySearchIndex,
  entityField,
}) => {
  const isUserAndTeamSearchIndex =
    searchIndex.includes(SearchIndex.USER) ||
    searchIndex.includes(SearchIndex.TEAM);

  return (search) => {
    if (search) {
      return suggestQuery({
        query: search ?? '*',
        searchIndex: searchIndex,
        field: suggestField,
        // fetch source if index is type of user or team and both
        fetchSource: isUserAndTeamSearchIndex,
      }).then((resp) => {
        return {
          values: uniq(resp).map(({ text, _source }) => ({
            value: text,
            title:
              // set displayName or name if index is type of user or team and both.
              // else set the text
              isUserAndTeamSearchIndex && !isUndefined(_source)
                ? _source?.displayName || _source.name
                : text,
          })),
          hasMore: false,
        };
      });
    } else {
      return getAdvancedFieldDefaultOptions(
        entitySearchIndex as SearchIndex,
        entityField ?? ''
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
    }
  };
};

const mainWidgetProps = {
  fullWidth: true,
  valueLabel: i18next.t('label.criteria') + ':',
};

/**
 * Common fields that exit for all searchable entities
 */
const getCommonQueryBuilderFields = (
  entitySearchIndex: SearchIndex = SearchIndex.TABLE
) => {
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
        asyncFetch: autocomplete({
          searchIndex: [SearchIndex.USER, SearchIndex.TEAM],
          entitySearchIndex,
          entityField: EntityFields.OWNER,
        }),
      },
    },

    'tags.tagFQN': {
      label: 'Tags',
      type: 'select',
      mainWidgetProps,
      fieldSettings: {
        asyncFetch: autocomplete({
          searchIndex: [SearchIndex.TAG, SearchIndex.GLOSSARY],
          entitySearchIndex,
          entityField: EntityFields.TAG,
        }),
      },
    },

    'tier.tagFQN': {
      label: 'Tier',
      type: 'select',
      mainWidgetProps,
      fieldSettings: {
        asyncFetch: autocomplete({
          searchIndex: [SearchIndex.TAG, SearchIndex.GLOSSARY],
          entitySearchIndex,
          entityField: EntityFields.TIER,
        }),
      },
    },
  };

  return commonQueryBuilderFields;
};

/**
 * Fields specific to services
 */
const getServiceQueryBuilderFields = (index: SearchIndex) => {
  const serviceQueryBuilderFields: Fields = {
    'service.name': {
      label: 'Service',
      type: 'select',
      mainWidgetProps,
      fieldSettings: {
        asyncFetch: autocomplete({
          searchIndex: index,
          suggestField: SuggestionField.SERVICE,
          entitySearchIndex: index,
          entityField: EntityFields.SERVICE,
        }),
      },
    },
  };

  return serviceQueryBuilderFields;
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
      asyncFetch: autocomplete({
        searchIndex: SearchIndex.TABLE,
        suggestField: SuggestionField.DATABASE,
        entitySearchIndex: SearchIndex.TABLE,
        entityField: EntityFields.DATABASE,
      }),
    },
  },

  'databaseSchema.name': {
    label: 'Database Schema',
    type: 'select',
    mainWidgetProps,
    fieldSettings: {
      asyncFetch: autocomplete({
        searchIndex: SearchIndex.TABLE,
        suggestField: SuggestionField.SCHEMA,
        entitySearchIndex: SearchIndex.TABLE,
        entityField: EntityFields.DATABASE_SCHEMA,
      }),
    },
  },

  'columns.name': {
    label: 'Column',
    type: 'select',
    mainWidgetProps,
    fieldSettings: {
      asyncFetch: autocomplete({
        searchIndex: SearchIndex.TABLE,
        suggestField: SuggestionField.COLUMN,
        entitySearchIndex: SearchIndex.TABLE,
        entityField: EntityFields.COLUMN,
      }),
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
          ...getCommonQueryBuilderFields(SearchIndex.MLMODEL),
          ...getServiceQueryBuilderFields(SearchIndex.MLMODEL),
        },
      };

    case SearchIndex.PIPELINE:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...getCommonQueryBuilderFields(SearchIndex.PIPELINE),
          ...getServiceQueryBuilderFields(SearchIndex.PIPELINE),
        },
      };

    case SearchIndex.DASHBOARD:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...getCommonQueryBuilderFields(SearchIndex.DASHBOARD),
          ...getServiceQueryBuilderFields(SearchIndex.DASHBOARD),
        },
      };

    case SearchIndex.TABLE:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...getCommonQueryBuilderFields(SearchIndex.TABLE),
          ...getServiceQueryBuilderFields(SearchIndex.TABLE),
          ...tableQueryBuilderFields,
        },
      };

    case SearchIndex.TOPIC:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...getCommonQueryBuilderFields(SearchIndex.TOPIC),
          ...getServiceQueryBuilderFields(SearchIndex.TOPIC),
        },
      };

    default:
      return {
        ...getInitialConfigWithoutFields(),
        fields: {
          ...getCommonQueryBuilderFields(),
        },
      };
  }
};

export const MISC_FIELDS = ['owner.name', 'tags.tagFQN'];
