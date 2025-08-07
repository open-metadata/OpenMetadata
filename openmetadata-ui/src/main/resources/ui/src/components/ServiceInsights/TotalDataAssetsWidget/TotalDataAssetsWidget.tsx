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
import { Card, Skeleton, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PieChartIcon } from '../../../assets/svg/pie-chart.svg';
import { ServiceInsightsWidgetType } from '../../../enums/ServiceInsights.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getServiceInsightsWidgetPlaceholder } from '../../../utils/ServiceInsightsTabUtils';
import { getReadableCountString } from '../../../utils/ServiceUtils';
import './total-data-assets-widget.less';
import { TotalAssetsWidgetProps } from './TotalDataAssetsWidget.interface';

function TotalDataAssetsWidget({
  isLoading,
  totalAssetsCount,
}: Readonly<TotalAssetsWidgetProps>) {
  const { t } = useTranslation();
  const { theme } = useApplicationStore();

  const showPlaceholder = useMemo(
    () =>
      isEmpty(totalAssetsCount) ||
      totalAssetsCount?.every((entity) => entity.value === 0),
    [totalAssetsCount]
  );

  const errorPlaceholder = useMemo(
    () =>
      getServiceInsightsWidgetPlaceholder({
        height: 140,
        width: 140,
        chartType: ServiceInsightsWidgetType.TOTAL_DATA_ASSETS,
        placeholderClassName: 'border-none',
        theme,
      }),
    []
  );

  return (
    <Card className="widget-info-card total-data-assets-widget">
      <div className="flex items-center gap-2">
        <div className="p-0 icon-container">
          <PieChartIcon height={16} width={16} />
        </div>

        <Typography.Text className="font-semibold text-md">
          {t('label.total-entity', { entity: t('label.data-asset-plural') })}
        </Typography.Text>
      </div>
      <Skeleton loading={isLoading}>
        {showPlaceholder ? (
          errorPlaceholder
        ) : (
          <div className="assets-list-container">
            {totalAssetsCount?.map((entity) => (
              <div
                className="flex items-center justify-between"
                key={entity.name}>
                <div className="flex items-center gap-3">
                  <div className="p-0 icon-container">{entity.icon}</div>

                  <Typography.Text>{entity.name}</Typography.Text>
                </div>

                <Typography.Text className="font-bold">
                  {getReadableCountString(entity.value)}
                </Typography.Text>
              </div>
            ))}
          </div>
        )}
      </Skeleton>
    </Card>
  );
}

export default TotalDataAssetsWidget;
