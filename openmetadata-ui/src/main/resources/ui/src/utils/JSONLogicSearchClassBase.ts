/*
 *  Copyright 2024 Collate.
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
import { get, sortBy } from 'lodash';
import {
  AsyncFetchListValues,
  Config,
  Fields,
  Operators,
  SelectFieldSettings,
} from 'react-awesome-query-builder';
import AntdConfig from 'react-awesome-query-builder/lib/config/antd';
import { TEXT_FIELD_OPERATORS } from '../constants/AdvancedSearch.constants';
import { PAGE_SIZE_BASE } from '../constants/constants';
import {
  EntityFields,
  EntityReferenceFields,
} from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';
import { searchData } from '../rest/miscAPI';
import advancedSearchClassBase from './AdvancedSearchClassBase';
import { renderJSONLogicQueryBuilderButtons } from './QueryBuilderUtils';

class JSONLogicSearchClassBase {
  baseConfig = AntdConfig as Config;
  configTypes: Config['types'] = {
    ...this.baseConfig.types,
    multiselect: {
      ...this.baseConfig.types.multiselect,
      widgets: {
        ...this.baseConfig.types.multiselect.widgets,
        // Adds the "Contains" and "Not contains" options for fields with type multiselect
        text: {
          operators: ['like', 'not_like', 'regexp'],
        },
      },
      // Limits source to user input values, not other fields
      valueSources: ['value'],
    },
    select: {
      ...this.baseConfig.types.select,
      widgets: {
        ...this.baseConfig.types.select.widgets,
        text: {
          operators: ['like', 'not_like', 'regexp'],
        },
      },
      valueSources: ['value'],
    },
    text: {
      ...this.baseConfig.types.text,
      valueSources: ['value'],
    },
  };
  configWidgets: Config['widgets'] = {
    ...this.baseConfig.widgets,
    multiselect: {
      ...this.baseConfig.widgets.multiselect,
      showSearch: true,
      showCheckboxes: true,
      useAsyncSearch: true,
      useLoadMore: false,
      customProps: {
        popupClassName: 'w-max-600',
      },
    },
    select: {
      ...this.baseConfig.widgets.select,
      showSearch: true,
      showCheckboxes: true,
      useAsyncSearch: true,
      useLoadMore: false,
      customProps: {
        popupClassName: 'w-max-600',
      },
    },
    text: {
      ...this.baseConfig.widgets.text,
    },
  };
  configOperators = {
    ...this.baseConfig.operators,
    like: {
      ...this.baseConfig.operators.like,
      elasticSearchQueryType: 'wildcard',
    },
    regexp: {
      ...this.baseConfig.operators.regexp,
      label: t('label.regular-expression'),
      labelForFormat: t('label.regular-expression'),
      elasticSearchQueryType: 'regexp',
      valueSources: ['value'],
    },
    equal: {
      ...this.baseConfig.operators.equal,
      label: t('label.is'),
    },
    not_equal: {
      ...this.baseConfig.operators.not_equal,
      label: t('label.is-not'),
    },
    select_equals: {
      ...this.baseConfig.operators.select_equals,
      label: t('label.is'),
    },
    select_not_equals: {
      ...this.baseConfig.operators.select_not_equals,
      label: t('label.is-not'),
    },
    is_null: {
      ...this.baseConfig.operators.is_null,
      label: t('label.is-not-set'),
    },
    is_not_null: {
      ...this.baseConfig.operators.is_not_null,
      label: t('label.is-set'),
    },
  };
  defaultSelectOperators = [
    'select_equals',
    'select_not_equals',
    'select_any_in',
    'select_not_any_in',
    'is_null',
    'is_not_null',
  ];

  public searchAutocomplete: (args: {
    searchIndex: SearchIndex | SearchIndex[];
    fieldName: string;
    fieldLabel: string;
  }) => SelectFieldSettings['asyncFetch'] = ({
    searchIndex,
    fieldName,
    fieldLabel,
  }) => {
    return (search) => {
      return searchData(
        search ?? '',
        1,
        PAGE_SIZE_BASE,
        '',
        '',
        '',
        searchIndex ?? SearchIndex.DATA_ASSET,
        false,
        false,
        false
      ).then((response) => {
        const data = response.data.hits.hits;

        return {
          values: data.map((item) => ({
            value: get(item._source, fieldName, ''),
            title: get(item._source, fieldLabel, ''),
          })),
          hasMore: false,
        };
      });
    };
  };

  mainWidgetProps = {
    fullWidth: true,
    valueLabel: t('label.criteria') + ':',
  };

  glossaryEntityFields: Fields = {
    [EntityReferenceFields.REVIEWERS]: {
      label: t('label.reviewer-plural'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      operators: this.defaultSelectOperators,
      fieldSettings: {
        asyncFetch: advancedSearchClassBase.autocomplete({
          searchIndex: [SearchIndex.USER, SearchIndex.TEAM],
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
  };

  tableEntityFields: Fields = {
    [EntityReferenceFields.DATABASE]: {
      label: t('label.database'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      operators: this.defaultSelectOperators,
      fieldSettings: {
        asyncFetch: advancedSearchClassBase.autocomplete({
          searchIndex: SearchIndex.TABLE,
          entityField: EntityFields.DATABASE_NAME,
          isCaseInsensitive: true,
        }),
        useAsyncSearch: true,
      },
    },

    [EntityReferenceFields.DATABASE_SCHEMA]: {
      label: t('label.database-schema'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      operators: this.defaultSelectOperators,
      fieldSettings: {
        asyncFetch: advancedSearchClassBase.autocomplete({
          searchIndex: SearchIndex.TABLE,
          entityField: EntityFields.DATABASE_SCHEMA_NAME,
          isCaseInsensitive: true,
        }),
        useAsyncSearch: true,
      },
    },

    [EntityReferenceFields.TABLE_TYPE]: {
      label: t('label.table-type'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      operators: this.defaultSelectOperators,
      fieldSettings: {
        asyncFetch: advancedSearchClassBase.autocomplete({
          searchIndex: SearchIndex.TABLE,
          entityField: EntityFields.TABLE_TYPE,
        }),
        useAsyncSearch: true,
      },
    },
  };

  public getCommonConfig = (_: {
    entitySearchIndex?: Array<SearchIndex>;
    tierOptions?: Promise<AsyncFetchListValues>;
  }) => {
    return {
      [EntityReferenceFields.SERVICE]: {
        label: t('label.service'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        operators: this.defaultSelectOperators,
        fieldSettings: {
          asyncFetch: advancedSearchClassBase.autocomplete({
            searchIndex: SearchIndex.ALL,
            entityField: EntityFields.SERVICE_NAME,
            isCaseInsensitive: true,
          }),
          useAsyncSearch: true,
        },
      },
      [EntityReferenceFields.OWNERS]: {
        label: t('label.owner-plural'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        operators: this.defaultSelectOperators,
        fieldSettings: {
          asyncFetch: advancedSearchClassBase.autocomplete({
            searchIndex: [SearchIndex.USER, SearchIndex.TEAM],
            entityField: EntityFields.DISPLAY_NAME_KEYWORD,
          }),
          useAsyncSearch: true,
        },
      },
      [EntityReferenceFields.DISPLAY_NAME]: {
        label: t('label.display-name'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        fieldSettings: {
          asyncFetch: advancedSearchClassBase.autocomplete({
            searchIndex: SearchIndex.DATA_ASSET,
            entityField: EntityFields.DISPLAY_NAME_ACTUAL_CASE,
          }),
          useAsyncSearch: true,
        },
        operators: this.defaultSelectOperators,
      },
      [EntityReferenceFields.NAME]: {
        label: t('label.name'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        fieldSettings: {
          asyncFetch: advancedSearchClassBase.autocomplete({
            searchIndex: SearchIndex.DATA_ASSET,
            entityField: EntityFields.NAME_KEYWORD,
          }),
          useAsyncSearch: true,
        },
        operators: this.defaultSelectOperators,
      },
      deleted: {
        label: t('label.deleted'),
        type: 'boolean',
        defaultValue: true,
      },
      [EntityReferenceFields.DESCRIPTION]: {
        label: t('label.description'),
        type: 'text',
        mainWidgetProps: this.mainWidgetProps,
        operators: TEXT_FIELD_OPERATORS,
      },
      [EntityReferenceFields.TAG]: {
        label: t('label.tag-plural'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        operators: this.defaultSelectOperators,
        fieldSettings: {
          asyncFetch: this.searchAutocomplete({
            searchIndex: SearchIndex.TAG,
            fieldName: 'fullyQualifiedName',
            fieldLabel: 'name',
          }),
          useAsyncSearch: true,
        },
      },

      [EntityReferenceFields.EXTENSION]: {
        label: t('label.custom-property-plural'),
        type: '!struct',
        mainWidgetProps: this.mainWidgetProps,
        subfields: {},
        operators: TEXT_FIELD_OPERATORS,
      },
    };
  };

  public getEntitySpecificQueryBuilderFields(
    entitySearchIndex = [SearchIndex.TABLE]
  ): Fields {
    let configs: Fields = {};
    const configIndexMapping: Partial<Record<SearchIndex, Fields>> = {
      [SearchIndex.TABLE]: this.tableEntityFields,
      [SearchIndex.GLOSSARY_TERM]: this.glossaryEntityFields,
    };

    entitySearchIndex.forEach((index) => {
      configs = { ...configs, ...(configIndexMapping[index] ?? {}) };
    });

    return configs;
  }
  /**
   * Common fields that exit for all searchable entities
   */
  public getQueryBuilderFields = ({
    entitySearchIndex = [SearchIndex.TABLE],
    tierOptions = Promise.resolve([]),
  }: {
    entitySearchIndex?: Array<SearchIndex>;
    tierOptions?: Promise<AsyncFetchListValues>;
  }) => {
    const fieldsConfig = {
      ...this.getCommonConfig({ entitySearchIndex, tierOptions }),
      ...this.getEntitySpecificQueryBuilderFields(entitySearchIndex),
    };

    // Sort the fields according to the label
    const sortedFieldsConfig = sortBy(Object.entries(fieldsConfig), '1.label');

    return Object.fromEntries(sortedFieldsConfig);
  };

  /**
   * Overriding default configurations.
   * Basic attributes that fields inherit from.
   */
  public getInitialConfigWithoutFields = (isExplorePage = true) => {
    const initialConfigWithoutFields: Config = {
      ...this.baseConfig,
      types: this.configTypes,
      widgets: this.configWidgets,
      operators: this.configOperators as Operators,
      settings: {
        ...this.baseConfig.settings,
        showLabels: isExplorePage,
        canReorder: false,
        renderSize: 'medium',
        fieldLabel: t('label.field-plural') + ':',
        operatorLabel: t('label.condition') + ':',
        showNot: false,
        valueLabel: t('label.criteria') + ':',
        renderButton: renderJSONLogicQueryBuilderButtons,
        customFieldSelectProps: {
          ...this.baseConfig.settings.customFieldSelectProps,
          popupClassName: 'json-logic-field-select',
        },
      },
    };

    return initialConfigWithoutFields;
  };

  public getQbConfigs: (
    tierOptions: Promise<AsyncFetchListValues>,
    entitySearchIndex?: Array<SearchIndex>,
    isExplorePage?: boolean
  ) => Config = (tierOptions, entitySearchIndex, isExplorePage) => {
    return {
      ...this.getInitialConfigWithoutFields(isExplorePage),
      fields: {
        ...this.getQueryBuilderFields({
          entitySearchIndex,
          tierOptions,
        }),
      },
    };
  };
}

const jsonLogicSearchClassBase = new JSONLogicSearchClassBase();

export default jsonLogicSearchClassBase;

export { JSONLogicSearchClassBase };
