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
import { isArray, isEmpty } from 'lodash';
import type { Bucket } from 'Models';
import {
  COMMON_DROPDOWN_ITEMS,
  DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS,
  GLOSSARY_ASSETS_DROPDOWN_ITEMS,
  LINEAGE_DROPDOWN_ITEMS,
  QUICK_FILTER_SOURCE_FIELDS,
  TAG_ASSETS_DROPDOWN_ITEMS,
  TEAM_ASSETS_DROPDOWN_ITEMS,
} from '../constants/AdvancedSearch.constants';
import { NOT_INCLUDE_AGGREGATION_QUICK_FILTER } from '../constants/explore.constants';
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { AssetsOfEntity } from '../enums/Assets.enum';
import { EntityType } from '../enums/entity.enum';
import type {
  ExploreQuickFilterField,
  SearchDropdownOption,
} from '../interface/quickFilter.interface';
import { getNameFromFQN } from './FqnUtils';
import { extractSourceValue } from './SearchPureUtils';

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

    case AssetsOfEntity.TEAM:
      return [...TEAM_ASSETS_DROPDOWN_ITEMS];

    default:
      return [...COMMON_DROPDOWN_ITEMS];
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

export const getQuickFilterSourceFields = (
  field: ExploreQuickFilterField
): string | undefined =>
  field.sourceFields ?? QUICK_FILTER_SOURCE_FIELDS[field.key as EntityFields];

// The filter value stays the raw tier FQN (tier.tier1); only the visible label becomes the tier name.
const formatTierLabel = (value: string): string => {
  const tierName = getNameFromFQN(value);
  const defaultTier = tierName.match(/^tier(\d+)$/i);

  return defaultTier ? `Tier${defaultTier[1]}` : tierName;
};

// Per-field label formatter shared by every place a quick-filter value becomes visible text — dropdown options,
// selected chips, and labels restored after a URL round trip — so the same value cannot render differently per surface.
export const getQuickFilterLabelFormatter = (
  key: string
): ((value: string) => string) | undefined =>
  key === EntityFields.TIER ? formatTierLabel : undefined;

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

// Rewrites the labels of already-selected quick-filter values.
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
      // A label that already differs from the key came from the dropdown, where the aggregation resolved it against
      // `_source`.
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

// Recovers selected-value casing from the rows currently listed: every hit of a filtered result set carries the value
// that matched in its `_source`, so no extra request is needed for the common case.
export const hydrateQuickFilterLabels = (
  fields: ExploreQuickFilterField[],
  sources: unknown[]
): ExploreQuickFilterField[] => {
  if (isEmpty(sources)) {
    return fields;
  }

  return applyQuickFilterLabels(fields, (field, optionKey) => {
    const sourceFields = getQuickFilterSourceFields(field);
    const label = sourceFields
      ? findSourceLabel(sources, sourceFields, optionKey)
      : undefined;
    const formatter = getQuickFilterLabelFormatter(field.key);

    return label && formatter ? formatter(label) : label;
  });
};

export const getOptionsFromAggregationBucket = (
  buckets: Bucket[],
  labelFormatter?: (key: string) => string,
  sourceFields?: string
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
      let label = option.key;

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

      // Runs after the sourceFields resolution so formatters (entity type, tier) see the original-cased value, not the
      // lowercased bucket key.
      if (labelFormatter) {
        label = labelFormatter(label);
      }

      return { key: option.key, label, count: option.doc_count ?? 0 };
    });
};
