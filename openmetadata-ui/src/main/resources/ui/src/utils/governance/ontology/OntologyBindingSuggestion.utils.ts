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

export interface SuggestableColumn {
  /** The column path, JSON encoded, as the binding editor identifies options. */
  id: string;
}

/**
 * The column most likely meant for a property: the same words first, then one name
 * holding the other, and an identifier property takes an `id` or `*_id` column.
 */
export const suggestColumnForProperty = <T extends SuggestableColumn>(
  property: ColumnSuggestionProperty,
  columns: readonly T[]
): T | undefined => {
  const wanted = normalize(property.label);
  const scored = columns.map((column) => {
    const name = normalize(lastSegment(column.id));
    let score = 0;
    if (name === wanted) {
      score = 3;
    } else if (
      wanted.length >= MIN_PART_LENGTH &&
      name.length >= MIN_PART_LENGTH &&
      (name.includes(wanted) || wanted.includes(name))
    ) {
      score = 2;
    } else if (
      property.isIdentifier &&
      IDENTIFIER_COLUMN.test(name.replace(/ /g, '_'))
    ) {
      score = 1;
    }

    return { column, score };
  });
  const best = scored.reduce(
    (top, item) => (item.score > top.score ? item : top),
    { column: undefined as T | undefined, score: 0 }
  );

  return best.column;
};
