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
        height: 140,
        width: 140,
        chartType: ServiceInsightsWidgetType.TOTAL_DATA_ASSETS,
        placeholderClassName:
          variant === 'embedded'
            ? 'border-none tw:[&_svg]:size-[72px]'
            : 'border-none',
        theme,
      }),
    [theme, variant]
  );

  return (
    <Box
      className={classNames(
        'widget-info-card total-data-assets-widget tw:h-full tw:rounded-xl tw:dark:bg-surface',
        variant === 'embedded'
          ? 'tw:bg-white tw:gap-0'
          : 'tw:gap-4 tw:border tw:border-[var(--om-grey-15,#eaecf5)] tw:bg-[var(--om-grey-25,#fdfdfd)] tw:p-6 tw:dark:border-secondary'
      )}
      data-testid="total-data-assets-widget"
      direction="col">
      <div
        className={`flex flex-col gap-1 widget-header ${
          variant === 'embedded' ? 'tw:py-3' : ''
        }`}>
        <Typography size="text-lg" weight="medium">
          {t('label.total-entity', { entity: t('label.data-asset-plural') })}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.total-data-assets-description')}
        </Typography>
      </div>
      {isLoading && (
        <SkeletonParagraph
          animation={false}
          className="total-data-assets-loader"
        />
      )}
      {!isLoading && showPlaceholder && errorPlaceholder}
      {!isLoading && !showPlaceholder && (
        <Box
          className="assets-list-container tw:h-full tw:rounded-lg tw:bg-[var(--om-grey-50,#fafafa)] tw:p-4 tw:dark:bg-secondary"
          direction="col"
          gap={2}>
          {totalAssetsCount?.map((entity) => (
            <div
              className="flex items-center justify-between"
              key={entity.name}>
              <div className="flex items-center gap-3">
                <Box
                  align="center"
                  className="icon-container tw:size-7 tw:rounded-[14px] tw:bg-[var(--om-grey-2,#f2f2f2)] tw:dark:bg-tertiary"
                  justify="center">
                  {entity.icon}
                </Box>

                <Typography>{entity.name}</Typography>
              </div>

              <Typography data-testid={`${entity.name}-count`} weight="bold">
                {getReadableCountString(entity.value)}
              </Typography>
            </div>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default TotalDataAssetsWidget;
