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

import { QueryClient } from '@tanstack/react-query';
import { TabSpecificField } from '../../enums/entity.enum';
import { TestCase } from '../../generated/tests/testCase';
import { getTestCaseByFqn } from '../testAPI';

// Inlined to avoid a circular import via {@code TestCaseClassBase} —
// the class imports tab components that themselves pull from utils that
// reach back into pages. Keep this list in sync with
// {@code TestCaseClassBase.getFields()}.
export const TEST_CASE_DEFAULT_FIELDS: string[] = [
  TabSpecificField.TESTSUITE,
  TabSpecificField.TEST_CASE_RESULT,
  TabSpecificField.TEST_DEFINITION,
  TabSpecificField.OWNERS,
  TabSpecificField.INCIDENT_ID,
  TabSpecificField.TAGS,
  'inspectionQuery',
];

/**
 * Shared query plumbing for a single TestCase (incident) by FQN. The detail
 * page hosts this query; child components (TestCaseResultTab, IncidentTab,
 * page header) continue to read the same data via the {@code useTestCaseStore}
 * Zustand store, which the page mirrors from the React Query cache.
 */
export const testCaseQueryKey = (fqn: string, fields: string[]) =>
  ['testCase', fqn, fields.join(',')] as const;

export const testCaseQueryFn = (fqn: string, fields: string[]) => () =>
  getTestCaseByFqn(fqn, { fields });

export const prefetchTestCaseByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string[]
) =>
  queryClient
    .prefetchQuery({
      queryKey: testCaseQueryKey(fqn, fields),
      queryFn: testCaseQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type TestCaseQueryData = TestCase | undefined;

export const prefetchTestCase = (queryClient: QueryClient, fqn: string) =>
  prefetchTestCaseByFqn(queryClient, fqn, TEST_CASE_DEFAULT_FIELDS);
