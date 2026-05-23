/*
 *  Copyright 2024 Collate.
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

import { TestCaseStatus } from '../../../generated/entity/feed/testCaseResult';

/** Segment order for TestCaseStatusPieChartWidget: Success, Failed, Aborted */
export const TEST_CASE_STATUS_PIE_SEGMENT_ORDER: TestCaseStatus[] = [
  TestCaseStatus.Success,
  TestCaseStatus.Failed,
  TestCaseStatus.Aborted,
];

/**
 * Shared segment order for binary-status pie charts (Success, Failed).
 * Used by EntityHealthStatusPieChartWidget (Healthy → Success, Unhealthy → Failed)
 * and DataAssetsCoveragePieChartWidget (Covered → Success, Not covered → Failed).
 */
export const BINARY_STATUS_PIE_SEGMENT_ORDER: TestCaseStatus[] = [
  TestCaseStatus.Success,
  TestCaseStatus.Failed,
];
