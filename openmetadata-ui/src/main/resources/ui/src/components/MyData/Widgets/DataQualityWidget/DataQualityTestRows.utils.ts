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

import { TestCase, TestCaseStatus } from '../../../../generated/tests/testCase';
import { getEntityFQN } from '../../../../utils/FeedUtilsPure';

/** How the card's test list is arranged. */
export enum DataQualityGroupBy {
  TABLE = 'table',
  TEST_CASE = 'testCase',
}

export interface DataQualityTableGroup {
  tableFqn: string;
  tests: TestCase[];
  passed: number;
  failed: number;
  aborted: number;
}

/**
 * The column a test runs on, or none for a table-level test. Read off the
 * entity link (`<#E::table::{fqn}::columns::{column}>`) directly rather than
 * through the ANTLR parser, which this card has no other reason to load.
 */
export const getTestColumnName = (entityLink?: string): string | undefined => {
  const parts = (entityLink ?? '').replace(/^<#E::|>$/g, '').split('::');

  return parts[2] === 'columns' ? parts[3] : undefined;
};

const statusOf = (test: TestCase) => test.testCaseResult?.testCaseStatus;

/**
 * The tests under the table each runs on, tables in the order their first
 * test appears — the rows arrive failures first, so the table needing the most
 * attention leads.
 */
export const groupTestsByTable = (
  tests: TestCase[]
): DataQualityTableGroup[] => {
  const groups = new Map<string, DataQualityTableGroup>();

  for (const test of tests) {
    const tableFqn = getEntityFQN(test.entityLink ?? '');
    const group: DataQualityTableGroup = groups.get(tableFqn) ?? {
      tableFqn,
      tests: [],
      passed: 0,
      failed: 0,
      aborted: 0,
    };
    group.tests.push(test);
    const status = statusOf(test);
    if (status === TestCaseStatus.Success) {
      group.passed += 1;
    } else if (status === TestCaseStatus.Failed) {
      group.failed += 1;
    } else if (status === TestCaseStatus.Aborted) {
      group.aborted += 1;
    }
    groups.set(tableFqn, group);
  }

  return Array.from(groups.values());
};
