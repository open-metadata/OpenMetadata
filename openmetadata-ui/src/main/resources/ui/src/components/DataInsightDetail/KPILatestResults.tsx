import { Progress, Space, Typography } from 'antd';
import { toNumber, uniqueId } from 'lodash';

import React, { FC, useMemo } from 'react';
import { KpiTargetType } from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { UIKpiResult } from '../../interface/data-insight.interface';
import { pluralize } from '../../utils/CommonUtils';
import { getNumberOfDaysForTimestamp } from '../../utils/TimeUtils';

interface Props {
  kpiLatestResultsRecord: Record<string, UIKpiResult>;
}

const KPILatestResults: FC<Props> = ({ kpiLatestResultsRecord }) => {
  const { latestResultsList } = useMemo(() => {
    return { latestResultsList: Object.entries(kpiLatestResultsRecord) };
  }, [kpiLatestResultsRecord]);

  return (
    <Space className="w-full" direction="vertical">
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

        // value for percentage metric
        const calculatedPercentage =
          toNumber(targetPercentValue) +
          (100 - toNumber(targetMetPercentValue));

        // value for number metric
        const calculatedNumberValue = (targetValue / targetMetValue) * 100;

        return (
          <Space className="w-full" direction="vertical" key={uniqueId()}>
            <Typography.Text className="data-insight-label-text">
              {resultData.displayName ?? name}
            </Typography.Text>
            <Space className="w-full justify-between">
              <Typography.Text>{`${
                isPercentage ? targetPercentValue : targetValue
              }${suffix}`}</Typography.Text>
              <Typography.Text>{`${
                isPercentage ? targetMetPercentValue : targetMetValue
              }${suffix}`}</Typography.Text>
            </Space>
            <Progress
              percent={
                isPercentage ? calculatedPercentage : calculatedNumberValue
              }
              showInfo={false}
            />
            <Typography.Text>
              {pluralize(
                getNumberOfDaysForTimestamp(resultData.endDate),
                'day'
              )}{' '}
              left
            </Typography.Text>
          </Space>
        );
      })}
    </Space>
  );
};

export default KPILatestResults;
