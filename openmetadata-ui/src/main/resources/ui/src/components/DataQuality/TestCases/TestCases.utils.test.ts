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
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { getSelectedTestCaseStatuses } from './TestCases.utils';

describe('getSelectedTestCaseStatuses', () => {
  it('should return an empty array when no status is selected', () => {
    expect(getSelectedTestCaseStatuses()).toEqual([]);
  });

  it('should normalize a single status to an array', () => {
    expect(getSelectedTestCaseStatuses(TestCaseStatus.Success)).toEqual([
      TestCaseStatus.Success,
    ]);
  });

  it('should preserve multiple selected statuses', () => {
    const statuses = [TestCaseStatus.Failed, TestCaseStatus.Aborted];

    expect(getSelectedTestCaseStatuses(statuses)).toEqual(statuses);
  });
});
