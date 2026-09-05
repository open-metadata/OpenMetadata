/*
 *  Copyright 2026 Collate.
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
import type { OldJsonTree } from '@react-awesome-query-builder/ui';
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
  QUICK_FILTER_LABEL_TRANSFORMS,
  QUICK_FILTER_SOURCE_FIELDS,
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
import { extractSourceValue } from './SearchPureUtils';
import { generateUUID } from './StringUtils';

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

export const getQuickFilterSourceFields = (
  field: ExploreQuickFilterField
): string | undefined =>
  field.sourceFields ?? QUICK_FILTER_SOURCE_FIELDS[field.key as EntityFields];

export const getQuickFilterLabelTransform = (
  field: ExploreQuickFilterField
): ((label: string) => string) | undefined =>
  field.labelTransform ?? QUICK_FILTER_LABEL_TRANSFORMS[field.key as EntityFields];

const findSourceLabel = (
  sources: unknown[],
  path: string,
  bucketKey: string
): string | undefined => {
  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue;
    }
    const value = extractSourceValue(
      source as Record<string, unknown>,
      path,
      bucketKey
    );
    if (value?.toLowerCase() === bucketKey.toLowerCase()) {
      return value;
    }
  }

  return undefined;
};

/**
 * Rewrites the labels of already-selected quick-filter values.
 *
 * Only the lowercased bucket key survives a round trip through the URL, so a
 * reloaded or shared listing would render its chips and checked options in
 * lowercase. `resolveLabel` supplies the original casing for one value; a field
 * keeps its identity when nothing resolves, so an unchanged filter set does not
 * re-render. Values that already carry a resolved label are left alone.
 */
export const applyQuickFilterLabels = (
  fields: ExploreQuickFilterField[],
  resolveLabel: (
    field: ExploreQuickFilterField,
    optionKey: string
  ) => string | undefined
): ExploreQuickFilterField[] =>
  fields.map((field) => {
    if (isEmpty(field.value)) {
      return field;
    }

    let hasResolvedLabel = false;
    const value = (field.value ?? []).map((option) => {
      // A label that already differs from the key came from the dropdown, where
      // the aggregation resolved it against `_source`.
      if (option.label !== option.key) {
        return option;
      }

      const label = resolveLabel(field, option.key);
      if (!label || label === option.key) {
        return option;
      }
      hasResolvedLabel = true;

      return { ...option, label };
    });

    return hasResolvedLabel ? { ...field, value } : field;
  });

/**
 * Recovers selected-value casing from the rows currently listed: every hit of a
 * filtered result set carries the value that matched in its `_source`, so no
 * extra request is needed for the common case. A value whose only matching row
 * sits on another page stays unresolved here — see `useQuickFilterLabels`.
 */
export const hydrateQuickFilterLabels = (
  fields: ExploreQuickFilterField[],
  sources: unknown[]
): ExploreQuickFilterField[] => {
  if (isEmpty(sources)) {
    return fields;
  }

  return applyQuickFilterLabels(fields, (field, optionKey) => {
    const sourceFields = getQuickFilterSourceFields(field);
    const transform = getQuickFilterLabelTransform(field);
    const label = sourceFields
      ? findSourceLabel(sources, sourceFields, optionKey)
      : undefined;

    return label && transform ? transform(label) : label;
  });
};

export const getOptionsFromAggregationBucket = (
  buckets: Bucket[],
  labelFormatter?: (key: string) => string,
  sourceFields?: string,
  labelTransform?: (label: string) => string
) => {
  if (!buckets) {
    return [];
  }

  return buckets
    .filter(
      (item) =>
        !NOT_INCLUDE_AGGREGATION_QUICK_FILTER.includes(item.key as EntityType)
    )
    .map((option) => {
      let label = labelFormatter ? labelFormatter(option.key) : option.key;

      if (sourceFields) {
        const topHitsData = (option as Record<string, unknown>)[
          'top_hits#top'
        ] as
          | {
              hits?: {
                hits?: Array<{ _source?: Record<string, unknown> }>;
              };
            }
          | undefined;
        const src = topHitsData?.hits?.hits?.[0]?._source;
        const extracted = src
          ? extractSourceValue(src, sourceFields, option.key)
          : undefined;
        if (extracted) {
          label = extracted;
        }
      }

      // Apply per-field label transform (e.g., strip classification prefix
      // so Tier options read "Tier1" instead of "Tier.Tier1").
      if (labelTransform) {
        label = labelTransform(label);
      }

      return { key: option.key, label, count: option.doc_count ?? 0 };
    });
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
    id: generateUUID(),
    type: 'group',
    properties: {
      conjunction: 'AND',
      not: false,
    },
    children1: {
      [generateUUID()]: {
        type: 'group',
        properties: {
          conjunction: 'AND',
          not: false,
        },
        children1: {
          [generateUUID()]: {
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
  const uuid1 = generateUUID();
  const uuid2 = generateUUID();
  const uuid3 = generateUUID();

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
