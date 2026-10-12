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
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../generated/tests/testCaseResolutionStatus';
import {
  DataQualityIndicatorCounts,
  DataQualityIndicatorLevel,
} from './DataQualityIndicator.types';

export const DQ_INDICATOR_FETCH_LIMIT = 100;

export const OPEN_INCIDENT_STATUSES = [
  TestCaseResolutionStatusTypes.New,
  TestCaseResolutionStatusTypes.ACK,
  TestCaseResolutionStatusTypes.Assigned,
].join(',');

export const EMPTY_DQ_INDICATOR_COUNTS: DataQualityIndicatorCounts = {
  failingTests: 0,
  unresolvedIncidents: 0,
  upstreamIssues: 0,
};

/**
 * An open incident on a test that is failing right now is part of that
 * failure, so it is not counted again as a separate unresolved incident.
 */
export const countUnresolvedIncidents = (
  openIncidents: TestCaseResolutionStatus[],
  failingTestCaseIds: Set<string>
) =>
  openIncidents.filter(
    (incident) => !failingTestCaseIds.has(incident.testCaseReference?.id ?? '')
  ).length;

export const getDataQualityIndicatorLevel = ({
  failingTests,
  unresolvedIncidents,
  upstreamIssues,
}: DataQualityIndicatorCounts): DataQualityIndicatorLevel => {
  if (failingTests > 0) {
    return 'failing';
  }
  if (unresolvedIncidents > 0) {
    return 'incident';
  }
  if (upstreamIssues > 0) {
    return 'upstream';
  }

  return 'none';
};

export const hasMultipleDataQualityConditions = (
  counts: DataQualityIndicatorCounts
) => Object.values(counts).filter((count) => count > 0).length > 1;
