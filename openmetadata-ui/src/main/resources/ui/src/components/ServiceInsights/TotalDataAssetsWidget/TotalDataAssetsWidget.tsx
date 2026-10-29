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
import {
  Box,
  Card,
  SkeletonParagraph,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceInsightsWidgetType } from '../../../enums/ServiceInsights.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getServiceInsightsWidgetPlaceholder } from '../../../utils/ServiceInsightsWidgets';
import { getReadableCountString } from '../../../utils/ServicePureUtils';
import { TotalAssetsWidgetProps } from './TotalDataAssetsWidget.interface';

function TotalDataAssetsWidget({
  isLoading,
  totalAssetsCount,
  variant = 'default',
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
        height: variant === 'embedded' ? 72 : 140,
        width: variant === 'embedded' ? 72 : 140,
        chartType: ServiceInsightsWidgetType.TOTAL_DATA_ASSETS,
        theme,
      }),
    [theme, variant]
  );

  return (
    <Box
      className={classNames(
        'widget-info-card total-data-assets-widget tw:h-full',
        variant !== 'embedded' &&
          'tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:p-6'
      )}
      data-testid="total-data-assets-widget"
      direction="col"
      gap={4}>
      <Box className="widget-header" direction="col" gap={1}>
        <Typography size="text-lg" weight="medium">
          {t('label.total-entity', { entity: t('label.data-asset-plural') })}
        </Typography>
        <Typography color="secondary" size="text-sm">
          {t('message.total-data-assets-description')}
        </Typography>
      </Box>
      {isLoading && (
        <SkeletonParagraph
          animation={false}
          className="total-data-assets-loader"
        />
      )}
      {!isLoading && showPlaceholder && errorPlaceholder}
      {!isLoading && !showPlaceholder && (
        <Card className="assets-list-container tw:h-full">
          <Card.Content>
            <Box direction="col" gap={2}>
              {totalAssetsCount?.map((entity) => (
                <Box align="center" justify="between" key={entity.name}>
                  <Box align="center" gap={3}>
                    <Box
                      align="center"
                      className="icon-container tw:size-7 tw:rounded-full tw:bg-tertiary"
                      justify="center">
                      {entity.icon}
                    </Box>

                    <Typography>{entity.name}</Typography>
                  </Box>

                  <Typography
                    data-testid={`${entity.name}-count`}
                    weight="bold">
                    {getReadableCountString(entity.value)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Card.Content>
        </Card>
      )}
    </Box>
  );
}

export default TotalDataAssetsWidget;
