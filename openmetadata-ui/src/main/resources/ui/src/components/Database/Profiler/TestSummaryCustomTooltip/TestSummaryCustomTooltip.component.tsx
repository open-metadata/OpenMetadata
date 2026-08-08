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
import { Typography } from '@openmetadata/ui-core-components';
import { Card, Divider } from 'antd';
import entries from 'lodash/entries';
import isNumber from 'lodash/isNumber';
import isUndefined from 'lodash/isUndefined';
import omit from 'lodash/omit';
import startCase from 'lodash/startCase';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { GREEN_3, RED_3 } from '../../../../constants/Color.constants';
import { TABLE_FRESHNESS_KEY } from '../../../../constants/TestSuite.constant';
import { Task } from '../../../../generated/entity/tasks/task';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { getIncidentDetails } from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import {
  convertSecondsToHumanReadableFormat,
  formatDateTime,
} from '../../../../utils/date-time/DateTimeUtils';
import { formatNumberWithComma } from '../../../../utils/NumberUtils';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import './test-summary-custom-tooltip.less';

const OMITTED_TOOLTIP_PAYLOAD_KEYS = [
  'name',
  'status',
  'incidentId',
  'task',
  'passedRows',
  'failedRows',
  'boundArea',
] as const;

interface TestSummaryCustomTooltipProps {
  active?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  payload?: Array<{ payload: Record<string, unknown> }>;
}

const TestSummaryCustomTooltip = (props: TestSummaryCustomTooltipProps) => {
  const { t } = useTranslation();
  const { active, onMouseEnter, onMouseLeave, payload = [] } = props;

  const state = useMemo(() => {
    if (payload.length === 0) {
      return null;
    }

    const payloadData = payload[0].payload;
    const timestamp = payloadData.name as number;
    const status = payloadData.status as TestCaseStatus;
    const passedRows = payloadData.passedRows as number | undefined;
    const failedRows = payloadData.failedRows as number | undefined;
    const totalRows = (passedRows ?? 0) + (failedRows ?? 0);
    const formattedDateTime = formatDateTime(timestamp);
    let statusColor: string | undefined;
    if (status === TestCaseStatus.Failed) {
      statusColor = RED_3;
    } else if (status === TestCaseStatus.Success) {
      statusColor = GREEN_3;
    }
    const data = entries(omit(payloadData, [...OMITTED_TOOLTIP_PAYLOAD_KEYS]));

    return {
      status,
      passedRows,
      failedRows,
      task: payloadData.task as Task | undefined,
      totalRows,
      formattedDateTime,
      statusColor,
      data,
    };
  }, [payload]);

  const tooltipRender = useCallback(
    ([key, value]: [key: string, value: string | number]) => {
      const tooltipValue = isNumber(value)
        ? formatNumberWithComma(value)
        : value;

      return (
        <li
          className="d-flex items-center justify-between gap-6 p-b-xss text-sm"
          key={`item-${key}`}>
          <Typography as="span" className="flex items-center text-grey-muted">
            {startCase(key)}
          </Typography>
          <Typography as="span" className="font-medium" data-testid={key}>
            {key === TABLE_FRESHNESS_KEY && isNumber(value)
              ? convertSecondsToHumanReadableFormat(
                  value,
                  undefined,
                  `${t('label.late-by')} `
                )
              : tooltipValue}
          </Typography>
        </li>
      );
    },
    [t]
  );

  if (!active || !state) {
    return null;
  }

  const {
    status,
    passedRows,
    failedRows,
    task,
    totalRows,
    formattedDateTime,
    statusColor,
    data,
  } = state;
  const { incidentDisplayId, incidentPath, incidentAssignees } =
    getIncidentDetails(task);

  return (
    <Card
      className="test-summary-tooltip"
      data-testid="test-summary-tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}>
      <div className="test-summary-tooltip-container">
        <div className="tooltip-date-time">{formattedDateTime}</div>
        <Divider className="tooltip-separator" />
        <ul data-testid="test-summary-tooltip-container">
          <li className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
            <Typography as="span" className="flex items-center text-grey-muted">
              {t('label.status')}
            </Typography>
            <Typography
              as="span"
              className="font-medium"
              data-testid="status"
              style={{ color: statusColor }}>
              {status}
            </Typography>
          </li>
          {incidentDisplayId && incidentPath && (
            <li className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
              <Typography
                as="span"
                className="flex items-center text-grey-muted">
                {t('label.incident')}
              </Typography>
              <Typography
                as="span"
                className="font-medium"
                data-testid="incident">
                <Link
                  className="tooltip-incident-link font-medium cursor-pointer"
                  to={incidentPath}>
                  {`#${incidentDisplayId}`}
                </Link>
              </Typography>
            </li>
          )}
          {!isUndefined(passedRows) && totalRows > 0 && (
            <li className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
              <Typography
                as="span"
                className="flex items-center text-grey-muted">
                {t('label.passed-rows')}
              </Typography>
              <Typography
                as="span"
                className="font-medium"
                data-testid="rows-passed">
                {`${formatNumberWithComma(passedRows)}/${formatNumberWithComma(
                  totalRows
                )}`}
              </Typography>
            </li>
          )}
          {!isUndefined(failedRows) && totalRows > 0 && (
            <li className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
              <Typography
                as="span"
                className="flex items-center text-grey-muted">
                {t('label.failed-rows')}
              </Typography>
              <Typography
                as="span"
                className="font-medium"
                data-testid="rows-failed">
                {`${formatNumberWithComma(failedRows)}/${formatNumberWithComma(
                  totalRows
                )}`}
              </Typography>
            </li>
          )}
          {data.map((entry) =>
            tooltipRender(entry as [string, string | number])
          )}
          {incidentAssignees && (
            <li className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
              <Typography
                as="span"
                className="flex items-center text-grey-muted">
                {t('label.assignee')}
              </Typography>
              <Typography
                as="span"
                className="font-medium"
                data-testid="assignee">
                <OwnerLabel owners={incidentAssignees} />
              </Typography>
            </li>
          )}
        </ul>
      </div>
    </Card>
  );
};

export default TestSummaryCustomTooltip;
