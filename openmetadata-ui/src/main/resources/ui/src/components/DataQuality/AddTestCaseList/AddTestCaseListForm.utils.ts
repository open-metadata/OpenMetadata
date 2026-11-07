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
import { EntityReference, TestCase } from '../../../generated/tests/testCase';
import { AddTestCaseListChangePayload } from './AddTestCaseList.interface';

/**
 * Resolves test case names from the `testCases` form field. Call this when reading
 * values on submit (or elsewhere): `AddTestCaseList` stores either `string[]` or an
 * {@link AddTestCaseListChangePayload} object depending on how Ant Design forwards
 * `onChange` from `valuePropName="selectedTest"`.
 */
export function normalizeSelectedTestProp(selectedTest: unknown): string[] {
  if (selectedTest == null) {
    return [];
  }
  if (Array.isArray(selectedTest)) {
    return selectedTest
      .map((item) =>
        typeof item === 'string' ? item : (item as TestCase).name
      )
      .filter(Boolean);
  }
  if (
    typeof selectedTest === 'object' &&
    selectedTest !== null &&
    'testCases' in selectedTest
  ) {
    const p = selectedTest as AddTestCaseListChangePayload;

    return (p.testCases ?? []).map((tc) => tc.name).filter(Boolean);
  }

  return [];
}

/**
 * Returns `true` when the `testCases` form field value represents a valid
 * selection — either an explicit list of test case names/references, or a
 * picker {@link AddTestCaseListChangePayload} that selects all test cases
 * (`selectAll: true`) or includes specific ids. Mirrors the validation logic
 * in `BundleSuiteFormBody.tsx` so the pipeline form and the bundle suite form
 * treat the same picker payload consistently.
 *
 * The picker intentionally emits `selectAll: true` with an *empty* `testCases`
 * array for "Select all N test cases" (the backend resolves the full set via
 * `selectAll`/`excludeIds`/`filter`), so validating purely on
 * `normalizeSelectedTestProp(value).length` rejects a full selection.
 */
export function isValidTestCaseSelection(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object' && value !== null && 'selectAll' in value) {
    const p = value as AddTestCaseListChangePayload;

    return Boolean(p.selectAll) || (p.includeIds?.length ?? 0) > 0;
  }

  return false;
}

/**
 * Returns `true` when the `testCases` form field value is a picker
 * {@link AddTestCaseListChangePayload} with `selectAll: true` — the picker's
 * "Select all N test cases" state, which the backend resolves via
 * `selectAll`/`excludeIds`/`filter` rather than by enumerating every test
 * case. Submit-side conversions use this to treat a picker select-all the
 * same as the top-level "select all test cases" switch (run all).
 */
export function isSelectAllPayload(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'selectAll' in value &&
    Boolean((value as AddTestCaseListChangePayload).selectAll)
  );
}

/**
 * Seeds the modal's `selectedItems` map from `existingTest` (tests already in
 * the parent suite), keyed by id. Entries start as partial TestCases and are
 * upgraded with the full payload when the matching record loads.
 */
export function seedSelectedFromExistingTest(
  existingTest?: EntityReference[]
): Map<string, TestCase> {
  const seed = new Map<string, TestCase>();
  (existingTest ?? []).forEach((ref) => {
    if (ref.id) {
      seed.set(ref.id, { id: ref.id, name: ref.name ?? '' } as TestCase);
    }
  });

  return seed;
}
