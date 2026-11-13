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

const MIN_PART_LENGTH = 3;
const IDENTIFIER_COLUMN = /^(id|.*_id|.*id)$/;

/** Splits `dosageMg`, `dosage_mg` and `Dosage Mg` into `dosage mg`. */
const normalize = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toLocaleLowerCase();

const lastSegment = (columnId: string): string => {
  try {
    const path: unknown = JSON.parse(columnId);

    return Array.isArray(path) ? String(path[path.length - 1] ?? '') : columnId;
  } catch {
    return columnId;
  }
};

export interface ColumnSuggestionProperty {
  label: string;
  isIdentifier?: boolean;
}

export interface SuggestableProperty extends ColumnSuggestionProperty {
  id: string;
}

export interface SuggestableColumn {
  /** The column path, JSON encoded, as the binding editor identifies options. */
  id: string;
}

const MATCH_SAME_WORDS = 3;
const MATCH_ONE_HOLDS_OTHER = 2;
const MATCH_IDENTIFIER = 1;

/** How well a column name fits a property label, 0 when it does not. */
const scoreMatch = (
  property: ColumnSuggestionProperty,
  columnName: string
): number => {
  const wanted = normalize(property.label);
  const name = normalize(columnName);
  if (name === wanted) {
    return MATCH_SAME_WORDS;
  }
  if (
    wanted.length >= MIN_PART_LENGTH &&
    name.length >= MIN_PART_LENGTH &&
    (name.includes(wanted) || wanted.includes(name))
  ) {
    return MATCH_ONE_HOLDS_OTHER;
  }

  return property.isIdentifier &&
    IDENTIFIER_COLUMN.test(name.replace(/ /g, '_'))
    ? MATCH_IDENTIFIER
    : 0;
};

const pickBest = <T>(
  candidates: readonly T[],
  score: (candidate: T) => number
): T | undefined =>
  candidates.reduce<{ candidate?: T; score: number }>(
    (top, candidate) => {
      const next = score(candidate);

      return next > top.score ? { candidate, score: next } : top;
    },
    { score: 0 }
  ).candidate;

/**
 * The column most likely meant for a property: the same words first, then one name
 * holding the other, and an identifier property takes an `id` or `*_id` column.
 */
export const suggestColumnForProperty = <T extends SuggestableColumn>(
  property: ColumnSuggestionProperty,
  columns: readonly T[]
): T | undefined =>
  pickBest(columns, (column) => scoreMatch(property, lastSegment(column.id)));

/** The property a column most likely holds, by the same rules as `suggestColumnForProperty`. */
export const suggestPropertyForColumn = <T extends SuggestableProperty>(
  columnName: string,
  properties: readonly T[]
): T | undefined =>
  pickBest(properties, (property) => scoreMatch(property, columnName));
