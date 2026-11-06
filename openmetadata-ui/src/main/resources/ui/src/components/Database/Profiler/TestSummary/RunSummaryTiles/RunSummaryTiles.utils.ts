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
import { TestCaseStatus } from '../../../../../generated/tests/testCase';

export interface RunSummary {
  runs: number;
  passed: number;
  failed: number;
  aborted: number;
  /** Percent of completed runs that passed, or undefined when none completed. */
  successRate?: number;
}

/**
 * Totals for the window the chart shows. A queued run has not produced an
 * outcome, so it counts towards Runs but not towards the success rate - which
 * is why Passed, Failed and Aborted need not add up to Runs.
 */
export const getRunSummary = (
  results: { testCaseStatus?: TestCaseStatus }[]
): RunSummary => {
  const count = (status: TestCaseStatus) =>
    results.filter((result) => result.testCaseStatus === status).length;

  const passed = count(TestCaseStatus.Success);
  const completed = results.length - count(TestCaseStatus.Queued);

  return {
    runs: results.length,
    passed,
    failed: count(TestCaseStatus.Failed),
    aborted: count(TestCaseStatus.Aborted),
    successRate:
      completed > 0 ? Math.round((passed / completed) * 1000) / 10 : undefined,
  };
};
