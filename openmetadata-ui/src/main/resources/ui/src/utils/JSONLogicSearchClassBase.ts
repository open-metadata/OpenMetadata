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
  Config,
  FieldOrGroup,
  Fields,
  ListItem,
  Operators,
  SelectFieldSettings,
} from '@react-awesome-query-builder/antd';
import { get, sortBy, toLower } from 'lodash';
import {
  LIST_VALUE_OPERATORS,
  MULTISELECT_FIELD_OPERATORS,
  RANGE_FIELD_OPERATORS,
  TEXT_FIELD_DESCRIPTION_OPERATORS,
} from '../constants/AdvancedSearch.constants';
import { PAGE_SIZE_BASE } from '../constants/constants';
import {
  COMMON_ENTITY_FIELDS_KEYS,
  GLOSSARY_ENTITY_FIELDS_KEYS,
  TABLE_ENTITY_FIELDS_KEYS,
} from '../constants/JSONLogicSearch.constants';
import {
  EntityFields,
  EntityReferenceFields,
} from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';
import { EntityStatus } from '../generated/entity/data/glossaryTerm';
import { searchQuery } from '../rest/searchAPI';
import { getTags } from '../rest/tagAPI';
import advancedSearchClassBase from './AdvancedSearchClassBase';
import { t } from './i18next/LocalUtil';
import {
  getFieldsByKeys,
  renderJSONLogicQueryBuilderButtons,
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
        multiselect: {
          operators: [
            ...(this.baseConfig.types.multiselect?.widgets?.multiselect
              ?.operators || []),
            'array_contains',
            'array_not_contains',
          ],
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
        select: {
          operators: [
            ...(this.baseConfig.types.select?.widgets?.select?.operators || []),
            'array_contains',
            'array_not_contains',
          ],
        },
      },
      valueSources: ['value'],
    },
    text: {
      ...this.baseConfig.types.text,
      valueSources: ['value'],
    },
    date: {
      ...this.baseConfig.types.date,
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
    date: {
      ...this.baseConfig.widgets.date,
      jsonLogic: function (val) {
        // Convert date to Unix timestamp (milliseconds)
        return this.utils.moment.utc(val).valueOf();
      },
      jsonLogicImport: function (val) {
        // Check if valueFormat indicates timestamp
        return this.utils.moment.utc(val).toISOString();
      },
    },
  };
  configOperators: Config['operators'] = {
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
      sqlOp: 'REGEXP',
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
      jsonLogic: 'isReviewer',
      sqlOp: 'IS REVIEWER',
    },
    isOwner: {
      label: t('label.is-entity', { entity: t('label.owner') }),
      labelForFormat: t('label.is-entity', { entity: t('label.owner') }),
      cardinality: 0,
      jsonLogic: 'isOwner',
      sqlOp: 'IS OWNER',
    },
    array_contains: {
      label: t('label.contain-plural'),
      labelForFormat: t('label.contain-plural'),
      valueTypes: ['multiselect', 'select'],
      cardinality: 1,
      valueSources: ['value'],
      jsonLogic: 'contains',
    },
    array_not_contains: {
      label: t('label.not-contain-plural'),
      labelForFormat: t('label.not-contain-plural'),
      valueTypes: ['multiselect', 'select'],
      valueSources: ['value'],
      reversedOp: 'array_contains',
    },
  };

  private _mapFieldsCache?: Record<string, FieldOrGroup>;

  defaultSelectOperators = [
    'select_equals',
    'select_not_equals',
    'select_any_in',
    'select_not_any_in',
    'is_null',
    'is_not_null',
  ];

  public get mapFields(): Record<string, FieldOrGroup> {
    if (this._mapFieldsCache) {
      return this._mapFieldsCache;
    }

    this._mapFieldsCache = {
      [EntityReferenceFields.SERVICE]: {
        label: t('label.service'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        operators: this.defaultSelectOperators,
        fieldSettings: {
          asyncFetch: advancedSearchClassBase.autocomplete({
            searchIndex: SearchIndex.ALL,
            entityField: EntityFields.SERVICE_NAME,
            sourceFields: 'service.name',
          }),
          useAsyncSearch: true,
        },
      },
      [EntityReferenceFields.OWNERS]: {
        label: t('label.owner-plural'),
        type: '!group',
        mode: 'some',
        defaultField: EntityFields.FULLY_QUALIFIED_NAME,
        subfields: {
          [EntityFields.FULLY_QUALIFIED_NAME]: {
            label: 'Owners',
            type: 'select',
            mainWidgetProps: this.mainWidgetProps,
            operators: this.defaultSelectOperators,
            fieldSettings: {
              asyncFetch: advancedSearchClassBase.autocomplete({
                searchIndex: [SearchIndex.USER, SearchIndex.TEAM],
                entityField: EntityFields.DISPLAY_NAME_KEYWORD,
                sourceFields: 'displayName,fullyQualifiedName',
                sourceFieldOptionType: {
                  label: 'displayName',
                  value: 'fullyQualifiedName',
                },
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
        defaultOperator: 'like',
        mainWidgetProps: this.mainWidgetProps,
        operators: TEXT_FIELD_DESCRIPTION_OPERATORS,
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
      [EntityReferenceFields.DATA_PRODUCTS]: {
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
            sourceFields: 'database.name',
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
            sourceFields: 'databaseSchema.name',
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

      [EntityReferenceFields.ENTITY_STATUS]: {
        label: t('label.status'),
        type: 'select',
        operators: LIST_VALUE_OPERATORS,
        mainWidgetProps: this.mainWidgetProps,
        valueSources: ['value'],
        fieldSettings: {
          listValues: Object.values(EntityStatus).map((status) => ({
            value: status,
            title: status,
          })),
          showSearch: true,
          useAsyncSearch: false,
        },
      },

      [EntityReferenceFields.REVIEWERS]: {
        label: t('label.reviewer-plural'),
        type: '!group',
        mode: 'some',
        defaultField: EntityFields.FULLY_QUALIFIED_NAME,
        subfields: {
          [EntityFields.FULLY_QUALIFIED_NAME]: {
            label: 'Reviewers New',
            type: 'select',
            mainWidgetProps: this.mainWidgetProps,
            operators: this.defaultSelectOperators,
            fieldSettings: {
              asyncFetch: advancedSearchClassBase.autocomplete({
                searchIndex: [SearchIndex.USER, SearchIndex.TEAM],
                entityField: EntityFields.DISPLAY_NAME_KEYWORD,
                sourceFields: 'displayName,fullyQualifiedName',
                sourceFieldOptionType: {
                  label: 'displayName',
                  value: 'fullyQualifiedName',
                },
              }),
              useAsyncSearch: true,
            },
          },
        },
      },
      [EntityReferenceFields.SYNONYMS]: {
        label: t('label.synonym-plural'),
        type: 'multiselect',
        preferWidgets: ['multiselect'],
        defaultOperator: 'like',
        mainWidgetProps: this.mainWidgetProps,
        operators: ['like', 'not_like', 'is_null', 'is_not_null'],
        widgets: {
          multiselect: {
            operators: ['like', 'not_like', 'is_null', 'is_not_null'],
            widgetProps: {
              customProps: {
                open: false,
              },
            },
          },
        },
        fieldSettings: {
          allowCustomValues: true,
          showSearch: false,
        },
      },
      [EntityReferenceFields.RELATED_TERMS]: {
        label: t('label.related-term-plural'),
        type: '!group',
        mode: 'some',
        defaultField: EntityFields.FULLY_QUALIFIED_NAME,
        subfields: {
          [EntityFields.FULLY_QUALIFIED_NAME]: {
            label: 'Related Terms',
            type: 'multiselect',
            defaultOperator: 'multiselect_equals',
            mainWidgetProps: this.mainWidgetProps,
            operators: MULTISELECT_FIELD_OPERATORS,
            fieldSettings: {
              asyncFetch: this.searchAutocomplete({
                searchIndex: SearchIndex.GLOSSARY_TERM,
                fieldName: 'fullyQualifiedName',
                fieldLabel: 'name',
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
      [EntityReferenceFields.UPDATED_AT]: {
        label: t('label.updated-on'),
        type: 'date',
        mainWidgetProps: this.mainWidgetProps,
        defaultOperator: 'between',
        operators: [
          ...RANGE_FIELD_OPERATORS,
          'less',
          'less_or_equal',
          'greater',
          'greater_or_equal',
        ],
      },
      [EntityReferenceFields.VERSION]: {
        label: t('label.version'),
        type: 'number',
        mainWidgetProps: this.mainWidgetProps,
        operators: [
          'equal',
          'not_equal',
          'less',
          'less_or_equal',
          'greater',
          'greater_or_equal',
        ],
      },
    };

    return this._mapFieldsCache;
  }

  public getMapFields = () => {
    return this.mapFields;
  };

  public searchAutocomplete: (args: {
    searchIndex: SearchIndex | SearchIndex[];
    fieldName: string;
    fieldLabel: string;
    queryFilter?: Record<string, unknown>;
  }) => SelectFieldSettings['asyncFetch'] = ({
    searchIndex,
    fieldName,
    fieldLabel,
    queryFilter,
  }) => {
    return (search) => {
      return searchQuery({
        query: Array.isArray(search) ? search.join(',') : search ?? '',
        pageNumber: 1,
        pageSize: PAGE_SIZE_BASE,
        queryFilter,
        searchIndex: searchIndex ?? SearchIndex.DATA_ASSET,
      }).then((response) => {
        const data = response.hits.hits;

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

    for (const index of entitySearchIndex) {
      configs = { ...configs, ...(configIndexMapping[index] ?? {}) };
    }

    return configs;
  }
  /**
   * Common fields that exit for all searchable entities
   */
  public getQueryBuilderFields = ({
    entitySearchIndex = [SearchIndex.TABLE],
  }: {
    entitySearchIndex?: Array<SearchIndex>;
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
    entitySearchIndex?: Array<SearchIndex>,
    isExplorePage?: boolean
  ) => Config = (entitySearchIndex, isExplorePage) => {
    return {
      ...this.getInitialConfigWithoutFields(isExplorePage),
      fields: {
        ...this.getQueryBuilderFields({
          entitySearchIndex,
        }),
      },
    };
  };

  // Custom handling for array_not_contains operator
  // Check the tree structure to determine if array_not_contains was used
  // Return the rule with negation applied at group level
  getNegativeQueryForNotContainsReverserOperation = (
    logic: Record<string, unknown>
  ) => {
    const processNotContains = (
      logic: Record<string, unknown>
    ): Record<string, unknown> | unknown => {
      if (!logic || typeof logic !== 'object') {
        return logic;
      }

      // Check if this is a "some" operation with nested "!" and "contains"
      // This pattern is generated when array_not_contains is used with reversedOp
      if (logic.some && Array.isArray(logic.some)) {
        const [variable, condition] = logic.some as [
          unknown,
          Record<string, unknown>
        ];

        // Check if the condition has a negated contains (indicating array_not_contains was used)
        if (
          condition &&
          condition['!'] &&
          typeof condition['!'] === 'object' &&
          (condition['!'] as Record<string, unknown>).contains
        ) {
          // Transform to NOT around the entire some operation
          return {
            '!': {
              some: [
                variable,
                {
                  contains: (condition['!'] as Record<string, unknown>)
                    .contains,
                },
              ],
            },
          };
        }
      }

      // Recursively process nested logic
      if (logic.and && Array.isArray(logic.and)) {
        return {
          and: logic.and.map((item: unknown) =>
            processNotContains(item as Record<string, unknown>)
          ),
        };
      }
      if (logic.or && Array.isArray(logic.or)) {
        return {
          or: logic.or.map((item: unknown) =>
            processNotContains(item as Record<string, unknown>)
          ),
        };
      }

      return logic;
    };

    return processNotContains(logic);
  };
}

const jsonLogicSearchClassBase = new JSONLogicSearchClassBase();

export default jsonLogicSearchClassBase;

export { JSONLogicSearchClassBase };
