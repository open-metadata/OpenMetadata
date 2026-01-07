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
import { Card, Divider } from 'antd';
import { entries, isNumber, omit, startCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { TooltipProps } from 'recharts';
import { GREEN_3, RED_3 } from '../../../../constants/Color.constants';
import { TABLE_FRESHNESS_KEY } from '../../../../constants/TestSuite.constant';
import { Thread } from '../../../../generated/entity/feed/thread';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { formatNumberWithComma } from '../../../../utils/CommonUtils';
import {
  convertSecondsToHumanReadableFormat,
  formatDateTime,
} from '../../../../utils/date-time/DateTimeUtils';
import { getTaskDetailPath } from '../../../../utils/TasksUtils';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import './test-summary-custom-tooltip.less';

const TestSummaryCustomTooltip = (
  props: TooltipProps<string | number, string>
) => {
  const { t } = useTranslation();
  const { active, payload = [] } = props;

  if (!active || payload.length === 0) {
    return null;
  }

  const payloadData = payload[0].payload;
  const timestamp = payloadData.name as number;
  const status = payloadData.status as TestCaseStatus;
  const passedRows = payloadData.passedRows as number | undefined;
  const failedRows = payloadData.failedRows as number | undefined;
  const incidentId = payloadData.incidentId as string | undefined;
  const task = payloadData.task as Thread | undefined;

  // Calculate total rows
  const totalRows = (passedRows ?? 0) + (failedRows ?? 0);

  // Format date time using the same format as x-axis
  const formattedDateTime = formatDateTime(timestamp);

  // Get status color
  const statusColor =
    status === TestCaseStatus.Failed
      ? RED_3
      : status === TestCaseStatus.Success
      ? GREEN_3
      : undefined;

  // Helper to check if value is a Thread
  const isThread = (value: unknown): value is Thread => {
    return typeof value === 'object' && value !== null && 'task' in value;
  };

  // Get data fields (excluding fields that are displayed explicitly)
  const data = entries(
    omit(payloadData, [
      'name',
      'status',
      'incidentId',
      'task',
      'passedRows',
      'failedRows',
      'boundArea',
    ])
  );

  // Render function for tooltip items (previous implementation logic)
  const tooltipRender = ([key, value]: [
    key: string,
    value: string | number | Thread
  ]) => {
    // Skip task since it's handled separately (incident and assignee)
    if (isThread(value)) {
      return null;
    }

    const tooltipValue = isNumber(value) ? formatNumberWithComma(value) : value;

    return (
      <li
        className="d-flex items-center justify-between gap-6 p-b-xss text-sm"
        key={`item-${key}`}>
        <span className="flex items-center text-grey-muted">
          {startCase(key)}
        </span>
        <span className="font-medium" data-testid={key}>
          {key === TABLE_FRESHNESS_KEY && isNumber(value)
            ? // freshness value is in seconds from Python/backend, use dedicated seconds converter
              convertSecondsToHumanReadableFormat(
                value,
                undefined,
                // negative value will be shown as late by
                `${t('label.late-by')} `
              )
            : tooltipValue}
        </span>
      </li>
    );
  };

  return (
    <Card>
      <div className="test-summary-tooltip-container">
        {/* Date and time at the top */}
        <div className="tooltip-date-time">{formattedDateTime}</div>

        {/* Dotted separator */}
        <Divider className="tooltip-separator" />

        {/* Other values */}
        <ul data-testid="test-summary-tooltip-container">
          {/* Status */}
          <li className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
            <span className="flex items-center text-grey-muted">
              {t('label.status')}
            </span>
            <span
              className="font-medium"
              data-testid="status"
              style={{ color: statusColor }}>
              {status}
            </span>
          </li>
          {/* Incident (from task) */}
          {task?.task && (
            <li className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
              <span className="flex items-center text-grey-muted">
                {t('label.incident')}
              </span>
              <span className="font-medium" data-testid="incident">
                <Link
                  className="font-medium cursor-pointer"
                  to={getTaskDetailPath(task)}>
                  {`#${task.task.id}`}
                </Link>
              </span>
            </li>
          )}
          {/* Incident ID (if task not present) */}
          {incidentId && !task?.task && (
            <li className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
              <span className="flex items-center text-grey-muted">
                {t('label.incident')}
              </span>
              <span className="font-medium" data-testid="incident">
                {`#${incidentId}`}
              </span>
            </li>
          )}
          {/* Rows Passed */}
          {passedRows !== undefined && totalRows > 0 && (
            <li className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
              <span className="flex items-center text-grey-muted">
                {t('label.passed-rows')}
              </span>
              <span className="font-medium" data-testid="rows-passed">
                {`${formatNumberWithComma(passedRows)}/${formatNumberWithComma(
                  totalRows
                )}`}
              </span>
            </li>
          )}
          {/* Rows Failed */}
          {failedRows !== undefined && totalRows > 0 && (
            <li className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
              <span className="flex items-center text-grey-muted">
                {t('label.failed-rows')}
              </span>
              <span className="font-medium" data-testid="rows-failed">
                {`${formatNumberWithComma(failedRows)}/${formatNumberWithComma(
                  totalRows
                )}`}
              </span>
            </li>
          )}
          {/* Other test result values */}
          {data.map(tooltipRender)}
          {/* Assignee (at the bottom) */}
          {task?.task && (
            <li className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
              <span className="flex items-center text-grey-muted">
                {t('label.assignee')}
              </span>
              <span className="font-medium" data-testid="assignee">
                <OwnerLabel owners={task.task.assignees} />
              </span>
            </li>
          )}
        </ul>
      </div>
    </Card>
  );
};

export default TestSummaryCustomTooltip;
