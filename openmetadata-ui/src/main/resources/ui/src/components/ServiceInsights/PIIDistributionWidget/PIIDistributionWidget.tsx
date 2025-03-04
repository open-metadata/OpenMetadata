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
import { Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getDistributionChart } from '../../../utils/ServiceInsightsTabUtils';
import { ChartData } from '../PlatformInsightsWidget/PlatformInsightsWidget.interface';

function PIIDistributionWidget({
  chartsData,
  isLoading,
}: {
  chartsData: ChartData[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="service-insights-widget widget-flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Typography.Text className="font-medium text-lg">
          {t('label.entity-distribution', { entity: t('label.pii-uppercase') })}
        </Typography.Text>
        <Typography.Text className="text-grey-muted text-sm">
          {t('message.pii-distribution-description')}
        </Typography.Text>
      </div>
      {getDistributionChart(chartsData, isLoading)}
    </div>
  );
}

export default PIIDistributionWidget;
