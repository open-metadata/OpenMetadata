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
import type { OldJsonTree } from '@react-awesome-query-builder/antd';
import { Utils as QbUtils } from '@react-awesome-query-builder/antd';
import { isArray, isEmpty, toLower } from 'lodash';
import type { Bucket } from 'Models';
import type { ExploreQuickFilterField } from '../components/Explore/ExplorePage.interface';
import { AssetsOfEntity } from '../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import type { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import {
  COMMON_DROPDOWN_ITEMS,
  DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS,
  GLOSSARY_ASSETS_DROPDOWN_ITEMS,
  LINEAGE_DROPDOWN_ITEMS,
  TAG_ASSETS_DROPDOWN_ITEMS,
} from '../constants/AdvancedSearch.constants';
import { NOT_INCLUDE_AGGREGATION_QUICK_FILTER } from '../constants/explore.constants';
import {
  EntityFields,
  EntityReferenceFields,
} from '../enums/AdvancedSearch.enum';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import type {
  ContainerSearchSource,
  DashboardSearchSource,
  ExploreSearchSource,
  MlmodelSearchSource,
  PipelineSearchSource,
  SuggestOption,
  TableSearchSource,
  TopicSearchSource,
} from '../interface/search.interface';
import { getEntityName } from './EntityNameUtils';

export const getAssetsPageQuickFilters = (
  type?: AssetsOfEntity
): ExploreQuickFilterField[] => {
  switch (type) {
    case AssetsOfEntity.DOMAIN:
    case AssetsOfEntity.DATA_PRODUCT:
    case AssetsOfEntity.DATA_PRODUCT_INPUT_PORT:
    case AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT:
      return [...DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS];

    case AssetsOfEntity.GLOSSARY:
      return [...GLOSSARY_ASSETS_DROPDOWN_ITEMS];

    case AssetsOfEntity.TAG:
      return [...TAG_ASSETS_DROPDOWN_ITEMS];

    case AssetsOfEntity.LINEAGE:
      return [...LINEAGE_DROPDOWN_ITEMS];

    default:
      return [...COMMON_DROPDOWN_ITEMS];
  }
};

export const getSearchLabel = (itemLabel: string, searchKey: string) => {
  const regex = new RegExp(searchKey, 'gi');
  if (searchKey) {
    const result = itemLabel.replace(regex, (match) => `<mark>${match}</mark>`);

    return result;
  } else {
    return itemLabel;
  }
};

export const getSelectedOptionLabelString = (
  selectedOptions: SearchDropdownOption[],
  showAllOptions = false
) => {
  if (isArray(selectedOptions)) {
    const stringifiedOptions = selectedOptions.map((op) => op.label).join(', ');
    if (stringifiedOptions.length < 15 || showAllOptions) {
      return stringifiedOptions;
    } else {
      return `${stringifiedOptions.slice(0, 11)}...`;
    }
  } else {
    return '';
  }
};

export const getChartsOptions = (
  option: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const chartRef = (
    option as SuggestOption<SearchIndex.DASHBOARD, DashboardSearchSource>
  )._source.charts?.find(
    (chart) => chart.displayName === option.text || chart.name === option.text
  );

  const entityName = getEntityName(chartRef);

  return isEmpty(entityName) ? option.text : entityName;
};

export const getDataModelOptions = (
  option: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const chartRef = (
    option as SuggestOption<SearchIndex.DASHBOARD, DashboardSearchSource>
  )._source.dataModels?.find(
    (dataModel) =>
      dataModel.displayName === option.text || dataModel.name === option.text
  );

  const entityName = getEntityName(chartRef);

  return isEmpty(entityName) ? option.text : entityName;
};

export const getTasksOptions = (
  option: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const taskRef = (
    option as SuggestOption<SearchIndex.PIPELINE, PipelineSearchSource>
  )._source.tasks?.find(
    (task) => task.displayName === option.text || task.name === option.text
  );

  const entityName = getEntityName(taskRef);

  return isEmpty(entityName) ? option.text : entityName;
};

