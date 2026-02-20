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
  BasicConfig,
  Field,
  Fields,
  ListItem,
  ListValues,
  SelectFieldSettings,
} from '@react-awesome-query-builder/antd';
import { debounce, isEmpty, sortBy, toLower } from 'lodash';
import {
  CustomPropertyEnumConfig,
  SearchOutputType,
} from '../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import {
  CP_TYPE_WITHOUT_KEYWORD_FIELD,
  LIST_VALUE_OPERATORS,
  MULTISELECT_FIELD_OPERATORS,
  NULL_CHECK_OPERATORS,
  NUMBER_FIELD_OPERATORS,
  SEARCH_INDICES_WITH_COLUMNS_FIELD,
  TAG_LABEL_TYPE_LIST_VALUES,
  TEXT_FIELD_OPERATORS,
} from '../constants/AdvancedSearch.constants';
import {
  EntityFields,
  EntityReferenceFields,
  SuggestionField,
} from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';
import { Config } from '../generated/api/data/createCustomProperty';
import { CustomPropertySummary } from '../rest/metadataTypeAPI.interface';
import { getAggregateFieldOptions } from '../rest/miscAPI';
import {
  getCustomPropertyAdvanceSearchEnumOptions,
  renderAdvanceSearchButtons,
} from './AdvancedSearchUtils';
import { getCustomPropertyMomentFormat } from './CustomProperty.utils';
import { buildTermQuery } from './elasticsearchQueryBuilder';
import { getEntityName } from './EntityUtils';
import { t } from './i18next/LocalUtil';
import { renderQueryBuilderFilterButtons } from './QueryBuilderUtils';
import { parseBucketsData } from './SearchUtils';

class AdvancedSearchClassBase {
  baseConfig = AntdConfig;
  configTypes: BasicConfig['types'] = {
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
  configWidgets: BasicConfig['widgets'] = {
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
      elasticSearchFormatValue: (_queryType, value, operator, fieldName) => {
        const newValue = value[0];

        switch (operator) {
          case 'is_null':
            return { field: fieldName };
          case 'is_not_null':
            return { field: fieldName };
          case 'not_like':
            return {
              wildcard: { [fieldName]: { value: `*${newValue}*` } },
            };
          case 'like':
            return { [fieldName]: { value: `*${newValue}*` } };
          case 'not_equal':
            return { term: { [fieldName]: newValue } };
          case 'equal':
            return { [fieldName]: newValue };
          case 'regexp':
            return {
              [fieldName]: { value: newValue, case_insensitive: true },
            };
          default:
            return { [fieldName]: { value: newValue } };
        }
      },
    },
  };
  configOperators = {
    ...this.baseConfig.operators,
    like: {
      ...this.baseConfig.operators.like,
      elasticSearchQueryType: 'wildcard',
    },
    regexp: {
      label: t('label.regular-expression'),
      labelForFormat: t('label.regular-expression'),
      elasticSearchQueryType: 'regexp',
      valueSources: ['value'],
      sqlOp: 'REGEXP',
    },
    multiselect_contains: {
      ...this.baseConfig.operators.multiselect_contains,
      sqlOp: 'IN',
    },
    multiselect_not_contains: {
      ...this.baseConfig.operators.multiselect_not_contains,
      sqlOp: 'NOT IN',
    },
  } as BasicConfig['operators'];

  mainWidgetProps = {
    fullWidth: true,
    valueLabel: t('label.criteria') + ':',
  };

