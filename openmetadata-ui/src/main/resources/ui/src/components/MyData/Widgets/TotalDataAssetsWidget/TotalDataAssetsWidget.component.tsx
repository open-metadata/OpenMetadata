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
import { Typography } from 'antd';
import { AxiosError } from 'axios';
import { groupBy, isEmpty, omit, reduce, sortBy, startCase } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { ReactComponent as TotalAssetsWidgetIcon } from '../../../../assets/svg/ic-total-data-assets.svg';
import { ReactComponent as TotalDataAssetsEmptyIcon } from '../../../../assets/svg/no-data-placeholder.svg';
import { DEFAULT_THEME } from '../../../../constants/Appearance.constants';
import { SIZE } from '../../../../enums/common.enum';
import { SystemChartType } from '../../../../enums/DataInsight.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  DataInsightCustomChartResult,
  getChartPreviewByName,
} from '../../../../rest/DataInsightAPI';
import { generatePalette } from '../../../../styles/colorPallet';
import {
  customFormatDateTime,
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import WidgetEmptyState from '../Common/WidgetEmptyState/WidgetEmptyState';
import WidgetHeader from '../Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import './total-data-assets-widget.less';
import {
  DATA_ASSETS_SORT_BY_KEYS,
  DATA_ASSETS_SORT_BY_OPTIONS,
} from './TotalDataAssetsWidget.constant';
import { TotalDataAssetsWidgetProps } from './TotalDataAssetsWidget.interface';

const TotalDataAssetsWidget = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
  currentLayout,
  handleLayoutUpdate,
}: TotalDataAssetsWidgetProps) => {
  const { t } = useTranslation();
  const { applicationConfig } = useApplicationStore();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chartData, setChartData] = useState<DataInsightCustomChartResult>();
  const [selectedDate, setSelectedDate] = useState<number | undefined>();
  const [selectedSortBy, setSelectedSortBy] = useState<string>(
    DATA_ASSETS_SORT_BY_KEYS.LAST_7_DAYS
  );

  const pieChartColors = useMemo(() => {
    const primaryColor =
      applicationConfig?.customTheme?.primaryColor ??
      DEFAULT_THEME.primaryColor;

    const fullPalette = generatePalette(primaryColor);
    const reversed = fullPalette.slice().reverse();

    const firstTwo = reversed.slice(0, 2);
    const remaining = reversed.slice(2);

    return [...remaining, ...firstTwo];
  }, [applicationConfig?.customTheme?.primaryColor]);

  const isFullSizeWidget = useMemo(() => {
    return currentLayout?.find((item) => item.i === widgetKey)?.w === 2;
  }, [currentLayout, widgetKey]);

  const { graphData, rightSideEntityList, dataByDate, availableDates } =
    useMemo(() => {
      const results = chartData?.results ?? [];

      const groupedByDay = groupBy(results, 'day');
      const labels: string[] = [];

      const graphData = Object.entries(groupedByDay).map(
        ([dayKey, entries]) => {
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
        }
      );

      const sortedData = sortBy(graphData, 'day');
      const uniqueLabels = Array.from(new Set(labels));

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
        rightSideEntityList: uniqueLabels,
        dataByDate,
        availableDates,
      };
    }, [chartData?.results]);

  const selectedDateData = useMemo(() => {
    if (!selectedDate) {
      return {};
    }

    return dataByDate[selectedDate] ?? {};
  }, [selectedDate, dataByDate]);

  const totalDatAssets = useMemo(() => {
    return reduce(selectedDateData, (acc, value) => acc + value, 0);
  }, [selectedDateData]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const daysMap: Record<string, number> = {
        [DATA_ASSETS_SORT_BY_KEYS.LAST_7_DAYS]: 7,
        [DATA_ASSETS_SORT_BY_KEYS.LAST_14_DAYS]: 14,
        [DATA_ASSETS_SORT_BY_KEYS.LAST_30_DAYS]: 30,
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
        actionButtonLink="/data-insights/data-assets"
        actionButtonText="Explore Assets"
        description={t('message.no-data-for-total-assets')}
        icon={
          <TotalDataAssetsEmptyIcon height={SIZE.LARGE} width={SIZE.LARGE} />
        }
        title={t('label.no-data-assets-to-display')}
      />
    );
  }, [t]);

  const totalDataAssetsContent = useMemo(() => {
    return (
      <div className="total-data-assets-widget-content">
        <div className={isFullSizeWidget ? 'd-flex gap-6' : ''}>
          {/* Donut Chart */}
          <div
            className="flex-1 donut-chart-wrapper"
            style={{ position: 'relative' }}>
            <ResponsiveContainer height={300} width="100%">
              <PieChart>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={Object.entries(selectedDateData).map(
                    ([name, value]) => ({
                      name,
                      value,
                    })
                  )}
                  dataKey="value"
                  innerRadius={90}
                  nameKey="name"
                  outerRadius={140}
                  paddingAngle={1}>
                  {rightSideEntityList.map((label, index) => (
                    <Cell
                      fill={pieChartColors[index % pieChartColors.length]}
                      key={label}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    `${value}`,
                    `${name}`,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div
              className="donut-center-value"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {totalDatAssets.toLocaleString()}
              </Typography.Title>
            </div>
          </div>

          {/* Right-side Legend */}
          {isFullSizeWidget && (
            <div className="legend-list p-md">
              {rightSideEntityList.map((label, index) => (
                <div className="d-flex items-center gap-3 text-sm" key={label}>
                  <span
                    className="h-3 w-3"
                    style={{
                      borderRadius: '50%',
                      backgroundColor:
                        pieChartColors[index % pieChartColors.length],
                    }}
                  />
                  <span>{startCase(label)}</span>
                  <span className="text-xs font-medium p-y-xss p-x-xs data-value">
                    {selectedDateData[label] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Date Selector */}
        <div className="date-selector-wrapper m-t-xs overflow-auto-x whitespace-nowrap">
          <div className="d-flex items-center justify-center gap-3 p-x-sm">
            {availableDates.map(({ day, dayString }) => (
              <div
                className={`date-box ${selectedDate === day ? 'selected' : ''}`}
                key={day}
                onClick={() => setSelectedDate(day)}>
                <div className="day font-semibold text-sm">
                  {dayString.split(' ')[0]}
                </div>
                <div className="month text-xs">{dayString.split(' ')[1]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }, [
    availableDates,
    selectedDate,
    selectedDateData,
    totalDatAssets,
    rightSideEntityList,
    isFullSizeWidget,
  ]);

  useEffect(() => {
    fetchData();
  }, [selectedSortBy]);

  useEffect(() => {
    if (!selectedDate && graphData.length > 0) {
      setSelectedDate(graphData[graphData.length - 1].day); // select last available date
    }
  }, [graphData]);

  return (
    <WidgetWrapper dataLength={graphData.length} loading={isLoading}>
      <div className="total-data-assets-widget-container">
        <WidgetHeader
          className="items-center"
          currentLayout={currentLayout}
          handleLayoutUpdate={handleLayoutUpdate}
          handleRemoveWidget={handleRemoveWidget}
          icon={<TotalAssetsWidgetIcon />}
          isEditView={isEditView}
          selectedSortBy={selectedSortBy}
          sortOptions={DATA_ASSETS_SORT_BY_OPTIONS}
          title={t('label.data-insight-total-entity-summary')}
          widgetKey={widgetKey}
          widgetWidth={2}
          onSortChange={(key) => setSelectedSortBy(key)}
        />
        <div className="widget-content flex-1">
          {isEmpty(graphData) ? emptyState : totalDataAssetsContent}
        </div>
      </div>
    </WidgetWrapper>
  );
};

export default TotalDataAssetsWidget;
