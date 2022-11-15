import { Progress, Space, Typography } from 'antd';
import { toNumber, uniqueId } from 'lodash';

import React, { FC, useMemo } from 'react';
import { KpiTargetType } from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { UIKpiResult } from '../../interface/data-insight.interface';
import { formatDateTime } from '../../utils/TimeUtils';

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
        const targetResult = resultData.targetResult[0];
        const targetValue = toNumber(targetResult.value);
        const suffix =
          resultData.metricType === KpiTargetType.Percentage ? '%' : '';

        return (
          <Space className="w-full" direction="vertical" key={uniqueId()}>
            <Typography.Text className="data-insight-label-text">
              {resultData.displayName ?? name}
            </Typography.Text>
            <Space className="w-full justify-between">
              <Typography.Text>{`${targetValue}${suffix}`}</Typography.Text>
              <Typography.Text>{`${resultData.target}${suffix}`}</Typography.Text>
            </Space>
            <Progress percent={targetValue} showInfo={false} />
            <Typography.Text>
              {formatDateTime(resultData.endDate)}
            </Typography.Text>
          </Space>
        );
      })}
    </Space>
  );
};

export default KPILatestResults;