  /**
   * Create an autocomplete function using elasctisearch's suggestion API
   * @param searchIndex Index to search
   * @param suggestField `suggest_` field to use
   */
  public autocomplete: (args: {
    searchIndex: SearchIndex | SearchIndex[];
    entityField: EntityFields | EntityReferenceFields;
    suggestField?: SuggestionField;
    sourceFields?: string;
    sourceFieldOptionType?: {
      label: string;
      value: string;
    };
    q?: string;
  }) => SelectFieldSettings['asyncFetch'] = ({
    searchIndex,
    entityField,
    q = '',
    sourceFields,
    sourceFieldOptionType,
  }) => {
    let pendingResolve: ((result: AsyncFetchListValuesResult) => void) | null =
      null;
    const debouncedFetch = debounce((search: string) => {
      getAggregateFieldOptions(
        searchIndex,
        entityField,
        search ?? '',
        q,
        sourceFields
      )
        .then((response) => {
          const buckets =
            response.data.aggregations[`sterms#${entityField}`].buckets;

          const bucketsData = parseBucketsData(
            buckets,
            sourceFields,
            sourceFieldOptionType
          );

          if (pendingResolve) {
            pendingResolve({
              values: bucketsData as ListItem[],
              hasMore: false,
            });
            pendingResolve = null;
          }
        })
        .catch(() => {
          if (pendingResolve) {
            pendingResolve({
              values: [] as ListItem[],
              hasMore: false,
            });
            pendingResolve = null;
          }
        });
    }, 300);

    return (search) => {
      return new Promise((resolve) => {
        // Resolve previous promise to prevent hanging
        if (pendingResolve) {
          pendingResolve({ values: [] as ListItem[], hasMore: false });
        }
        pendingResolve = resolve;
        debouncedFetch((search as string) ?? '');
      });
    };
  };

