/*
 *  Copyright 2022 Collate.
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

import { TableTestsType } from 'components/TableProfiler/TableProfiler.interface';
import { TestCaseStatus } from '../generated/tests/testCase';

export const updateTestResults = (
  results: TableTestsType['results'],
  testCaseStatus: string
) => {
  switch (testCaseStatus) {
    case TestCaseStatus.Success:
      results.success += 1;

      break;
    case TestCaseStatus.Failed:
      results.failed += 1;

      break;
    case TestCaseStatus.Aborted:
      results.aborted += 1;

      break;
  }
};
