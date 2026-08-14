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
import { Typography } from '@openmetadata/ui-core-components';
import { Card, Skeleton } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceInsightsWidgetType } from '../../../enums/ServiceInsights.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getServiceInsightsWidgetPlaceholder } from '../../../utils/ServiceInsightsWidgets';
import { getReadableCountString } from '../../../utils/ServicePureUtils';
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
    [theme]
  );

  return (
    <Card
      className="widget-info-card total-data-assets-widget"
      data-testid="total-data-assets-widget">
      <div className="flex flex-col gap-1 widget-header">
        <Typography size="text-lg" weight="medium">
          {t('label.total-entity', { entity: t('label.data-asset-plural') })}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.total-data-assets-description')}
        </Typography>
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

                  <Typography>{entity.name}</Typography>
                </div>

                <Typography data-testid={`${entity.name}-count`} weight="bold">
                  {getReadableCountString(entity.value)}
                </Typography>
              </div>
            ))}
          </div>
        )}
      </Skeleton>
    </Card>
  );
}

export default TotalDataAssetsWidget;
