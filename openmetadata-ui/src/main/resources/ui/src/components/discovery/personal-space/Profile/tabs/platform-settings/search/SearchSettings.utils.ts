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
