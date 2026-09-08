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
import {
  DQ_CHART_BLUE_COLOR,
  DQ_CHART_FAILED_COLOR,
  DQ_CHART_SUCCESS_COLOR,
  DQ_CHART_WARNING_COLOR,
  GREY_200,
} from '../../../constants/Color.constants';
import { TestSummarySegmentId } from '../../DataQuality/SummaryPannel/SummaryPanel.interface';

// 2.0 redesign chart palette (shared DQ chart constants).
export const SEGMENT_COLORS: Record<TestSummarySegmentId, string> = {
  [TestSummarySegmentId.Success]: DQ_CHART_SUCCESS_COLOR,
  [TestSummarySegmentId.Aborted]: DQ_CHART_WARNING_COLOR,
  [TestSummarySegmentId.Failed]: DQ_CHART_FAILED_COLOR,
  [TestSummarySegmentId.Healthy]: DQ_CHART_SUCCESS_COLOR,
  [TestSummarySegmentId.Unhealthy]: GREY_200,
  [TestSummarySegmentId.Covered]: DQ_CHART_BLUE_COLOR,
  [TestSummarySegmentId.Uncovered]: GREY_200,
};
