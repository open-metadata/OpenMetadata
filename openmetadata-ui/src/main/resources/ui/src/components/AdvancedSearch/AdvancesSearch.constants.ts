import {
  BasicConfig,
  Fields,
  ImmutableTree,
  SelectFieldSettings,
  Utils as QbUtils,
} from 'react-awesome-query-builder';
import AntdConfig from 'react-awesome-query-builder/lib/config/antd';
import { SearchIndex } from '../../enums/search.enum';
import { SuggestionField } from '../../enums/AdvancedSearch.enum';
import { suggestQuery } from '../../axiosAPIs/searchAPI';

const BaseConfig = AntdConfig as BasicConfig;

/**
 * Generates a query builder tree with a group containing an empty rule
 */
export const emptyImmutableTree: ImmutableTree = QbUtils.loadTree({
  id: QbUtils.uuid(),
  type: 'group',
  children1: {
    [QbUtils.uuid()]: {
      type: 'rule',
      properties: {
        field: null,
        operator: null,
        value: [],
        valueSrc: [],
      },
    },
  },
});

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
      query: search ?? '',
      searchIndex: Array.isArray(searchIndex)
        ? searchIndex.join(',')
        : searchIndex,
      field: suggestField,
    }).then((resp) => ({
      values: resp.map(({ text }) => text),
      hasMore: false,
    }));

const commonQueryBuilderFields: Fields = {
  'owner.name': {
    label: 'Owner',
    type: 'select',
    fieldSettings: {
      asyncFetch: autocomplete([SearchIndex.USER, SearchIndex.TEAM]),
    },
  },

  'tags.tagFQN': {
    label: 'Tags',
    type: 'select',
    fieldSettings: {
      asyncFetch: autocomplete([SearchIndex.TAG, SearchIndex.GLOSSARY]),
    },
  },
};

const tableQueryBuilderFields: Fields = {
  'service.name': {
    label: 'Service',
    type: 'select',
    fieldSettings: {
      asyncFetch: autocomplete(SearchIndex.TABLE, SuggestionField.SERVICE),
    },
  },

  'database.name': {
    label: 'Database',
    type: 'select',
    fieldSettings: {
      asyncFetch: autocomplete(SearchIndex.TABLE, SuggestionField.DATABASE),
    },
  },

  'databaseSchema.name': {
    label: 'Schema',
    type: 'select',
    fieldSettings: {
      asyncFetch: autocomplete(SearchIndex.TABLE, SuggestionField.SCHEMA),
    },
  },

  name: {
    label: 'Table',
    type: 'select',
    fieldSettings: {
      asyncFetch: autocomplete(SearchIndex.TABLE, SuggestionField.ROOT),
    },
  },

  'columns.name': {
    label: 'Column',
    type: 'select',
    fieldSettings: {
      asyncFetch: autocomplete(SearchIndex.TABLE, SuggestionField.COLUMN),
    },
  },
};

/**
 * Overriding default configurations
 */
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
      // Removes NULL check operators and multiple selects
      excludeOperators: [
        'is_null',
        'is_not_null',
        // 'select_any_in',
        // 'select_not_any_in',
      ],
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
      excludeOperators: [
        'is_null',
        'is_not_null',
        // 'select_any_in',
        // 'select_not_any_in',
      ],
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
};

export const getQbConfigs: (searchIndex: SearchIndex) => BasicConfig = (
  searchIndex
) => {
  switch (searchIndex) {
    case SearchIndex.TOPIC:
      return {
        ...initialConfigWithoutFields,
        fields: {
          ...commonQueryBuilderFields,
        },
      };

    case SearchIndex.TABLE:
      return {
        ...initialConfigWithoutFields,
        fields: {
          ...commonQueryBuilderFields,
          ...tableQueryBuilderFields,
        },
      };

    default:
      return {
        ...initialConfigWithoutFields,
        fields: {
          ...commonQueryBuilderFields,
        },
      };
  }
};