  /**
   * Fields specific to database schema
   */
  databaseSchemaQueryBuilderFields: Fields = {
    [EntityFields.DATABASE]: {
      label: t('label.database'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.DATABASE,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to tables
   */
  tableQueryBuilderFields: Fields = {
    [EntityFields.DATABASE]: {
      label: t('label.database'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.DATABASE,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },

    [EntityFields.DATABASE_SCHEMA]: {
      label: t('label.database-schema'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.DATABASE_SCHEMA,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },

    [EntityFields.TABLE_TYPE]: {
      label: t('label.table-type'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.TABLE,
          entityField: EntityFields.TABLE_TYPE,
        }),
        useAsyncSearch: true,
      },
    },

    [EntityFields.COLUMN_DESCRIPTION_STATUS]: {
      label: t('label.column-description'),
      type: 'select',
      operators: LIST_VALUE_OPERATORS,
      mainWidgetProps: this.mainWidgetProps,
      valueSources: ['value'],
      fieldSettings: {
        listValues: {
          INCOMPLETE: t('label.incomplete'),
          COMPLETE: t('label.complete'),
        },
        showSearch: true,
        useAsyncSearch: false,
      },
    },
  };

  /**
   * Fields specific to stored procedures
   */
  storedProcedureQueryBuilderFields: Fields = {
    [EntityFields.DATABASE]: {
      label: t('label.database'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.DATABASE,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },

    [EntityFields.DATABASE_SCHEMA]: {
      label: t('label.database-schema'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.DATABASE_SCHEMA,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to pipelines
   */
  pipelineQueryBuilderFields: Fields = {
    [EntityFields.TASK]: {
      label: t('label.task'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.PIPELINE,
          entityField: EntityFields.TASK,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to topics
   */
  topicQueryBuilderFields: Fields = {
    [EntityFields.SCHEMA_FIELD]: {
      label: t('label.schema-field'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.TOPIC,
          entityField: EntityFields.SCHEMA_FIELD,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to API endpoints
   */
  apiEndpointQueryBuilderFields: Fields = {
    [EntityFields.API_COLLECTION]: {
      label: t('label.api-collection'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.API_COLLECTION_INDEX,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
    [EntityFields.REQUEST_SCHEMA_FIELD]: {
      label: t('label.request-schema-field'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.API_ENDPOINT_INDEX,
          entityField: EntityFields.REQUEST_SCHEMA_FIELD,
        }),
        useAsyncSearch: true,
      },
    },
    [EntityFields.RESPONSE_SCHEMA_FIELD]: {
      label: t('label.response-schema-field'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.API_ENDPOINT_INDEX,
          entityField: EntityFields.RESPONSE_SCHEMA_FIELD,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to Glossary
   */
  glossaryTermQueryBuilderFields: Fields = {
    [EntityFields.GLOSSARY_TERM_STATUS]: {
      label: t('label.status'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.GLOSSARY_TERM,
          entityField: EntityFields.GLOSSARY_TERM_STATUS,
        }),
        useAsyncSearch: true,
      },
    },
    [EntityFields.GLOSSARY]: {
      label: t('label.glossary'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.GLOSSARY,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to dashboard
   */
  dashboardQueryBuilderFields: Fields = {
    [EntityFields.DATA_MODEL]: {
      label: t('label.data-model'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.DASHBOARD_DATA_MODEL,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
    [EntityFields.CHART]: {
      label: t('label.chart'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.CHART,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
    [EntityFields.PROJECT]: {
      label: t('label.project'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.DASHBOARD,
          entityField: EntityFields.PROJECT,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to ML models
   */
  mlModelQueryBuilderFields: Fields = {
    [EntityFields.FEATURE]: {
      label: t('label.feature'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.MLMODEL,
          entityField: EntityFields.FEATURE,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to containers
   */
  containerQueryBuilderFields: Fields = {
    [EntityFields.CONTAINER_COLUMN]: {
      label: t('label.container-column'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.CONTAINER,
          entityField: EntityFields.CONTAINER_COLUMN,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to search indexes
   */
  searchIndexQueryBuilderFields: Fields = {
    [EntityFields.FIELD]: {
      label: t('label.field'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.SEARCH_INDEX,
          entityField: EntityFields.FIELD,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to dashboard data models
   */
  dataModelQueryBuilderFields: Fields = {
    [EntityFields.DATA_MODEL_TYPE]: {
      label: t('label.data-model-type'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.DASHBOARD_DATA_MODEL,
          entityField: EntityFields.DATA_MODEL_TYPE,
        }),
        useAsyncSearch: true,
      },
    },
    [EntityFields.PROJECT]: {
      label: t('label.project'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.DASHBOARD_DATA_MODEL,
          entityField: EntityFields.PROJECT,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to directories
   */
  directorySearchQueryBuilderFields: Fields = {
    [EntityFields.PARENT]: {
      label: t('label.entity-parent', { entity: t('label.directory') }),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.DIRECTORY_SEARCH_INDEX,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to files
   */
  fileSearchQueryBuilderFields: Fields = {
    [EntityFields.DIRECTORY]: {
      label: t('label.directory'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.DIRECTORY_SEARCH_INDEX,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
    [EntityFields.FILE_EXTENSION]: {
      label: t('label.file-extension'),
      type: 'text',
      mainWidgetProps: this.mainWidgetProps,
    },
    [EntityFields.FILE_TYPE]: {
      label: t('label.file-type'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.FILE_SEARCH_INDEX,
          entityField: EntityFields.FILE_TYPE,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to spreadsheets
   */
  spreadsheetSearchQueryBuilderFields: Fields = {
    [EntityFields.DIRECTORY]: {
      label: t('label.directory'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.DIRECTORY_SEARCH_INDEX,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
    [EntityFields.LAST_MODIFIED_BY]: {
      label: t('label.last-modified-by'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.USER,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Fields specific to spreadsheets
   */
  worksheetSearchQueryBuilderFields: Fields = {
    [EntityFields.SPREADSHEET]: {
      label: t('label.spreadsheet'),
      type: 'select',
      mainWidgetProps: this.mainWidgetProps,
      fieldSettings: {
        asyncFetch: this.autocomplete({
          searchIndex: SearchIndex.SPREADSHEET_SEARCH_INDEX,
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
  };

  /**
   * Overriding default configurations.
   * Basic attributes that fields inherit from.
   */
  public getInitialConfigWithoutFields = (isExplorePage = true) => {
    const initialConfigWithoutFields: BasicConfig = {
      ...this.baseConfig,
      types: this.configTypes,
      widgets: this.configWidgets,
      operators: {
        ...this.configOperators,
        like: {
          ...this.baseConfig.operators.like,
          elasticSearchQueryType: 'wildcard',
        },
        ...(isExplorePage
          ? {}
          : {
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
            }),
      },
      settings: {
        ...this.baseConfig.settings,
        showLabels: isExplorePage,
        canReorder: false,
        renderSize: 'medium',
        fieldLabel: t('label.field-plural') + ':',
        operatorLabel: t('label.condition') + ':',
        showNot: false,
        valueLabel: t('label.criteria') + ':',
        removeEmptyGroupsOnLoad: false,
        setOpOnChangeField: ['none'],
        defaultField: EntityFields.OWNERS,
        renderButton: isExplorePage
          ? renderAdvanceSearchButtons
          : renderQueryBuilderFilterButtons,

        customFieldSelectProps: {
          ...this.baseConfig.settings.customFieldSelectProps,
          showSearch: true,
          ['data-testid']: 'advanced-search-field-select',
          // Adding filterOption to search by label
          // Since the default search behavior is by value which gives incorrect results
          // Ex. for search term 'name', it will return 'Task' in results as well
          //     since value for 'Task' is 'tasks.displayName.keyword'
          filterOption: (input: string, option: { label: string }) => {
            return option.label.toLowerCase().includes(input.toLowerCase());
          },
        },
      },
    };

    return initialConfigWithoutFields;
  };

  public autoCompleteTier: (
    tierOptions?: Promise<ListValues>
  ) => SelectFieldSettings['asyncFetch'] = (tierOptions) => {
    return async (search) => {
      const resolvedTierOptions = (await tierOptions) as ListItem[];

      return {
        values: search
          ? resolvedTierOptions.filter((tier) =>
              tier.title
                ?.toLowerCase()
                ?.includes(
                  toLower(Array.isArray(search) ? search.join(',') : search)
                )
            )
          : resolvedTierOptions,
        hasMore: false,
      } as AsyncFetchListValuesResult;
    };
  };

  public getCommonConfig(args: {
    entitySearchIndex?: Array<SearchIndex>;
  }): Fields {
    const { entitySearchIndex = [SearchIndex.TABLE] } = args;

    return {
      [EntityFields.DISPLAY_NAME_KEYWORD]: {
        label: t('label.display-name'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        fieldSettings: {
          asyncFetch: this.autocomplete({
            searchIndex: entitySearchIndex,
            entityField: EntityFields.DISPLAY_NAME_KEYWORD,
          }),
          useAsyncSearch: true,
        },
        operators: [
          'select_equals',
          'select_not_equals',
          'select_any_in',
          'select_not_any_in',
          'like',
          'not_like',
          'regexp',
        ],
      },
      [EntityFields.NAME_KEYWORD]: {
        label: t('label.name'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        fieldSettings: {
          asyncFetch: this.autocomplete({
            searchIndex: entitySearchIndex,
            entityField: EntityFields.NAME_KEYWORD,
            sourceFields: 'name',
          }),
          useAsyncSearch: true,
        },
        operators: [
          'select_equals',
          'select_not_equals',
          'select_any_in',
          'select_not_any_in',
          'like',
          'not_like',
          'regexp',
        ],
      },

      deleted: {
        label: t('label.deleted'),
        type: 'boolean',
        defaultValue: true,
      },

      [EntityFields.OWNERS]: {
        label: t('label.owner-plural'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,

        fieldSettings: {
          asyncFetch: this.autocomplete({
            searchIndex: [SearchIndex.USER, SearchIndex.TEAM],
            entityField: EntityFields.DISPLAY_NAME_KEYWORD,
          }),
          useAsyncSearch: true,
        },
      },

      [EntityFields.DOMAINS]: {
        label: t('label.domain-plural'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,

        fieldSettings: {
          asyncFetch: this.autocomplete({
            searchIndex: SearchIndex.DOMAIN,
            entityField: EntityFields.DISPLAY_NAME_KEYWORD,
          }),
          useAsyncSearch: true,
        },
      },

      [EntityFields.DATA_PRODUCT]: {
        label: t('label.data-product'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,

        fieldSettings: {
          asyncFetch: this.autocomplete({
            searchIndex: SearchIndex.DATA_PRODUCT,
            entityField: EntityFields.DISPLAY_NAME_KEYWORD,
          }),
          useAsyncSearch: true,
        },
      },

      [EntityFields.SERVICE_TYPE]: {
        label: t('label.service-type'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,

        fieldSettings: {
          asyncFetch: this.autocomplete({
            searchIndex: entitySearchIndex,
            entityField: EntityFields.SERVICE_TYPE,
          }),
          useAsyncSearch: true,
        },
      },

      [EntityFields.TAG]: {
        label: t('label.tag-plural'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        fieldSettings: {
          asyncFetch: this.autocomplete({
            searchIndex: [SearchIndex.TAG, SearchIndex.GLOSSARY_TERM],
            entityField: EntityFields.FULLY_QUALIFIED_NAME,
            q: buildTermQuery(
              [
                {
                  field: 'classification.name.keyword',
                  value: 'tier',
                  negate: true,
                },
                {
                  field: 'classification.name.keyword',
                  value: 'certification',
                  negate: true,
                },
              ],
              true
            ) as string,
          }),
          useAsyncSearch: true,
        },
      },

      [EntityFields.CERTIFICATION]: {
        label: t('label.certification'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        fieldSettings: {
          asyncFetch: this.autocomplete({
            searchIndex: [SearchIndex.TAG],
            entityField: EntityFields.FULLY_QUALIFIED_NAME,
            q: buildTermQuery(
              {
                field: 'classification.name.keyword',
                value: 'certification',
              },
              true
            ) as string,
          }),
          useAsyncSearch: true,
        },
      },

      [EntityFields.TIER]: {
        label: t('label.tier'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        fieldSettings: {
          asyncFetch: this.autocomplete({
            searchIndex: [SearchIndex.TAG],
            entityField: EntityFields.FULLY_QUALIFIED_NAME,
            q: buildTermQuery(
              {
                field: 'classification.name.keyword',
                value: 'tier',
              },
              true
            ) as string,
          }),
          useAsyncSearch: true,
        },
      },
      extension: {
        label: t('label.custom-property-plural'),
        type: '!group',
        mainWidgetProps: this.mainWidgetProps,
        subfields: {},
      },
      descriptionStatus: {
        label: t('label.description'),
        type: 'select',
        operators: LIST_VALUE_OPERATORS,
        mainWidgetProps: this.mainWidgetProps,
        valueSources: ['value'],
        fieldSettings: {
          listValues: {
            INCOMPLETE: t('label.incomplete'),
            COMPLETE: t('label.complete'),
          },
          showSearch: true,
          useAsyncSearch: false,
        },
      },
      [EntityFields.ENTITY_TYPE]: {
        label: t('label.entity-type-plural', { entity: t('label.entity') }),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,

        fieldSettings: {
          asyncFetch: this.autocomplete({
            searchIndex: entitySearchIndex,
            entityField: EntityFields.ENTITY_TYPE,
          }),
          useAsyncSearch: true,
        },
      },
      [EntityFields.SUGGESTED_DESCRIPTION]: {
        label: t('label.suggested-description'),
        type: 'select',
        operators: NULL_CHECK_OPERATORS,
        mainWidgetProps: this.mainWidgetProps,
        valueSources: ['value'],
      },
      [EntityFields.TAGS_LABEL_TYPE]: {
        label: t('label.tag-label-type'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        valueSources: ['value'],
        fieldSettings: {
          listValues: TAG_LABEL_TYPE_LIST_VALUES,
        },
      },
      [EntityFields.TIER_LABEL_TYPE]: {
        label: t('label.tier-label-type'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        valueSources: ['value'],
        fieldSettings: {
          listValues: TAG_LABEL_TYPE_LIST_VALUES,
        },
      },
      [EntityFields.CREATED_BY]: {
        label: t('label.created-by'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        fieldSettings: {
          asyncFetch: this.autocomplete({
            searchIndex: [SearchIndex.USER],
            entityField: EntityFields.DISPLAY_NAME_KEYWORD,
          }),
          useAsyncSearch: true,
        },
      },
    };
  }

  // Since the column field key 'columns.name.keyword` is common in table and data model,
  // Following function is used to get the column field config if all the search Indices have columns field
  // or for ALL and DATA_ASSET search indices
  public getColumnConfig = (entitySearchIndex: SearchIndex[]) => {
    const shouldAddColumnField = entitySearchIndex.every((index) =>
      SEARCH_INDICES_WITH_COLUMNS_FIELD.includes(index)
    );

    return shouldAddColumnField
      ? {
          [EntityFields.COLUMN]: {
            label: t('label.column'),
            type: 'select',
            mainWidgetProps: this.mainWidgetProps,
            fieldSettings: {
              asyncFetch: this.autocomplete({
                searchIndex: entitySearchIndex,
                entityField: EntityFields.COLUMN,
              }),
              useAsyncSearch: true,
            },
          },
        }
      : {};
  };

  /**
   * Get entity specific fields for the query builder
   */
  public getEntitySpecificQueryBuilderFields(
    entitySearchIndex = [SearchIndex.TABLE]
  ): Fields {
    let configs: Fields = {};
    const configIndexMapping: Partial<Record<SearchIndex, Fields>> = {
      [SearchIndex.TABLE]: this.tableQueryBuilderFields,
      [SearchIndex.PIPELINE]: this.pipelineQueryBuilderFields,
      [SearchIndex.DASHBOARD]: this.dashboardQueryBuilderFields,
      [SearchIndex.TOPIC]: this.topicQueryBuilderFields,
      [SearchIndex.MLMODEL]: this.mlModelQueryBuilderFields,
      [SearchIndex.CONTAINER]: this.containerQueryBuilderFields,
      [SearchIndex.SEARCH_INDEX]: this.searchIndexQueryBuilderFields,
      [SearchIndex.DASHBOARD_DATA_MODEL]: this.dataModelQueryBuilderFields,
      [SearchIndex.API_ENDPOINT_INDEX]: this.apiEndpointQueryBuilderFields,
      [SearchIndex.GLOSSARY_TERM]: this.glossaryTermQueryBuilderFields,
      [SearchIndex.DATABASE_SCHEMA]: this.databaseSchemaQueryBuilderFields,
      [SearchIndex.STORED_PROCEDURE]: this.storedProcedureQueryBuilderFields,
      [SearchIndex.DIRECTORY_SEARCH_INDEX]:
        this.directorySearchQueryBuilderFields,
      [SearchIndex.FILE_SEARCH_INDEX]: this.fileSearchQueryBuilderFields,
      [SearchIndex.SPREADSHEET_SEARCH_INDEX]:
        this.spreadsheetSearchQueryBuilderFields,
      [SearchIndex.WORKSHEET_SEARCH_INDEX]:
        this.worksheetSearchQueryBuilderFields,
      [SearchIndex.ALL]: {
        ...this.tableQueryBuilderFields,
        ...this.pipelineQueryBuilderFields,
        ...this.dashboardQueryBuilderFields,
        ...this.topicQueryBuilderFields,
        ...this.mlModelQueryBuilderFields,
        ...this.containerQueryBuilderFields,
        ...this.searchIndexQueryBuilderFields,
        ...this.dataModelQueryBuilderFields,
        ...this.apiEndpointQueryBuilderFields,
        ...this.directorySearchQueryBuilderFields,
        ...this.fileSearchQueryBuilderFields,
        ...this.spreadsheetSearchQueryBuilderFields,
        ...this.worksheetSearchQueryBuilderFields,
      },
      [SearchIndex.DATA_ASSET]: {
        ...this.tableQueryBuilderFields,
        ...this.pipelineQueryBuilderFields,
        ...this.dashboardQueryBuilderFields,
        ...this.topicQueryBuilderFields,
        ...this.mlModelQueryBuilderFields,
        ...this.containerQueryBuilderFields,
        ...this.searchIndexQueryBuilderFields,
        ...this.dataModelQueryBuilderFields,
        ...this.apiEndpointQueryBuilderFields,
        ...this.glossaryTermQueryBuilderFields,
        ...this.directorySearchQueryBuilderFields,
        ...this.fileSearchQueryBuilderFields,
        ...this.spreadsheetSearchQueryBuilderFields,
        ...this.worksheetSearchQueryBuilderFields,
      },
    };

    // Find out the common fields between the selected indices
    if (!isEmpty(entitySearchIndex)) {
      const firstIndex = entitySearchIndex[0];

      // Fields config for the first index
      configs = { ...configIndexMapping[firstIndex] };

      // Iterate over the rest of the indices to see the common fields
      entitySearchIndex.slice(1).forEach((index) => {
        // Get the current config for the current iteration index
        const currentConfig = configIndexMapping[index] ?? {};

        // Filter out the fields that are not common between the current and previous configs
        configs = Object.keys(configs).reduce((acc, key) => {
          // If the key exists in the current config, add it to the accumulator
          if (currentConfig[key]) {
            acc[key] = configs[key];
          }

          return acc;
        }, {} as Fields);
      });
    }

    return configs;
  }

  /**
   * Common fields that exit for all searchable entities
   */
  public getQueryBuilderFields = ({
    entitySearchIndex = [SearchIndex.TABLE],
    shouldAddServiceField = true,
  }: {
    entitySearchIndex?: Array<SearchIndex>;
    shouldAddServiceField?: boolean;
  }) => {
    const serviceQueryBuilderFields: Fields = {
      [EntityFields.SERVICE]: {
        label: t('label.service'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        fieldSettings: {
          asyncFetch: this.autocomplete({
            searchIndex: entitySearchIndex,
            entityField: EntityFields.SERVICE,
          }),
          useAsyncSearch: true,
        },
      },
    };

    const fieldsConfig = {
      ...this.getCommonConfig({ entitySearchIndex }),
      ...(shouldAddServiceField ? serviceQueryBuilderFields : {}),
      ...this.getEntitySpecificQueryBuilderFields(entitySearchIndex),
      ...this.getColumnConfig(entitySearchIndex),
    };

    // Sort the fields according to the label
    const sortedFieldsConfig = sortBy(Object.entries(fieldsConfig), '1.label');

    return Object.fromEntries(sortedFieldsConfig);
  };

  /**
   * Builds search index specific configuration for the query builder
   */
  public getQbConfigs: (
    entitySearchIndex?: Array<SearchIndex>,
    isExplorePage?: boolean
  ) => BasicConfig = (entitySearchIndex, isExplorePage) => {
    const searchIndexWithServices = [
      SearchIndex.DATA_ASSET,
      SearchIndex.TABLE,
      SearchIndex.DASHBOARD,
      SearchIndex.PIPELINE,
      SearchIndex.MLMODEL,
      SearchIndex.TOPIC,
      SearchIndex.CONTAINER,
      SearchIndex.SEARCH_INDEX,
      SearchIndex.DATABASE,
      SearchIndex.DATABASE_SCHEMA,
      SearchIndex.DATABASE_SERVICE,
      SearchIndex.MESSAGING_SERVICE,
      SearchIndex.DASHBOARD_SERVICE,
      SearchIndex.PIPELINE_SERVICE,
      SearchIndex.ML_MODEL_SERVICE,
      SearchIndex.SEARCH_SERVICE,
      SearchIndex.STORAGE_SERVICE,
      SearchIndex.API_SERVICE_INDEX,
      SearchIndex.API_ENDPOINT_INDEX,
      SearchIndex.API_COLLECTION_INDEX,
      SearchIndex.DASHBOARD_DATA_MODEL,
      SearchIndex.STORED_PROCEDURE,
    ];

    const shouldAddServiceField =
      entitySearchIndex &&
      searchIndexWithServices.some((index) =>
        entitySearchIndex.includes(index)
      );

    return {
      ...this.getInitialConfigWithoutFields(isExplorePage),
      fields: {
        ...this.getQueryBuilderFields({
          entitySearchIndex,
          shouldAddServiceField,
        }),
      },
    };
  };

  public getCustomPropertiesSubFields(
    field: CustomPropertySummary,
    searchOutputType: SearchOutputType = SearchOutputType.ElasticSearch
  ):
    | { subfieldsKey: string; dataObject: Field }
    | Array<{ subfieldsKey: string; dataObject: Field }> {
    const label = getEntityName(field);

    let subfieldsKey: string;
    const isEntityReferenceType =
      field.type === 'array<entityReference>' ||
      field.type === 'entityReference';

    if (isEntityReferenceType) {
      subfieldsKey =
        searchOutputType === SearchOutputType.ElasticSearch
          ? field.name + '.displayName.keyword'
          : field.name + '.displayName';
    } else if (searchOutputType === SearchOutputType.ElasticSearch) {
      subfieldsKey = CP_TYPE_WITHOUT_KEYWORD_FIELD.includes(field.type)
        ? field.name
        : field.name + '.keyword';
    } else {
      subfieldsKey = field.name;
    }

    switch (field.type) {
      case 'array<entityReference>':
      case 'entityReference':
        return {
          subfieldsKey,
          dataObject: {
            type: 'select',
            label,
            fieldSettings: {
              asyncFetch: this.autocomplete({
                searchIndex: (
                  (field.customPropertyConfig?.config ?? []) as string[]
                ).join(',') as SearchIndex,
                entityField: EntityFields.DISPLAY_NAME_KEYWORD,
              }),
              useAsyncSearch: true,
            },
          },
        };

      case 'enum':
        return {
          subfieldsKey,
          dataObject: {
            type: 'multiselect',
            label,
            operators: MULTISELECT_FIELD_OPERATORS,
            fieldSettings: {
              listValues: getCustomPropertyAdvanceSearchEnumOptions(
                (field.customPropertyConfig?.config as CustomPropertyEnumConfig)
                  .values
              ),
              showSearch: true,
              useAsyncSearch: false,
            },
          },
        };

      case 'date-cp':
      case 'dateTime-cp': {
        const dateFormat = getCustomPropertyMomentFormat(
          field.type,
          field.customPropertyConfig?.config
        );

        return {
          subfieldsKey,
          dataObject: {
            type: 'date',
            label,
            operators: NUMBER_FIELD_OPERATORS,
            fieldSettings: {
              valueFormat: dateFormat,
              dateFormat,
            },
          },
        };
      }

      case 'timestamp':
      case 'integer':
      case 'number': {
        return {
          subfieldsKey,
          dataObject: {
            type: 'number',
            label,
            operators: NUMBER_FIELD_OPERATORS,
          },
        };
      }

      case 'timeInterval': {
        return [
          {
            subfieldsKey: `${field.name}.start`,
            dataObject: {
              type: 'number',
              label: `${label} (${t('label.start')})`,
              operators: NUMBER_FIELD_OPERATORS,
              fieldSettings: {
                min: 0,
              },
            },
          },
          {
            subfieldsKey: `${field.name}.end`,
            dataObject: {
              type: 'number',
              label: `${label} (${t('label.end')})`,
              operators: NUMBER_FIELD_OPERATORS,
              fieldSettings: {
                min: 0,
              },
            },
          },
        ];
      }

      case 'hyperlink-cp': {
        return [
          {
            subfieldsKey: `${field.name}.url.keyword`,
            dataObject: {
              type: 'text',
              label: `${label} ${t('label.url')}`,
              operators: TEXT_FIELD_OPERATORS,
            },
          },
          {
            subfieldsKey: `${field.name}.displayText.keyword`,
            dataObject: {
              type: 'text',
              label: `${label} ${t('label.display-text')}`,
              operators: TEXT_FIELD_OPERATORS,
            },
          },
        ];
      }

      case 'table-cp': {
        const config = field.customPropertyConfig?.config as Config | undefined;
        const columns = config?.columns ?? [];

        if (columns.length === 0) {
          return [];
        }

        return columns.map((columnName) => ({
          subfieldsKey: `${field.name}.rows.${columnName}.keyword`,
          dataObject: {
            type: 'text',
            label: `${label} - ${columnName}`,
            operators: TEXT_FIELD_OPERATORS,
            valueSources: ['value'],
          },
        }));
      }

      default:
        return {
          subfieldsKey,
          dataObject: {
            type: 'text',
            label,
            valueSources: ['value'],
            operators: TEXT_FIELD_OPERATORS,
          },
        };
    }
  }
}

const advancedSearchClassBase = new AdvancedSearchClassBase();

export default advancedSearchClassBase;

export { AdvancedSearchClassBase };
