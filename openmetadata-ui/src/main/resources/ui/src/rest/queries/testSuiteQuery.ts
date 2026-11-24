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

import { TabSpecificField } from '../../enums/entity.enum';
import { PipelineType } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Include } from '../../generated/type/include';
import { getIngestionPipelines } from '../ingestionPipelineAPI';
import {
  getListTestCaseBySearch,
  getTestSuiteByName,
  ListTestCaseParamsBySearch,
} from '../testAPI';

const TEST_SUITE_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.DOMAINS,
  TabSpecificField.TESTS,
];

export const TEST_SUITE_TEST_CASE_FIELDS = [
  TabSpecificField.TEST_CASE_RESULT,
  TabSpecificField.TEST_DEFINITION,
  TabSpecificField.TESTSUITE,
  TabSpecificField.INCIDENT_ID,
  TabSpecificField.INCIDENT_STATUS,
];

export const testSuiteDetailsQueryKey = (testSuiteFQN: string) =>
  ['testSuite', 'details', testSuiteFQN] as const;

export const testSuiteDetailsQueryFn =
  (testSuiteFQN: string) =>
  ({ signal }: { signal: AbortSignal }) =>
    getTestSuiteByName(
      testSuiteFQN,
      {
        fields: TEST_SUITE_FIELDS,
        include: Include.All,
      },
      { signal }
    );

export const testSuiteTestCasesQueryKeyPrefix = (testSuiteId: string) =>
  ['testSuite', 'testCases', testSuiteId] as const;

export const testSuiteTestCasesQueryKey = (
  testSuiteId: string,
  params: ListTestCaseParamsBySearch
) => [...testSuiteTestCasesQueryKeyPrefix(testSuiteId), params] as const;

export const testSuiteTestCasesQueryFn =
  (params: ListTestCaseParamsBySearch) =>
  ({ signal }: { signal: AbortSignal }) =>
    getListTestCaseBySearch(params, { signal });

export const testSuiteIngestionPipelinesQueryKey = (testSuiteFQN: string) =>
  ['testSuite', 'ingestionPipelines', testSuiteFQN] as const;

export const testSuiteIngestionPipelinesQueryFn =
  (testSuiteFQN: string) => () =>
    getIngestionPipelines({
      arrQueryFields: [],
      testSuite: testSuiteFQN,
      pipelineType: [PipelineType.TestSuite],
      limit: 0,
    });
