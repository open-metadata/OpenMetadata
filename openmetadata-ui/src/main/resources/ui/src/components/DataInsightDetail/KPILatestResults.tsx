/*
 *  Copyright 2022 Collate.
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

import { Space, Typography } from 'antd';
import { toNumber, uniqueId } from 'lodash';

import React, { FC, useMemo } from 'react';
import { KpiTargetType } from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { UIKpiResult } from '../../interface/data-insight.interface';
import { getKpiResultFeedback } from '../../utils/DataInsightUtils';
import { getNumberOfDaysForTimestamp } from '../../utils/TimeUtils';
import DataInsightProgressBar from './DataInsightProgressBar';

interface Props {
  kpiLatestResultsRecord: Record<string, UIKpiResult>;
}

const KPILatestResults: FC<Props> = ({ kpiLatestResultsRecord }) => {
  const { latestResultsList } = useMemo(() => {
    return { latestResultsList: Object.entries(kpiLatestResultsRecord) };
  }, [kpiLatestResultsRecord]);

  return (
    <Space className="w-full" direction="vertical" size={16}>
      {latestResultsList.map((result) => {
        const name = result[0];
        const resultData = result[1];

        const isPercentage = resultData.metricType === KpiTargetType.Percentage;

        const targetResult = resultData.targetResult[0];

        const targetValue = toNumber(targetResult.value);
        const targetMetValue = toNumber(resultData.target);

        const targetPercentValue = isPercentage
          ? (targetValue * 100).toFixed(2)
          : targetValue;
        const targetMetPercentValue = isPercentage
          ? (targetMetValue * 100).toFixed(2)
          : targetMetValue;

        const suffix = isPercentage ? '%' : '';

        const currentProgress = (targetValue / targetMetValue) * 100;

        const daysLeft = getNumberOfDaysForTimestamp(resultData.endDate);

        const isTargetMet = targetResult.targetMet;

        return (
          <Space
            className="w-full"
            direction="vertical"
            key={uniqueId()}
            size={8}>
            <Typography.Text className="data-insight-label-text">
              {resultData.displayName ?? name}
            </Typography.Text>
            <div>
              <DataInsightProgressBar
                showSuccessInfo
                progress={Number(currentProgress)}
                showLabel={false}
                startValue={isPercentage ? targetPercentValue : targetValue}
                successValue={
                  isPercentage ? targetMetPercentValue : targetMetValue
                }
                suffix={suffix}
              />

              <Typography.Text className="data-insight-label-text">
                {getKpiResultFeedback(daysLeft, Boolean(isTargetMet))}
              </Typography.Text>
            </div>
          </Space>
        );
      })}
    </Space>
  );
};

export default KPILatestResults;
