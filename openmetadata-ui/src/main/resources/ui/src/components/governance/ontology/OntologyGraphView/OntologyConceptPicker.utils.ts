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
export interface PickerConcept {
  readonly id: string;
  readonly name: string;
  /** The first superclass, shown beside the name to tell same-named concepts apart. */
  readonly parentName?: string;
}

/** Exact name first, then names that start with the search, then any other match. */
const matchRank = ({ name, parentName }: PickerConcept, needle: string) => {
  const label = name.toLocaleLowerCase();
  if (label === needle) {
    return 0;
  }
  if (label.startsWith(needle)) {
    return 1;
  }
  if (label.includes(needle)) {
    return 2;
  }

  return parentName?.toLocaleLowerCase().includes(needle) ? 3 : undefined;
};

export const matchConcepts = (
  concepts: readonly PickerConcept[],
  query: string
) => {
  const needle = query.trim().toLocaleLowerCase();

  return concepts
    .map((concept) => ({
      concept,
      rank: needle ? matchRank(concept, needle) : 0,
    }))
    .filter(
      (entry): entry is { concept: PickerConcept; rank: number } =>
        entry.rank !== undefined
    )
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.concept.name.localeCompare(right.concept.name)
    )
    .map(({ concept }) => concept);
};
