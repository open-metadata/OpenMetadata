/*
 *  Copyright 2023 Collate.
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
import { Box, Typography } from '@openmetadata/ui-core-components';
import { PieChart } from '@openmetadata/ui-core-components/charts';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import {
  groupBy,
  isEmpty,
  omit,
  orderBy,
  reduce,
  sortBy,
  startCase,
} from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as TotalDataAssetsEmptyIcon } from '../../../../assets/svg/no-data-placeholder.svg';
import { ReactComponent as TotalAssetsWidgetIcon } from '../../../../assets/svg/widget/total-assets.svg';
import { DEFAULT_THEME } from '../../../../constants/Appearance.constants';
import { ROUTES } from '../../../../constants/constants';
import { SIZE } from '../../../../enums/common.enum';
import { SystemChartType } from '../../../../enums/DataInsight.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  DataInsightCustomChartResult,
  getChartPreviewByName,
} from '../../../../rest/DataInsightAPI';
import { generatePalette } from '../../../../styles/colorPallet';
import { getDataInsightPathWithFqn } from '../../../../utils/DataInsightPureUtils';
import {
  customFormatDateTime,
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import { handleKeyboardActivation } from '../../../../utils/KeyboardUtil';
import { showErrorToast } from '../../../../utils/ToastUtils';
import WidgetEmptyState from '../Common/WidgetEmptyState/WidgetEmptyState';
import WidgetHeader from '../Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import {
  DATA_ASSETS_SORT_BY_KEYS,
  DATA_ASSETS_SORT_BY_OPTIONS,
} from './TotalDataAssetsWidget.constant';
import { TotalDataAssetsWidgetProps } from './TotalDataAssetsWidget.interface';

const LEGEND_HIDDEN = { show: false };

const TotalDataAssetsWidget = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
  currentLayout,
  handleLayoutUpdate,
}: TotalDataAssetsWidgetProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { applicationConfig } = useApplicationStore();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [chartData, setChartData] = useState<DataInsightCustomChartResult>();
  const [selectedDate, setSelectedDate] = useState<number | undefined>();
  const [selectedSortBy, setSelectedSortBy] = useState<string>(
    DATA_ASSETS_SORT_BY_KEYS.LAST_7_DAYS
  );

  // Shades of the brand colour, dark to light, so the largest count is darkest.
  const pieChartColors = useMemo(() => {
    const primaryColor =
      applicationConfig?.customTheme?.primaryColor ??
      DEFAULT_THEME.primaryColor;

    return generatePalette(primaryColor).reverse();
  }, [applicationConfig?.customTheme?.primaryColor]);

  const widgetData = useMemo(() => {
    return currentLayout?.find((item) => item.i === widgetKey);
  }, [currentLayout, widgetKey]);

  const isFullSizeWidget = useMemo(() => {
    return currentLayout?.find((item) => item.i === widgetKey)?.w === 2;
  }, [currentLayout, widgetKey]);

  const { graphData, dataByDate, availableDates } = useMemo(() => {
    const results = chartData?.results ?? [];

    const groupedByDay = groupBy(results, 'day');
    const labels: string[] = [];

    const graphData = Object.entries(groupedByDay).map(([dayKey, entries]) => {
      const day = Number(dayKey);
      const values = entries.reduce((acc, curr) => {
        if (curr.group) {
          labels.push(curr.group);
        }

        return {
          ...acc,
          [curr.group ?? 'count']: curr.count,
        };
      }, {});

      return {
        day,
        dayString: customFormatDateTime(day, 'dd MMM'),
        ...values,
      };
    });

    const sortedData = sortBy(graphData, 'day');

    const dataByDate: Record<number, Record<string, number>> = {};
    sortedData.forEach((item) => {
      dataByDate[item.day] = omit(item, ['day', 'dayString']);
    });

    const availableDates = sortedData.map(({ day, dayString }) => ({
      day,
      dayString,
    }));

    return {
      graphData: sortedData,
      dataByDate,
      availableDates,
    };
  }, [chartData?.results]);

  const { selectedDateData, sortedEntityList, totalDatAssets } = useMemo(() => {
    if (!selectedDate) {
      return { selectedDateData: {}, sortedEntityList: [], totalDatAssets: 0 };
    }

    const rawData = dataByDate[selectedDate] ?? {};

    // Sort data by count (high to low) and create sorted structures
    const sortedEntries = orderBy(
      Object.entries(rawData),
      ([, value]) => value,
      'desc'
    );
    const sortedData = Object.fromEntries(sortedEntries);
    const entityList = Object.keys(sortedData);
    const total = reduce(sortedData, (acc, value) => acc + value, 0);

    return {
      selectedDateData: sortedData,
      sortedEntityList: entityList,
      totalDatAssets: total,
    };
  }, [selectedDate, dataByDate]);

  // Same order and colours as the legend beside the chart.
  const pieData = useMemo(
    () =>
      sortedEntityList.map((entity, index) => ({
        name: startCase(entity),
        value: selectedDateData[entity] ?? 0,
        color: pieChartColors[index % pieChartColors.length],
      })),
    [sortedEntityList, selectedDateData, pieChartColors]
  );

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const daysMap: Record<string, number> = {
        [DATA_ASSETS_SORT_BY_KEYS.LAST_7_DAYS]: 7,
        [DATA_ASSETS_SORT_BY_KEYS.LAST_14_DAYS]: 14,
      };

      const days = daysMap[selectedSortBy] ?? 7;

      const filter = {
        start: getEpochMillisForPastDays(days),
        end: getCurrentMillis(),
      };

      const response = await getChartPreviewByName(
        SystemChartType.TotalDataAssets,
        filter
      );

      setChartData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const emptyState = useMemo(() => {
    return (
      <WidgetEmptyState
        actionButtonLink={ROUTES.EXPLORE}
        actionButtonText={t('label.explore-assets')}
        description={t('message.no-data-for-total-assets')}
        icon={
          <TotalDataAssetsEmptyIcon height={SIZE.MEDIUM} width={SIZE.MEDIUM} />
        }
        title={t('label.no-data-assets-to-display')}
      />
    );
  }, [t]);

  const totalDataAssetsContent = useMemo(() => {
    return (
      <Box
        className="total-data-assets-widget-content tw:my-auto"
        direction="col"
        gap={isFullSizeWidget ? 1 : 4}>
        <Box gap={6}>
          {/* Donut Chart */}
          <div className="donut-chart-wrapper tw:relative tw:flex-1 tw:shrink-0">
            <PieChart
              ariaLabel={t('label.data-insight-total-entity-summary')}
              centerLabel={
                <Typography
                  className="tw:text-secondary"
                  size="display-xs"
                  weight="semibold">
                  {totalDatAssets.toLocaleString()}
                </Typography>
              }
              data={pieData}
              height={250}
              innerRadius="64%"
              legend={LEGEND_HIDDEN}
              outerRadius="94%"
              padAngle={1}
            />
          </div>

          {/* Right-side Legend */}
          {isFullSizeWidget && (
            <Box
              className="legend-list tw:max-h-75 tw:flex-1 tw:p-4"
              data-testid="assets-legend"
              direction="col"
              gap={3}
              wrap="wrap">
              {sortedEntityList.map((label, index) => (
                <Box
                  align="center"
                  className="tw:w-[calc(50%-6px)] tw:flex-none tw:text-sm"
                  data-testid={`legend-item-${label}`}
                  gap={3}
                  key={label}>
                  <span
                    className="tw:size-3 tw:shrink-0 tw:rounded-full"
                    data-testid={`legend-color-${label}`}
                    style={{
                      backgroundColor:
                        pieChartColors[index % pieChartColors.length],
                    }}
                  />
                  <Typography ellipsis={{ tooltip: true }}>
                    {startCase(label)}
                  </Typography>
                  <span
                    className="data-value tw:rounded-2xl tw:bg-utility-gray-blue-50 tw:px-2 tw:py-1 tw:text-xs tw:font-medium tw:text-secondary"
                    data-testid={`legend-count-${label}`}>
                    {selectedDateData[label] ?? 0}
                  </span>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Date Selector */}
        <Box
          className="date-selector-container tw:mt-2 tw:min-w-0 tw:px-3"
          gap={2}
          justify="center"
          wrap="wrap">
          {availableDates.map(({ day, dayString }) => (
            <div
              aria-label={dayString}
              className={classNames(
                'date-box tw:max-w-15 tw:min-w-10 tw:flex-1 tw:cursor-pointer tw:rounded-xl tw:border tw:px-3 tw:py-2 tw:text-center',
                selectedDate === day
                  ? 'selected tw:border-utility-brand-600 tw:bg-utility-brand-100'
                  : 'tw:border-subtle tw:bg-utility-gray-blue-50'
              )}
              key={day}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedDate(day)}
              onKeyDown={handleKeyboardActivation(() => setSelectedDate(day))}>
              <div className="day tw:text-sm tw:font-semibold tw:text-primary">
                {dayString.split(' ')[0]}
              </div>
              <div className="month tw:text-xs tw:text-quaternary">
                {dayString.split(' ')[1]}
              </div>
            </div>
          ))}
        </Box>
      </Box>
    );
  }, [
    t,
    availableDates,
    pieData,
    selectedDate,
    selectedDateData,
    totalDatAssets,
    sortedEntityList,
    isFullSizeWidget,
    pieChartColors,
  ]);

  useEffect(() => {
    fetchData();
  }, [selectedSortBy]);

  useEffect(() => {
    if (!selectedDate && graphData.length > 0) {
      setSelectedDate(graphData[graphData.length - 1].day); // select last available date
    }
  }, [graphData]);

  const translatedSortOptions = useMemo(
    () =>
      DATA_ASSETS_SORT_BY_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
      })),
    [t]
  );

  const widgetHeader = useMemo(
    () => (
      <WidgetHeader
        className="items-center"
        currentLayout={currentLayout}
        handleLayoutUpdate={handleLayoutUpdate}
        handleRemoveWidget={handleRemoveWidget}
        icon={<TotalAssetsWidgetIcon height={24} width={24} />}
        isEditView={isEditView}
        selectedSortBy={selectedSortBy}
        sortOptions={translatedSortOptions}
        title={t('label.data-insight-total-entity-summary')}
        widgetKey={widgetKey}
        onSortChange={(key) => setSelectedSortBy(key)}
        onTitleClick={() => navigate(getDataInsightPathWithFqn())}
      />
    ),
    [
      currentLayout,
      handleLayoutUpdate,
      handleRemoveWidget,
      isEditView,
      selectedSortBy,
      t,
      widgetKey,
      widgetData?.w,
      setSelectedSortBy,
      translatedSortOptions,
    ]
  );

  return (
    <WidgetWrapper
      dataLength={graphData.length > 0 ? graphData.length : 10}
      dataTestId="KnowledgePanel.TotalAssets"
      header={widgetHeader}
      loading={isLoading}>
      <Box
        className="total-data-assets-widget-container tw:h-full"
        direction="col">
        <Box
          className="widget-content tw:h-full tw:min-h-0 tw:flex-1 tw:overflow-hidden"
          direction="col">
          {isEmpty(graphData) ? emptyState : totalDataAssetsContent}
        </Box>
      </Box>
    </WidgetWrapper>
  );
};

export default TotalDataAssetsWidget;
