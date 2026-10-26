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

import { omit } from 'lodash';
import {
  AssetTypeConfiguration,
  BoostMode,
  FieldBoost,
  FieldValueBoost,
  Modifier,
  RankingConfiguration,
  ScoreMode,
  SearchSettings,
  TermBoost,
} from '../../../../../../../generated/configuration/searchSettings';

export const DEFAULT_SEMANTIC_WEIGHT = 0.4;

/** Keyword and semantic weights always sum to 1, rounded to one decimal. */
export const complementWeight = (weight: number) =>
  Math.round((1 - weight) * 10) / 10;

/** Adds the boost, or replaces the one for the same tag. */
export const upsertTermBoost = (
  boosts: TermBoost[] | undefined,
  boost: TermBoost
): TermBoost[] => {
  const list = boosts ?? [];
  const index = list.findIndex((item) => item.value === boost.value);

  return index >= 0
    ? list.map((item, i) => (i === index ? boost : item))
    : [...list, boost];
};

/** Adds the boost, or replaces the one for the same field. */
export const upsertFieldValueBoost = (
  boosts: FieldValueBoost[] | undefined,
  boost: FieldValueBoost
): FieldValueBoost[] => {
  const list = boosts ?? [];
  const index = list.findIndex((item) => item.field === boost.field);

  return index >= 0
    ? list.map((item, i) => (i === index ? boost : item))
    : [...list, boost];
};

/** The per-entity settings the entity page edits as one draft. */
export interface EntitySearchDraft {
  searchFields: FieldBoost[];
  highlightFields: string[];
  termBoosts: TermBoost[];
  fieldValueBoosts: FieldValueBoost[];
  scoreMode?: ScoreMode;
  boostMode?: BoostMode;
  ranking?: RankingConfiguration;
}

export const toEntityDraft = (
  config?: AssetTypeConfiguration,
  ranking?: RankingConfiguration
): EntitySearchDraft => ({
  searchFields: config?.searchFields ?? [],
  highlightFields: config?.highlightFields ?? [],
  termBoosts: config?.termBoosts ?? [],
  fieldValueBoosts: config?.fieldValueBoosts ?? [],
  scoreMode: config?.scoreMode,
  boostMode: config?.boostMode,
  ranking,
});

/** The full settings with one entity's configuration replaced by the draft. */
export const withEntityDraft = (
  config: SearchSettings,
  assetType: string,
  draft: EntitySearchDraft
): SearchSettings => ({
  ...config,
  assetTypeConfigurations: config.assetTypeConfigurations?.map((item) =>
    item.assetType === assetType ? { ...item, ...draft } : item
  ),
});

/** Adding a matching field puts it first with no boost; adding it again removes it. */
export const toggleSearchField = (
  fields: FieldBoost[],
  fieldName: string
): FieldBoost[] =>
  fields.some((field) => field.field === fieldName)
    ? fields.filter((field) => field.field !== fieldName)
    : [{ field: fieldName, boost: 0 }, ...fields];

export const updateSearchField = (
  fields: FieldBoost[],
  fieldName: string,
  update: Partial<FieldBoost>
): FieldBoost[] =>
  fields.map((field) =>
    field.field === fieldName ? { ...field, ...update } : field
  );

export const toggleHighlightField = (fields: string[], fieldName: string) =>
  fields.includes(fieldName)
    ? fields.filter((field) => field !== fieldName)
    : [...fields, fieldName];

/** An emptied numeric input clears the value instead of storing 0. */
export const setStageWeight = (
  ranking: RankingConfiguration,
  stageIndex: number,
  weight: number | null
): RankingConfiguration => ({
  ...ranking,
  stages: (ranking.stages ?? []).map((stage, index) => {
    if (index !== stageIndex) {
      return stage;
    }

    return weight === null ? omit(stage, 'weight') : { ...stage, weight };
  }),
});

