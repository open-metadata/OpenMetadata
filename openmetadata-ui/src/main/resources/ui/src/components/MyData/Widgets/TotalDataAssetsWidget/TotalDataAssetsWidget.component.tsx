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
import classNames from 'classnames';
import { groupBy, isEmpty, omit, reduce, sortBy, startCase } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { ReactComponent as TotalAssetsWidgetIcon } from '../../../../assets/svg/ic-data-assets.svg';
import { ReactComponent as TotalDataAssetsEmptyIcon } from '../../../../assets/svg/no-data-placeholder.svg';
import { DEFAULT_THEME } from '../../../../constants/Appearance.constants';
import { GRAY_600 } from '../../../../constants/Color.constants';
import { ROUTES } from '../../../../constants/constants';
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
  const navigate = useNavigate();
  const { applicationConfig } = useApplicationStore();
  const [isLoading, setIsLoading] = useState<boolean>(true);
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

  const widgetData = useMemo(() => {
    return currentLayout?.find((item) => item.i === widgetKey);
  }, [currentLayout, widgetKey]);

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
        actionButtonText={t('label.browse-assets')}
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
      <div
        className={classNames(
          'total-data-assets-widget-content d-flex flex-column',
          isFullSizeWidget ? 'gap-1' : 'gap-8'
        )}>
        <div className={isFullSizeWidget ? 'd-flex gap-6' : ''}>
          {/* Donut Chart */}
          <div className="flex-1 donut-chart-wrapper">
            <ResponsiveContainer height={250} width="100%">
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
                  innerRadius={80}
                  nameKey="name"
                  outerRadius={117}
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
                    `(${value})`,
                    startCase(name),
                  ]}
                  separator={' '}
                />
                <text
                  dy={8}
                  fill={GRAY_600}
                  fontSize={28}
                  fontWeight={600}
                  textAnchor="middle"
                  x="50%"
                  y="50%">
                  {totalDatAssets.toLocaleString()}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Right-side Legend */}
          {isFullSizeWidget && (
            <div className="flex-1 legend-list p-md">
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
                  <Typography.Text ellipsis={{ tooltip: true }}>
                    {startCase(label)}
                  </Typography.Text>
                  <span className="text-xs font-medium p-y-xss p-x-xs data-value">
                    {selectedDateData[label] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Date Selector */}
        <div className="date-selector-wrapper m-t-xs">
          <div className="date-selector-container">
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
        sortOptions={DATA_ASSETS_SORT_BY_OPTIONS}
        title={t('label.data-insight-total-entity-summary')}
        widgetKey={widgetKey}
        widgetWidth={widgetData?.w}
        onSortChange={(key) => setSelectedSortBy(key)}
        onTitleClick={() => navigate(ROUTES.DATA_INSIGHT)}
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
    ]
  );

  return (
    <WidgetWrapper
      dataLength={graphData.length > 0 ? graphData.length : 10}
      dataTestId="KnowledgePanel.TotalAssets"
      header={widgetHeader}
      loading={isLoading}>
      <div className="total-data-assets-widget-container">
        <div className="widget-content flex-1 h-full">
          {isEmpty(graphData) ? emptyState : totalDataAssetsContent}
        </div>
      </div>
    </WidgetWrapper>
  );
};

export default TotalDataAssetsWidget;
