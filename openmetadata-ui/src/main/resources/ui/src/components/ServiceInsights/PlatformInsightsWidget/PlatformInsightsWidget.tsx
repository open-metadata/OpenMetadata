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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Box,
  SkeletonParagraph,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { ServiceTypes } from 'Models';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowSvg } from '../../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as ArrowUp } from '../../../assets/svg/ic-trend-up.svg';
import { GREEN_1, RED_1 } from '../../../constants/Color.constants';
import { PLATFORM_INSIGHTS_CHARTS } from '../../../constants/ServiceInsightsTab.constants';
import { SystemChartType } from '../../../enums/DataInsight.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { getTitleByChartType } from '../../../utils/ServiceInsightsTabPureUtils';
import { getReadableCountString } from '../../../utils/ServicePureUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { PlatformInsightsWidgetProps } from './PlatformInsightsWidget.interface';

const renderViewMoreExpandIcon = (
  t: ReturnType<typeof useTranslation>['t']
) => (
  <div className="expand-icon-container tw:flex tw:items-center tw:justify-center tw:gap-2">
    <Typography className="text-primary">{t('label.view-more')}</Typography>
    <ArrowSvg className="text-primary" height={14} width={14} />
  </div>
);

function PlatformInsightsWidget({
  chartsData,
  isLoading,
  variant = 'default',
}: Readonly<PlatformInsightsWidgetProps>) {
  const { serviceCategory } = useRequiredParams<{
    serviceCategory: ServiceTypes;
  }>();
  const { t } = useTranslation();

  const { filteredCharts, filteredChartsData, containerClassName } =
    useMemo(() => {
      const filteredCharts = PLATFORM_INSIGHTS_CHARTS.filter((chart) =>
        chart === SystemChartType.HealthyDataAssets
          ? serviceCategory === ServiceCategory.DATABASE_SERVICES
          : true
      );

      return {
        filteredCharts,
        filteredChartsData: chartsData.filter((chart) =>
          filteredCharts.includes(chart.chartType)
        ),
        containerClassName:
          filteredCharts.length === 4 ? 'four-chart-container' : '',
      };
    }, [serviceCategory, chartsData]);

  const header = (
    <Box direction="col" gap={1}>
      <Typography className="font-medium text-lg tw:text-primary">
        {t('label.entity-insight-plural', { entity: t('label.platform') })}
      </Typography>
      <Typography className="tw:text-tertiary text-sm">
        {t('message.platform-insight-description')}
      </Typography>
    </Box>
  );
  const cardClass = [
    'widget-info-card other-charts-card tw:h-full tw:rounded-xl tw:border tw:border-[var(--om-grey-15,#eaecf5)]',
    // The embedded page does not inherit the classic insights page's gray card fill.
    variant === 'embedded'
      ? 'tw:bg-white'
      : 'tw:bg-[var(--om-grey-25,#fdfdfd)]',
    'tw:p-3 tw:dark:border-secondary tw:dark:bg-secondary',
  ].join(' ');

  // Keep the export selector on the chart region used by the download action.
  const content = (
    <Box className="export-platform-insights-chart tw:block">
      <Box
        className={classNames(
          'other-charts-container tw:grid tw:gap-4',
          containerClassName,
          variant === 'embedded'
            ? 'tw:grid-cols-3 tw:[&.four-chart-container]:grid-cols-2'
            : 'tw:grid-cols-5 tw:[&.four-chart-container]:grid-cols-4'
        )}>
        {isLoading
          ? filteredCharts.map((chartType) => (
              <Box className={cardClass} direction="col" key={chartType}>
                <SkeletonParagraph rows={2} />
              </Box>
            ))
          : filteredChartsData.map((chart) => (
              <Box
                className={cardClass}
                direction="col"
                justify="between"
                key={chart.chartType}>
                <Typography className="font-semibold text-sm">
                  {getTitleByChartType(chart.chartType)}
                </Typography>
                <Box align="start" className="tw:mt-1 tw:-mx-1">
                  <Box className="tw:w-1/2 tw:px-1">
                    <Typography className="current-percentage tw:text-xl tw:font-semibold tw:leading-5">
                      {getReadableCountString(chart.currentPercentage)}%
                    </Typography>
                  </Box>
                  {!isUndefined(chart.percentageChange) && (
                    <Box
                      align="end"
                      className="tw:w-1/2 tw:px-1"
                      direction="col"
                      gap={1}>
                      <Box
                        align="center"
                        className={classNames(
                          'percent-change-tag tw:w-fit tw:rounded-md tw:border tw:border-[#abefc6] tw:bg-[var(--om-green-9,#ecfdf3)] tw:px-1.5',
                          chart.isIncreased
                            ? 'tw:dark:bg-success-primary tw:dark:border-utility-success-200'
                            : 'tw:dark:bg-error-primary tw:dark:border-error-subtle'
                        )}
                        gap={1}
                        justify="center">
                        {chart.percentageChange !== 0 && (
                          <ArrowUp
                            className={classNames(
                              !chart.isIncreased && 'flip-vertical',
                              chart.isIncreased
                                ? 'tw:dark:text-fg-success-primary'
                                : 'tw:dark:text-fg-error-primary'
                            )}
                            color={chart.isIncreased ? GREEN_1 : RED_1}
                            height={11}
                            width={11}
                          />
                        )}
                        <Typography
                          className={classNames(
                            'font-medium text-xs',
                            chart.isIncreased
                              ? 'tw:dark:text-success-primary!'
                              : 'tw:dark:text-error-primary!'
                          )}
                          style={{
                            color: chart.isIncreased ? GREEN_1 : RED_1,
                          }}>
                          {getReadableCountString(chart.percentageChange)}%
                        </Typography>
                      </Box>
                      <Typography
                        className="font-small text-xs text-no-wrap"
                        color="secondary">
                        {chart.numberOfDays === 1
                          ? t('label.in-the-last-day')
                          : t('label.in-last-number-of-days', {
                              numberOfDays: chart.numberOfDays,
                            })}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
      </Box>
    </Box>
  );

  // The embedded layout has always stayed open. Express that as a layout choice
  // instead of disabling an interactive collapse header through CSS.
  if (variant === 'embedded') {
    return (
      <Box
        className="platform-insights-card tw:bg-white tw:dark:bg-surface"
        direction="col">
        <Box className="tw:py-3 tw:pr-4">{header}</Box>
        {content}
      </Box>
    );
  }

  return (
    <Accordion
      className="service-insights-collapse-widget platform-insights-card tw:rounded-xl tw:border
        tw:border-[var(--om-grey-15,#eaecf5)] tw:outline-0 tw:dark:border-secondary"
      defaultExpandedKeys={['1']}>
      <AccordionItem className="tw:bg-primary tw:dark:bg-surface" id="1">
        <AccordionHeader
          className="tw:px-4 tw:py-3 tw:hover:bg-transparent"
          showChevron={false}>
          {header}
          {renderViewMoreExpandIcon(t)}
        </AccordionHeader>
        <AccordionPanel className="tw:border-0 tw:px-4 tw:pt-0 tw:pb-4">
          {content}
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
}

export default PlatformInsightsWidget;
