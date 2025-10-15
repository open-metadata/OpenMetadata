/*
 *  Copyright 2025 Collate.
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
import { useTranslation } from 'react-i18next';
import { TooltipProps } from 'recharts';
import { formatDateTimeLong } from '../../../utils/date-time/DateTimeUtils';

const ContractExecutionChartTooltip = (
  props: TooltipProps<string | number, string>
) => {
  const { t } = useTranslation();
  const { active, payload = [] } = props;

  const data = payload.length ? payload[0].payload.data : {};

  if (!active || payload.length === 0 || !data) {
    return null;
  }

  const timestamp =
    payload[0].payload.displayTimestamp ||
    payload[0].payload.name.split('_')[0];

  return (
    <Card
      title={
        <Typography.Title level={5}>
          {formatDateTimeLong(timestamp)}
        </Typography.Title>
      }>
      <ul
        className="test-summary-tooltip-container"
        data-testid="test-summary-tooltip-container">
        <li
          className="d-flex items-center justify-between gap-6 p-b-xss text-sm"
          key="item-contract-execution-status">
          <span className="flex items-center text-grey-muted">
            {t('label.contract-execution-status')}
          </span>
          <span className="font-medium">{data?.contractExecutionStatus}</span>
        </li>
      </ul>
    </Card>
  );
};

export default ContractExecutionChartTooltip;