export const setSignalMaxBoost = (
  ranking: RankingConfiguration,
  maxBoost: number | null
): RankingConfiguration => ({
  ...ranking,
  signals:
    maxBoost === null
      ? omit(ranking.signals ?? {}, 'maxBoost')
      : { ...ranking.signals, maxBoost },
});

/** Parses a numeric input: '' (cleared) becomes null. */
export const parseOptionalNumber = (value: string): number | null =>
  value.trim() === '' || Number.isNaN(Number(value)) ? null : Number(value);

interface SelectItem {
  id: string;
  label: string;
}

export interface FieldValueBoostFormValues {
  field: SelectItem | null;
  factor: number;
  modifier: SelectItem | null;
  missing: string;
  gte: string;
  lte: string;
  gt: string;
  lt: string;
}

export const RANGE_KEYS = ['gte', 'lte', 'gt', 'lt'] as const;

export const MODIFIER_ITEMS: SelectItem[] = Object.values(Modifier).map(
  (value) => ({ id: value, label: value })
);

const toItem = (value?: string) => (value ? { id: value, label: value } : null);

export const toFieldValueBoostFormValues = (
  boost?: FieldValueBoost
): FieldValueBoostFormValues => ({
  field: toItem(boost?.field),
  factor: boost?.factor ?? 0,
  modifier: toItem(boost?.modifier ?? Modifier.None),
  missing: boost?.missing?.toString() ?? '0',
  gte: boost?.condition?.range?.gte?.toString() ?? '',
  lte: boost?.condition?.range?.lte?.toString() ?? '',
  gt: boost?.condition?.range?.gt?.toString() ?? '',
  lt: boost?.condition?.range?.lt?.toString() ?? '',
});

/** Empty range bounds are left out rather than sent as 0, as the classic modal did. */
export const toFieldValueBoost = (
  values: FieldValueBoostFormValues
): FieldValueBoost => ({
  field: values.field?.id ?? '',
  factor: values.factor,
  modifier: (values.modifier?.id as Modifier) ?? Modifier.None,
  missing: values.missing ? Number(values.missing) : 0,
  condition: {
    range: Object.fromEntries(
      RANGE_KEYS.filter((key) => values[key] !== '').map((key) => [
        key,
        Number(values[key]),
      ])
    ),
  },
});

export const FIELD_VALUE_BOOST_SEGMENT = 'field-value-boost';

/**
 * The `search/edit/<itemId>` id of the field value boost form:
 * `[<entity>/]field-value-boost[/<field>]`; no entity means the global boosts.
 */
export const toFieldValueBoostItemId = (entity?: string, field?: string) =>
  [entity, FIELD_VALUE_BOOST_SEGMENT, field].filter(Boolean).join('/');

export const parseFieldValueBoostItemId = (
  itemId = ''
): { entity?: string; field?: string } => {
  const segments = itemId.split('/');
  const index = segments.indexOf(FIELD_VALUE_BOOST_SEGMENT);

  return {
    entity: index > 0 ? segments.slice(0, index).join('/') : undefined,
    field: segments.slice(index + 1).join('/') || undefined,
  };
};

/**
 * A search page's unsaved edits, kept by the panel while the field value boost
 * form is open: an entity page's draft, or the global page's term boosts.
 */
export type SearchSavedState = (
  | {
      /** The entity page's `itemId`, so a draft never leaks onto another entity. */
      entity: string;
      draft: EntitySearchDraft;
      isChanged: boolean;
    }
  | { entity?: undefined; termBoosts: TermBoost[] }
) & {
  /** Set by the form's Cancel/Save; a draft left any other way is abandoned. */
  isReturning?: boolean;
};

/** The saved state to resume on `entity`'s page (undefined: the global page). */
export const getReturningSearchState = (
  savedState: unknown,
  entity?: string
): SearchSavedState | undefined => {
  const state = savedState as SearchSavedState | undefined;

  return state?.isReturning && state.entity === entity ? state : undefined;
};
