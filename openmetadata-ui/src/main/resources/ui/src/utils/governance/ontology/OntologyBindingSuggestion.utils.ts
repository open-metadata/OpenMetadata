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
// Only an identifier named like a key takes an `*_id` column; an `email` identifier does not.
const KEY_LIKE_LABEL = /\b(id|key|code|number|no|uuid|identifier)\b/;

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
    KEY_LIKE_LABEL.test(wanted) &&
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
 * holding the other, and a key-like identifier property takes an `id` or `*_id` column.
 */
export const suggestColumnForProperty = <T extends SuggestableColumn>(
  property: ColumnSuggestionProperty,
  columns: readonly T[]
): T | undefined =>
  pickBest(columns, (column) => scoreMatch(property, lastSegment(column.id)));

/**
 * The property each column of one table most likely holds, keyed by column id. Each property goes
 * to at most one column, the best-matching one.
 */
export const suggestPropertiesForColumns = <
  C extends SuggestableColumn,
  P extends SuggestableProperty
>(
  columns: readonly C[],
  properties: readonly P[]
): Map<string, P> => {
  const candidates = columns
    .flatMap((column) =>
      properties.map((property) => ({
        column,
        property,
        score: scoreMatch(property, lastSegment(column.id)),
      }))
    )
    .filter(({ score }) => score > 0)
    // Stable sort: equal scores keep column order, so the first matching column wins a tie.
    .sort((a, b) => b.score - a.score);
  const suggestions = new Map<string, P>();
  const usedProperties = new Set<string>();
  for (const { column, property } of candidates) {
    if (!suggestions.has(column.id) && !usedProperties.has(property.id)) {
      suggestions.set(column.id, property);
      usedProperties.add(property.id);
    }
  }

  return suggestions;
};
