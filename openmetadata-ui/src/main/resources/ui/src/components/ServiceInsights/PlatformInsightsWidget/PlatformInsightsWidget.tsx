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
  Badge,
  Box,
  Card,
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
import { PLATFORM_INSIGHTS_CHARTS } from '../../../constants/ServiceInsightsTab.constants';
import { SystemChartType } from '../../../enums/DataInsight.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { getTitleByChartType } from '../../../utils/ServiceInsightsTabPureUtils';
import { getReadableCountString } from '../../../utils/ServicePureUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import {
  ChartSeriesData,
  PlatformInsightsWidgetProps,
} from './PlatformInsightsWidget.interface';

const renderViewMoreExpandIcon = (
  t: ReturnType<typeof useTranslation>['t']
) => (
  <Box
    align="center"
    className="expand-icon-container tw:text-brand-secondary"
    gap={2}>
    <Typography>{t('label.view-more')}</Typography>
    <ArrowSvg height={14} width={14} />
  </Box>
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

  const { filteredCharts, filteredChartsData } = useMemo(() => {
    const filteredCharts = PLATFORM_INSIGHTS_CHARTS.filter((chart) =>
      chart === SystemChartType.HealthyDataAssets
        ? serviceCategory === ServiceCategory.DATABASE_SERVICES
        : true
    );

    return {
      filteredCharts,
      filteredChartsData: chartsData.filter(
        (chart): chart is ChartSeriesData & { chartType: SystemChartType } =>
          chart.chartType !== undefined &&
          filteredCharts.includes(chart.chartType)
      ),
    };
  }, [serviceCategory, chartsData]);

  const cardClass = classNames(
    'widget-info-card other-charts-card',
    variant === 'default' && 'tw:bg-secondary'
  );

  const header = (
    <Box direction="col" gap={1}>
      <Typography size="text-lg" weight="medium">
        {t('label.entity-insight-plural', { entity: t('label.platform') })}
      </Typography>
      <Typography color="secondary" size="text-sm">
        {t('message.platform-insight-description')}
      </Typography>
    </Box>
  );

  // Keep the export selector on the chart region used by the download action.
  const content = (
    <div className="export-platform-insights-chart">
      {/* Columns follow the container width, not a fixed count: five cards
          squeezed into a half-width panel wrapped their titles unevenly. */}
      <div className="other-charts-container tw:grid tw:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] tw:gap-4">
        {isLoading
          ? filteredCharts.map((chartType) => (
              <Card className={cardClass} key={chartType}>
                <Card.Content>
                  <SkeletonParagraph rows={2} />
                </Card.Content>
              </Card>
            ))
          : filteredChartsData.map((chart) => (
              <Card className={cardClass} key={chart.chartType}>
                <Card.Content>
                  <Typography
                    ellipsis={{ tooltip: true }}
                    size="text-sm"
                    weight="semibold">
                    {getTitleByChartType(chart.chartType)}
                  </Typography>
                  <Box
                    align="center"
                    className="tw:mt-2"
                    gap={2}
                    justify="between">
                    <Typography
                      className="current-percentage"
                      size="text-xl"
                      weight="semibold">
                      {getReadableCountString(chart.currentPercentage)}%
                    </Typography>
                    {!isUndefined(chart.percentageChange) && (
                      <Badge
                        className="percent-change-tag tw:gap-1"
                        color={chart.isIncreased ? 'success' : 'error'}
                        size="sm"
                        type="color">
                        {chart.percentageChange !== 0 && (
                          <ArrowUp
                            className={classNames(
                              !chart.isIncreased && 'flip-vertical'
                            )}
                            height={11}
                            width={11}
                          />
                        )}
                        {getReadableCountString(chart.percentageChange)}%
                      </Badge>
                    )}
                  </Box>
                  {!isUndefined(chart.percentageChange) && (
                    <Typography
                      ellipsis
                      as="p"
                      className="tw:mt-1"
                      color="secondary"
                      size="text-xs">
                      {chart.numberOfDays === 1
                        ? t('label.in-the-last-day')
                        : t('label.in-last-number-of-days', {
                            numberOfDays: chart.numberOfDays,
                          })}
                    </Typography>
                  )}
                </Card.Content>
              </Card>
            ))}
      </div>
    </div>
  );

  // The embedded layout has always stayed open. Express that as a layout choice
  // instead of disabling an interactive collapse header through CSS.
  if (variant === 'embedded') {
    return (
      <Box className="platform-insights-card" direction="col" gap={4}>
        {header}
        {content}
      </Box>
    );
  }

  return (
    <Accordion
      className="service-insights-collapse-widget platform-insights-card tw:rounded-xl tw:border tw:border-secondary"
      defaultExpandedKeys={['1']}>
      <AccordionItem className="tw:bg-surface" id="1">
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
