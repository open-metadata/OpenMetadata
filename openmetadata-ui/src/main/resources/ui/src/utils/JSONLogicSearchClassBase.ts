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
import { sortBy } from 'lodash';
import {
  AsyncFetchListValues,
  BasicConfig,
  Fields,
} from 'react-awesome-query-builder';
import AntdConfig from 'react-awesome-query-builder/lib/config/antd';
import {
  EntityFields,
  EntityReferenceFields,
} from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';
import advancedSearchClassBase from './AdvancedSearchClassBase';

class JSONLogicSearchClassBase {
  baseConfig = AntdConfig as BasicConfig;
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
    },
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
      fieldSettings: {
        asyncFetch: advancedSearchClassBase.autocomplete({
          searchIndex: [SearchIndex.USER, SearchIndex.TEAM],
          entityField: EntityFields.DISPLAY_NAME_KEYWORD,
        }),
        useAsyncSearch: true,
      },
    },
  };

  public getCommonConfig = (args: {
    entitySearchIndex?: Array<SearchIndex>;
    tierOptions?: Promise<AsyncFetchListValues>;
  }) => {
    const {
      entitySearchIndex = [SearchIndex.TABLE],
      tierOptions = Promise.resolve([]),
    } = args;

    return {
      [EntityReferenceFields.DISPLAY_NAME]: {
        label: t('label.display-name'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        fieldSettings: {
          asyncFetch: advancedSearchClassBase.autocomplete({
            searchIndex: SearchIndex.DATA_ASSET,
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
      [EntityReferenceFields.DESCRIPTION]: {
        label: t('label.description'),
        type: 'text',
        mainWidgetProps: this.mainWidgetProps,
      },
      [EntityReferenceFields.TAG]: {
        label: t('label.tag-plural'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        fieldSettings: {
          asyncFetch: advancedSearchClassBase.autocomplete({
            searchIndex: entitySearchIndex ?? [
              (SearchIndex.TAG, SearchIndex.GLOSSARY_TERM),
            ],
            entityField: EntityFields.TAG,
          }),
          useAsyncSearch: true,
        },
      },

      [EntityReferenceFields.TIER]: {
        label: t('label.tier'),
        type: 'select',
        mainWidgetProps: this.mainWidgetProps,
        fieldSettings: {
          asyncFetch: advancedSearchClassBase.autoCompleteTier(tierOptions),
          useAsyncSearch: true,
        },
      },
      extension: {
        label: t('label.custom-property-plural'),
        type: '!group',
        mainWidgetProps: this.mainWidgetProps,
        subfields: {},
      },
    };
  };

  public getEntitySpecificQueryBuilderFields(
    entitySearchIndex = [SearchIndex.TABLE]
  ): Fields {
    let configs: Fields = {};
    const configIndexMapping: Partial<Record<SearchIndex, Fields>> = {
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

  public getQbConfigs: (
    tierOptions: Promise<AsyncFetchListValues>,
    entitySearchIndex?: Array<SearchIndex>,
    isExplorePage?: boolean
  ) => BasicConfig = (tierOptions, entitySearchIndex, isExplorePage) => {
    return {
      ...advancedSearchClassBase.getInitialConfigWithoutFields(isExplorePage),
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
