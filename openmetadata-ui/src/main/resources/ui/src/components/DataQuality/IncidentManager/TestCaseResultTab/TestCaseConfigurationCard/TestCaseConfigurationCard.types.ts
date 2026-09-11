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
import { ReactNode } from 'react';
import {
  TestCase,
  TestCaseParameterValue,
} from '../../../../../generated/tests/testCase';
import { TestDefinition } from '../../../../../generated/tests/testDefinition';

export interface ConfigurationParameterRow {
  /** Displayed on the left of the row; already human-readable. */
  label: string;
  /** Displayed on the right. A node covers the version page's diff markup. */
  value: string | ReactNode;
}

export interface TestCaseConfigurationCardProps {
  testCaseData: TestCase | undefined;
  /**
   * Supplies the card's heading line. Loaded asynchronously by
   * `useTestCaseResultTab`, so the card must render without it.
   */
  testDefinition: TestDefinition | undefined;
  /** Non-`sqlExpression` parameters, in declaration order. */
  parameterRows: ConfigurationParameterRow[];
  /** `sqlExpression` parameters — the assertion SQL, not `inspectionQuery`. */
  withSqlParams: TestCaseParameterValue[];
  isVersionPage: boolean;
  /**
   * Pre-rendered parameter diff for the version page. Replaces `parameterRows`
   * when set, because a diff carries its own added/removed markup.
   */
  versionParameterDiff?: ReactNode;
  /**
   * Whether to render the header's edit affordance. The caller owns this
   * decision so the existing permission + "has anything to edit" rule stays in
   * one place (`shouldShowEditParameterButton`).
   */
  showEditButton: boolean;
  onEditParameter: () => void;
}
