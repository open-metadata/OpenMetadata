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

import { ListTestCaseParamsBySearch } from '../../rest/testAPI';
import { NON_FILTERING_TEST_CASE_PARAMS } from './TestSuiteDetailsPage.constants';

export const isUnfilteredTestCaseRequest = (
  param?: ListTestCaseParamsBySearch
) =>
  Object.entries(param ?? {}).every(
    ([key, value]) =>
      value === undefined ||
      NON_FILTERING_TEST_CASE_PARAMS.has(
        key as keyof ListTestCaseParamsBySearch
      )
  );

export const isTestCaseListSynchronized = (
  indexedTotal: number | undefined,
  authoritativeTotal: number | undefined
) =>
  indexedTotal === undefined ||
  authoritativeTotal === undefined ||
  indexedTotal >= authoritativeTotal;

export const shouldResetTestCaseLoading = (
  isCurrentRequest: () => boolean,
  keepLoading: boolean
) => isCurrentRequest() && !keepLoading;