export const getColumnsOptions = (
  option: SuggestOption<SearchIndex, ExploreSearchSource>,
  index: SearchIndex
) => {
  if (index === SearchIndex.TABLE) {
    const columnRef = (
      option as SuggestOption<SearchIndex.TABLE, TableSearchSource>
    )._source.columns.find(
      (column) =>
        column.displayName === option.text || column.name === option.text
    );

    const entityName = getEntityName(columnRef);

    return isEmpty(entityName) ? option.text : entityName;
  } else {
    const dataModel = (
      option as SuggestOption<SearchIndex.CONTAINER, ContainerSearchSource>
    )._source.dataModel;
    const columnRef = dataModel
      ? dataModel.columns.find(
          (column) =>
            column.displayName === option.text || column.name === option.text
        )
      : undefined;

    const entityName = getEntityName(columnRef);

    return isEmpty(entityName) ? option.text : entityName;
  }
};

export const getSchemaFieldOptions = (
  option: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const schemaFields = (
    option as SuggestOption<SearchIndex.TOPIC, TopicSearchSource>
  )._source.messageSchema?.schemaFields;

  const schemaRef = schemaFields
    ? schemaFields.find(
        (field) =>
          field.displayName === option.text || field.name === option.text
      )
    : undefined;

  const entityName = getEntityName(schemaRef);

  return isEmpty(entityName) ? option.text : entityName;
};

export const getServiceOptions = (
  option: SuggestOption<SearchIndex, ExploreSearchSource>
) => {
  const service = (
    option as SuggestOption<
      SearchIndex,
      | TableSearchSource
      | DashboardSearchSource
      | PipelineSearchSource
      | MlmodelSearchSource
      | TopicSearchSource
    >
  )._source.service;

  return service
    ? service.displayName ?? service.name ?? option.text
    : option.text;
};

export const getOptionsFromAggregationBucket = (buckets: Bucket[]) => {
  if (!buckets) {
    return [];
  }

  return buckets
    .filter(
      (item) =>
        !NOT_INCLUDE_AGGREGATION_QUICK_FILTER.includes(item.key as EntityType)
    )
    .map((option) => ({
      key: option.key,
      label: option.key,
      count: option.doc_count ?? 0,
    }));
};

export const formatQueryValueBasedOnType = (
  value: string[],
  field: string,
  type: string
) => {
  if (field.includes('extension') && type === 'text') {
    return value.map((item) => toLower(item));
  }

  return value;
};

export const getCustomPropertyAdvanceSearchEnumOptions = (
  enumValues: string[]
) => {
  return enumValues.reduce((acc: Record<string, string>, value) => {
    acc[value] = value;

    return acc;
  }, {});
};

export const getEmptyJsonTree = (
  defaultField: string = EntityFields.OWNERS
): OldJsonTree => {
  return {
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
              field: defaultField,
              operator: null,
              value: [],
              valueSrc: ['value'],
            },
          },
        },
      },
    },
  };
};

export const getEmptyJsonTreeForQueryBuilder = (
  defaultField: string = EntityReferenceFields.OWNERS,
  subField = 'fullyQualifiedName'
): OldJsonTree => {
  const uuid1 = QbUtils.uuid();
  const uuid2 = QbUtils.uuid();
  const uuid3 = QbUtils.uuid();

  return {
    id: uuid1,
    type: 'group',
    properties: {
      conjunction: 'AND',
      not: false,
    },
    children1: {
      [uuid2]: {
        type: 'rule_group',
        id: uuid2,
        properties: {
          conjunction: 'AND',
          not: false,
          mode: 'some',
          field: defaultField,
          fieldSrc: 'field',
        },
        children1: {
          [uuid3]: {
            type: 'rule',
            id: uuid3,
            properties: {
              field: `${defaultField}.${subField}`,
              operator: 'select_equals',
              value: [],
              valueSrc: ['value'],
              fieldSrc: 'field',
            },
          },
        },
      },
    },
  };
};
