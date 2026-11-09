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

export interface DataPickerConcept {
  id: string;
  name: string;
  /** Unknown until the concept's cluster has loaded. */
  assetCount?: number;
}

export interface DataPickerGroups {
  recent: DataPickerConcept[];
  withData: DataPickerConcept[];
  withoutData: DataPickerConcept[];
}

export interface RememberedDataPick {
  selectedId?: string;
  recentIds: string[];
}

const STORAGE_KEY = 'os-dataBy';
const MAX_RECENT = 3;
// One entry per ontology the person opened Data mode on.
const MAX_ONTOLOGIES = 50;

const byName = (left: DataPickerConcept, right: DataPickerConcept) =>
  left.name.localeCompare(right.name);

export const buildDataPickerGroups = (
  concepts: DataPickerConcept[],
  recentIds: string[],
  query: string
): DataPickerGroups => {
  const needle = query.trim().toLocaleLowerCase();
  const matches = needle
    ? concepts.filter((item) => item.name.toLocaleLowerCase().includes(needle))
    : concepts;
  const recent = needle
    ? []
    : recentIds.flatMap((id) => matches.find((item) => item.id === id) ?? []);
  const recentSet = new Set(recent.map((item) => item.id));
  const rest = matches.filter((item) => !recentSet.has(item.id));

  return {
    recent,
    withData: rest
      .filter((item) => (item.assetCount ?? 0) > 0)
      .sort(
        (left, right) =>
          (right.assetCount ?? 0) - (left.assetCount ?? 0) ||
          byName(left, right)
      ),
    withoutData: rest
      .filter((item) => (item.assetCount ?? 0) <= 0)
      .sort(byName),
  };
};

const readAll = (): Record<string, RememberedDataPick> => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '{}'
    );

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, RememberedDataPick>)
      : {};
  } catch {
    return {};
  }
};

export const readDataPick = (ontologyId: string): RememberedDataPick => {
  const stored = readAll()[ontologyId];

  return {
    ...(typeof stored?.selectedId === 'string'
      ? { selectedId: stored.selectedId }
      : {}),
    recentIds: Array.isArray(stored?.recentIds)
      ? stored.recentIds.filter((id) => typeof id === 'string')
      : [],
  };
};

export const rememberDataPick = (
  ontologyId: string,
  conceptId: string | undefined
) => {
  const all = readAll();
  const { recentIds } = readDataPick(ontologyId);
  const next: RememberedDataPick = {
    recentIds: conceptId
      ? [conceptId, ...recentIds.filter((id) => id !== conceptId)].slice(
          0,
          MAX_RECENT
        )
      : recentIds,
    ...(conceptId ? { selectedId: conceptId } : {}),
  };
  delete all[ontologyId];
  const kept = Object.entries({ ...all, [ontologyId]: next }).slice(
    -MAX_ONTOLOGIES
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // The pick is a convenience; without storage it lasts for the session.
  }
};
