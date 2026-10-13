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
import path from 'path';

const UI_ROOT = path.resolve(__dirname, '..', '..');

const parseSpecList = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

/**
 * PR and merge-queue CI set PW_ENTITY_MATRIX=representative so specs that
 * repeat the same scenarios for every entity type run them for one
 * representative entity only; the nightly run keeps the full matrix. A spec
 * changed directly in the PR (PW_DIRECT_CHANGED_SPECS) keeps its full matrix
 * so the edit is still validated against every entity before it merges.
 * Local runs always get the full matrix.
 */
export const isRepresentativeEntityRun = (specFile: string): boolean => {
  if (
    process.env.CI !== 'true' ||
    process.env.PW_ENTITY_MATRIX !== 'representative'
  ) {
    return false;
  }
  const spec = path.relative(UI_ROOT, specFile).split(path.sep).join('/');

  return !parseSpecList(process.env.PW_DIRECT_CHANGED_SPECS).includes(spec);
};

/**
 * Returns `representative` in a representative CI run and `all` otherwise.
 * Pass `__filename` as `specFile`. Keep test titles independent of which set
 * is chosen: the shard planner keys timing history on stable test IDs.
 */
export function pickEntityMatrix<A extends readonly unknown[]>(
  specFile: string,
  all: A,
  representative: ReadonlyArray<A[number]>
): ReadonlyArray<A[number]>;
export function pickEntityMatrix<R extends Record<string, unknown>>(
  specFile: string,
  all: R,
  representative: Partial<R>
): Readonly<Record<string, R[keyof R]>>;
export function pickEntityMatrix(
  specFile: string,
  all: unknown,
  representative: unknown
): unknown {
  return isRepresentativeEntityRun(specFile) ? representative : all;
}
