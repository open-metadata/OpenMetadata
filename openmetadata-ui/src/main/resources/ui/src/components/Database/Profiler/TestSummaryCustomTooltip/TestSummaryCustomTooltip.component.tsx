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
import { entries, isNumber, isString, omit, startCase } from 'lodash';
import React, { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { TooltipProps } from 'recharts';
import { Thread } from '../../../../generated/entity/feed/thread';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { getTaskDetailPath } from '../../../../utils/TasksUtils';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';

const TestSummaryCustomTooltip = (
  props: TooltipProps<string | number, string>
) => {
  const { t } = useTranslation();
  const { active, payload = [] } = props;
  const data = payload.length
    ? entries(omit(payload[0].payload, ['name', 'incidentId']))
    : [];

  if (!active || payload.length === 0) {
    return null;
  }

  const tooltipRender = ([key, value]: [
    key: string,
    value: string | number | Thread
  ]) => {
    if (key === 'task' && !isString(value) && !isNumber(value)) {
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
              <OwnerLabel owner={value.task.assignees[0]} />
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
          {value}
        </span>
      </li>
    );
  };

  return (
    <Card
      title={
        <Typography.Title level={5}>
          {formatDateTime(payload[0].payload.name)}
        </Typography.Title>
      }>
      <ul data-testid="test-summary-tooltip-container">
        {data.map(tooltipRender)}
      </ul>
    </Card>
  );
};

export default TestSummaryCustomTooltip;
