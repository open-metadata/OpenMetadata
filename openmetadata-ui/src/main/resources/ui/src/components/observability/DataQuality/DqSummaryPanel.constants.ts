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
import type { ChartStatus } from '@openmetadata/ui-core-components/charts';
import { TestSummarySegmentId } from '../../DataQuality/SummaryPannel/SummaryPanel.interface';

// Chart colours come from the core chart palette; segments only name a status.
export const SEGMENT_STATUS: Record<TestSummarySegmentId, ChartStatus> = {
  [TestSummarySegmentId.Success]: 'success',
  [TestSummarySegmentId.Aborted]: 'warning',
  [TestSummarySegmentId.Failed]: 'failed',
  [TestSummarySegmentId.Healthy]: 'success',
  [TestSummarySegmentId.Unhealthy]: 'neutral',
  [TestSummarySegmentId.Covered]: 'info',
  [TestSummarySegmentId.Uncovered]: 'neutral',
};
