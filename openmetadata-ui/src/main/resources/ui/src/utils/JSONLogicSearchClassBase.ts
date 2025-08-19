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
import {
    AntdConfig,
    AsyncFetchListValuesResult,
    Config, Fields,
    ListItem,
    ListValues,
    Operators,
    SelectFieldSettings
} from '@react-awesome-query-builder/antd';
import { get, sortBy, toLower } from 'lodash';
import { TEXT_FIELD_OPERATORS } from '../constants/AdvancedSearch.constants';
import { PAGE_SIZE_BASE } from '../constants/constants';
import {
    COMMON_ENTITY_FIELDS_KEYS,
    GLOSSARY_ENTITY_FIELDS_KEYS,
    TABLE_ENTITY_FIELDS_KEYS
} from '../constants/JSONLogicSearch.constants';
import {
    EntityFields,
    EntityReferenceFields
} from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';
import { searchData } from '../rest/miscAPI';
import { getTags } from '../rest/tagAPI';
import advancedSearchClassBase from './AdvancedSearchClassBase';
import { t } from './i18next/LocalUtil';
import {
    getFieldsByKeys,
    renderJSONLogicQueryBuilderButtons
} from './QueryBuilderUtils';

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
    isReviewer: {
      label: t('label.is-entity', { entity: t('label.reviewer') }),
      labelForFormat: t('label.is-entity', { entity: t('label.reviewer') }),
      cardinality: 0,
      unary: true,
      jsonLogic: 'isReviewer',
      sqlOp: 'IS REVIEWER',
    },
    isOwner: {
      label: t('label.is-entity', { entity: t('label.owner') }),
      labelForFormat: t('label.is-entity', { entity: t('label.owner') }),
      cardinality: 0,
      unary: true,
      jsonLogic: 'isOwner',
      sqlOp: 'IS OWNER',
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

  private _mapFields: Fields | null = null;

  get mapFields(): Fields {
    if (!this._mapFields) {
      this._mapFields = this.createMapFields();
    }
    return this._mapFields;
  }

  private createMapFields(): Fields {
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
        type: '!group',
        mode: 'some',
        defaultField: 'fullyQualifiedName',
        subfields: {
          fullyQualifiedName: {
            label: 'Owners',
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
        type: '!group',
        mode: 'some',
        defaultField: 'tagFQN',
        subfields: {
          tagFQN: {
            label: 'Tags',
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
        },
      },
      [EntityReferenceFields.DOMAIN]: {
        label: t('label.domain'),
        type: '!group',
        mode: 'some',
        defaultField: 'fullyQualifiedName',
        subfields: {
          fullyQualifiedName: {
            label: 'Domain',
            type: 'select',
            mainWidgetProps: this.mainWidgetProps,
            operators: this.defaultSelectOperators,
            fieldSettings: {
              asyncFetch: this.searchAutocomplete({
                searchIndex: SearchIndex.DOMAIN,
                fieldName: 'fullyQualifiedName',
                fieldLabel: 'name',
              }),
              useAsyncSearch: true,
            },
          },
        },
      },
      [EntityReferenceFields.DATA_PRODUCT]: {
        label: t('label.data-product'),
        type: '!group',
        mode: 'some',
        defaultField: 'fullyQualifiedName',
        subfields: {
          fullyQualifiedName: {
            label: 'Data Product',
            type: 'select',
            mainWidgetProps: this.mainWidgetProps,
            operators: this.defaultSelectOperators,
            fieldSettings: {
              asyncFetch: this.searchAutocomplete({
                searchIndex: SearchIndex.DATA_PRODUCT,
                fieldName: 'fullyQualifiedName',
                fieldLabel: 'name',
              }),
              useAsyncSearch: true,
            },
          },
        },
      },
      [EntityReferenceFields.TIER]: {
        label: t('label.tier'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        operators: this.defaultSelectOperators,
        fieldSettings: {
          asyncFetch: this.autoCompleteTier,
          useAsyncSearch: true,
        },
      },
      [EntityReferenceFields.EXTENSION]: {
        label: t('label.custom-property-plural'),
        type: '!struct',
        mainWidgetProps: this.mainWidgetProps,
        subfields: {},
      },
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

      [EntityReferenceFields.REVIEWERS]: {
        label: t('label.reviewer-plural'),
        type: '!group',
        mode: 'some',
        defaultField: 'fullyQualifiedName',
        subfields: {
          fullyQualifiedName: {
            label: 'Reviewers New',
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
        },
      },
      [EntityReferenceFields.UPDATED_BY]: {
        label: t('label.updated-by'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        operators: [...this.defaultSelectOperators, 'isOwner', 'isReviewer'],
        fieldSettings: {
          asyncFetch: advancedSearchClassBase.autocomplete({
            searchIndex: [SearchIndex.USER, SearchIndex.TEAM],
            entityField: EntityFields.DISPLAY_NAME_KEYWORD,
          }),
          useAsyncSearch: true,
        },
      },
    };
  }

  public getMapFields = () => {
    return this.mapFields;
  };

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
        Array.isArray(search) ? search.join(',') : search ?? '',
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

  public autoCompleteTier: SelectFieldSettings['asyncFetch'] = async (
    searchOrValues: string | (string | number)[] | null
  ) => {
    let resolvedTierOptions: ListItem[] = [];

    try {
      const { data: tiers } = await getTags({
        parent: 'Tier',
        limit: 50,
      });

      const tierFields = tiers.map((tier) => ({
        title: tier.fullyQualifiedName, // tier.name,
        value: tier.fullyQualifiedName,
      }));

      resolvedTierOptions = tierFields as ListItem[];
    } catch (error) {
      resolvedTierOptions = [];
    }

    const search = Array.isArray(searchOrValues)
      ? searchOrValues.join(',')
      : searchOrValues;

    return {
      values: !search
        ? resolvedTierOptions
        : resolvedTierOptions.filter((tier: ListItem) =>
            tier.title?.toLowerCase()?.includes(toLower(search))
          ),
      hasMore: false,
    } as AsyncFetchListValuesResult;
  };

  public getCommonConfig = () => {
    return {
      ...getFieldsByKeys(COMMON_ENTITY_FIELDS_KEYS, this.mapFields),
    };
  };

  public getEntitySpecificQueryBuilderFields(
    entitySearchIndex = [SearchIndex.TABLE]
  ): Fields {
    let configs: Fields = {};
    const configIndexMapping: Partial<Record<SearchIndex, Fields>> = {
      [SearchIndex.TABLE]: getFieldsByKeys(
        TABLE_ENTITY_FIELDS_KEYS,
        this.mapFields
      ),
      [SearchIndex.GLOSSARY_TERM]: getFieldsByKeys(
        GLOSSARY_ENTITY_FIELDS_KEYS,
        this.mapFields
      ),
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
  }: {
    entitySearchIndex?: Array<SearchIndex>;
    tierOptions?: Promise<ListValues>;
  }) => {
    const fieldsConfig = {
      ...this.getCommonConfig(),
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
    tierOptions: Promise<ListValues>,
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
