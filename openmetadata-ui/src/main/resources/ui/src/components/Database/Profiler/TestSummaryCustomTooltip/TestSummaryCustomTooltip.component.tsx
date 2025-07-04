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
import { Card, Typography } from 'antd';
import { entries, isNumber, omit, startCase } from 'lodash';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { TooltipProps } from 'recharts';
import { TABLE_FRESHNESS_KEY } from '../../../../constants/TestSuite.constant';
import { Thread } from '../../../../generated/entity/feed/thread';
import {
  convertMillisecondsToHumanReadableFormat,
  formatDateTimeLong,
} from '../../../../utils/date-time/DateTimeUtils';
import { getTaskDetailPath } from '../../../../utils/TasksUtils';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import './test-summary-custom-tooltip.less';

const TestSummaryCustomTooltip = (
  props: TooltipProps<string | number, string>
) => {
  const { t } = useTranslation();
  const { active, payload = [] } = props;
  const data = payload.length
    ? entries(omit(payload[0].payload, ['name', 'incidentId', 'boundArea']))
    : [];

  if (!active || payload.length === 0) {
    return null;
  }

  const isThread = (value: unknown): value is Thread => {
    return typeof value === 'object' && value !== null && 'task' in value;
  };

  const tooltipRender = ([key, value]: [
    key: string,
    value: string | number | Thread
  ]) => {
    if (isThread(value)) {
      return value?.task ? (
        <Fragment key={`item-${key}`}>
          <li
            className="d-flex items-center justify-between gap-6 p-b-xss text-sm"
            key="item-incident">
            <span className="flex items-center text-grey-muted">
              {t('label.incident')}
            </span>
            <span className="font-medium" data-testid={key}>
              <Link
                className="font-medium cursor-pointer"
                data-testid="table-name"
                to={getTaskDetailPath(value)}>
                {`#${value.task.id}`}
              </Link>
            </span>
          </li>
          <li
            className="d-flex items-center justify-between gap-6 p-b-xss text-sm"
            key="item-assignee">
            <span className="flex items-center text-grey-muted">
              {t('label.assignee')}
            </span>
            <span className="font-medium cursor-pointer" data-testid={key}>
              <OwnerLabel owners={value.task.assignees} />
            </span>
          </li>
        </Fragment>
      ) : null;
    }

    return (
      <li
        className="d-flex items-center justify-between gap-6 p-b-xss text-sm"
        key={`item-${key}`}>
        <span className="flex items-center text-grey-muted">
          {startCase(key)}
        </span>
        <span className="font-medium" data-testid={key}>
          {key === TABLE_FRESHNESS_KEY && isNumber(value)
            ? // freshness will always be in seconds, so we need to convert it to milliseconds
              convertMillisecondsToHumanReadableFormat(
                value * 1000,
                undefined,
                false,
                // negative value will be shown as late by
                `${t('label.late-by')} `
              )
            : value}
        </span>
      </li>
    );
  };

  return (
    <Card
      title={
        <Typography.Title level={5}>
          {formatDateTimeLong(payload[0].payload.name)}
        </Typography.Title>
      }>
      <ul
        className="test-summary-tooltip-container"
        data-testid="test-summary-tooltip-container">
        {data.map(tooltipRender)}
      </ul>
    </Card>
  );
};

export default TestSummaryCustomTooltip;
