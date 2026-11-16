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
import {
  Box,
  Card,
  Divider,
  Owner,
  Typography,
} from '@openmetadata/ui-core-components';
import entries from 'lodash/entries';
import isNumber from 'lodash/isNumber';
import isUndefined from 'lodash/isUndefined';
import omit from 'lodash/omit';
import startCase from 'lodash/startCase';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { TABLE_FRESHNESS_KEY } from '../../../../constants/TestSuite.constant';
import { Task } from '../../../../generated/entity/tasks/task';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import {
  getIncidentDetails,
  PLACED_KEYS_FIELD,
} from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import {
  convertSecondsToHumanReadableFormat,
  formatDateTime,
} from '../../../../utils/date-time/DateTimeUtils';
import { formatNumberWithComma } from '../../../../utils/NumberUtils';
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
    let statusColor: 'danger' | 'success' | undefined;
    if (status === TestCaseStatus.Failed) {
      statusColor = 'danger';
    } else if (status === TestCaseStatus.Success) {
      statusColor = 'success';
    }
    // A placed value only positions a run that recorded nothing on the chart.
    // Listing it would report a result the run never produced.
    const placedKeys = (payloadData[PLACED_KEYS_FIELD] as string[]) ?? [];
    const data = entries(
      omit(payloadData, [
        ...OMITTED_TOOLTIP_PAYLOAD_KEYS,
        PLACED_KEYS_FIELD,
        ...placedKeys,
      ])
    );

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
        <Box align="center" gap={6} justify="between" key={`item-${key}`}>
          <Typography as="span" color="secondary" size="text-sm">
            {startCase(key)}
          </Typography>
          <Typography
            as="span"
            data-testid={key}
            size="text-sm"
            weight="medium">
            {key === TABLE_FRESHNESS_KEY && isNumber(value)
              ? convertSecondsToHumanReadableFormat(
                  value,
                  undefined,
                  `${t('label.late-by')} `
                )
              : tooltipValue}
          </Typography>
        </Box>
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
      <Card.Content>
        <Box className="test-summary-tooltip-container" direction="col">
          <Typography size="text-xs" weight="medium">
            {formattedDateTime}
          </Typography>
          <Divider dashed className="tw:my-2" />
          <Box
            data-testid="test-summary-tooltip-container"
            direction="col"
            gap={1}>
            <Box align="center" gap={6} justify="between">
              <Typography as="span" color="secondary" size="text-sm">
                {t('label.status')}
              </Typography>
              <Typography
                as="span"
                color={statusColor}
                data-testid="status"
                size="text-sm"
                weight="medium">
                {status}
              </Typography>
            </Box>
            {incidentDisplayId && incidentPath && (
              <Box align="center" gap={6} justify="between">
                <Typography as="span" color="secondary" size="text-sm">
                  {t('label.incident')}
                </Typography>
                <Typography
                  as="span"
                  data-testid="incident"
                  size="text-sm"
                  weight="medium">
                  <Link
                    className="tooltip-incident-link font-medium cursor-pointer"
                    to={incidentPath}>
                    {`#${incidentDisplayId}`}
                  </Link>
                </Typography>
              </Box>
            )}
            {!isUndefined(passedRows) && totalRows > 0 && (
              <Box align="center" gap={6} justify="between">
                <Typography as="span" color="secondary" size="text-sm">
                  {t('label.passed-rows')}
                </Typography>
                <Typography
                  as="span"
                  data-testid="rows-passed"
                  size="text-sm"
                  weight="medium">
                  {`${formatNumberWithComma(
                    passedRows
                  )}/${formatNumberWithComma(totalRows)}`}
                </Typography>
              </Box>
            )}
            {!isUndefined(failedRows) && totalRows > 0 && (
              <Box align="center" gap={6} justify="between">
                <Typography as="span" color="secondary" size="text-sm">
                  {t('label.failed-rows')}
                </Typography>
                <Typography
                  as="span"
                  data-testid="rows-failed"
                  size="text-sm"
                  weight="medium">
                  {`${formatNumberWithComma(
                    failedRows
                  )}/${formatNumberWithComma(totalRows)}`}
                </Typography>
              </Box>
            )}
            {data.map((entry) =>
              tooltipRender(entry as [string, string | number])
            )}
            {incidentAssignees && (
              <Box align="center" gap={6} justify="between">
                <Typography as="span" color="secondary" size="text-sm">
                  {t('label.assignee')}
                </Typography>
                <Typography
                  as="span"
                  data-testid="assignee"
                  size="text-sm"
                  weight="medium">
                  <Owner owners={incidentAssignees} />
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
};

export default TestSummaryCustomTooltip;
