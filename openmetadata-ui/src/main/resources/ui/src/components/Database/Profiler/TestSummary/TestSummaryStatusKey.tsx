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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { getStatusDotColor } from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import { STATUS_CONFIG } from '../../../DataQuality/IncidentManager/IncidentManagerPageHeader/TestCaseLastRunBanner.constants';

// The order the statuses read in, not the order they happen to appear in the
// window, so the key does not reshuffle as the date range changes.
const STATUS_ORDER = [
  TestCaseStatus.Success,
  TestCaseStatus.Failed,
  TestCaseStatus.Aborted,
  TestCaseStatus.Queued,
];

interface TestSummaryStatusKeyProps {
  statuses: TestCaseStatus[];
}

/**
 * Names the colour of each status dot. Without it the only thing separating an
 * aborted run from a queued one on the chart is its colour, which is not
 * something every reader can use.
 */
const TestSummaryStatusKey = ({ statuses }: TestSummaryStatusKeyProps) => {
  const { t } = useTranslation();

  const present = useMemo(() => {
    const seen = new Set(statuses);

    return STATUS_ORDER.filter((status) => seen.has(status));
  }, [statuses]);

  if (present.length === 0) {
    return null;
  }

  return (
    <ul
      className="tw:flex tw:list-none tw:flex-wrap tw:items-center tw:gap-4 tw:p-0"
      data-testid="test-summary-status-key">
      {present.map((status) => (
        <li
          className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:text-tertiary"
          data-testid={`status-key-${status}`}
          key={status}>
          <span
            aria-hidden="true"
            className="tw:size-2 tw:rounded-full"
            style={
              // Aborted is drawn hollow so the run that produced no value is
              // told apart by shape as well as by colour.
              status === TestCaseStatus.Aborted
                ? { border: `2px solid ${getStatusDotColor(status)}` }
                : { backgroundColor: getStatusDotColor(status) }
            }
          />
          {t(STATUS_CONFIG[status].statusLabel)}
        </li>
      ))}
    </ul>
  );
};

export default TestSummaryStatusKey;
