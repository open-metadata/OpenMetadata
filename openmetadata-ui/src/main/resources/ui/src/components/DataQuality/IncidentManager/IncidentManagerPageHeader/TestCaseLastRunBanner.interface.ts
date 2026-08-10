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

import type { Task } from '../../../../generated/entity/tasks/task';
import type {
  TestCaseParameterValue,
  TestCaseResolutionStatus,
  TestCaseResult,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import type {
  IncidentStatusConfig,
  StatusConfig,
} from './TestCaseLastRunBanner.constants';
import type { TaskLinkInfo } from './useTestCaseIncidentHeader';

export interface TestCaseLastRunBannerProps {
  incidentTask: Task | null;
  nextRunTimestamp?: number;
  parameterValues?: TestCaseParameterValue[];
  testCaseResult?: TestCaseResult;
  testCaseStatus?: TestCaseStatus;
  testCaseStatusData?: TestCaseResolutionStatus;
  taskLinkInfo: TaskLinkInfo | null;
}

export interface IncidentDetailsProps {
  config: StatusConfig;
  description?: string;
  incidentId?: string;
  incidentLink: TaskLinkInfo | null;
  statusConfig?: IncidentStatusConfig;
}

export interface LastRunTimeProps {
  nextRunTimestamp?: number;
  testCaseStatus: TestCaseStatus;
  timestamp?: number;
}

export type NoRunBannerProps = Pick<
  TestCaseLastRunBannerProps,
  'nextRunTimestamp'
>;

export interface ResultExpectedProps {
  config: StatusConfig;
  expectedValue?: string;
  resultValue?: string;
  show: boolean;
}

export interface RunDescriptionProps {
  description?: string;
}
