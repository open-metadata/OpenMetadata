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
import { CloseOutlined, DragOutlined } from '@ant-design/icons';
import { Card, Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import {
  first,
  groupBy,
  isEmpty,
  isUndefined,
  last,
  omit,
  reduce,
  sortBy,
} from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ReactComponent as TotalDataAssetsEmptyIcon } from '../../../../assets/svg/data-insight-no-data-placeholder.svg';
import { CHART_WIDGET_DAYS_DURATION } from '../../../../constants/constants';
import { SIZE } from '../../../../enums/common.enum';
import { WidgetWidths } from '../../../../enums/CustomizablePage.enum';
import { SystemChartType } from '../../../../enums/DataInsight.enum';
import {
  DataInsightCustomChartResult,
  getChartPreviewByName,
} from '../../../../rest/DataInsightAPI';
import { entityChartColor } from '../../../../utils/CommonUtils';
import {
  CustomTooltip,
  getRandomHexColor,
} from '../../../../utils/DataInsightUtils';
import {
  customFormatDateTime,
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { EmptyGraphPlaceholder } from '../../../DataInsight/EmptyGraphPlaceholder';
import TotalEntityInsightSummary from '../../../DataInsight/TotalEntityInsightSummary.component';
import './total-data-assets-widget.less';
import { TotalDataAssetsWidgetProps } from './TotalDataAssetsWidget.interface';

const TotalDataAssetsWidget = ({
  isEditView = false,
  selectedDays = CHART_WIDGET_DAYS_DURATION,
  handleRemoveWidget,
  widgetKey,
  selectedGridSize,
}: TotalDataAssetsWidgetProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chartData, setChartData] = useState<DataInsightCustomChartResult>();

  const { rightSideEntityList, latestData, graphData, changeInValue, total } =
    useMemo(() => {
      const results = chartData?.results ?? [];
      const timeStampResults = groupBy(results, 'day');
      const labels: string[] = [];

      const graphData = Object.entries(timeStampResults).map(([key, value]) => {
        const keys = value.reduce((acc, curr) => {
          curr.group && labels.push(curr.group);

          return { ...acc, [curr.group ?? 'count']: curr.count };
        }, {});

        return {
          day: +key,
          dayString: customFormatDateTime(+key, 'MMM dd'),
          ...keys,
        };
      });

      const finalData = sortBy(graphData, 'day');
      const uniqueLabels = Array.from(new Set(labels));

      const latestData: Record<string, number> = omit(last(finalData ?? {}), [
        'day',
        'dayString',
      ]);

      const total = reduce(latestData, (acc, value) => acc + value, 0);

      const firstRecordTotal = reduce(
        omit(first(finalData) ?? {}, ['day', 'dayString']),
        (acc, value) => acc + value,
        0
      );

      const changeInValue = firstRecordTotal
        ? (total - firstRecordTotal) / firstRecordTotal
        : 0;

      return {
        rightSideEntityList: uniqueLabels,
        latestData,
        graphData: finalData,
        changeInValue,
        total,
      };
    }, [chartData?.results]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const filter = {
        start: getEpochMillisForPastDays(selectedDays),
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

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  const isWidgetSizeLarge = useMemo(
    () => selectedGridSize === WidgetWidths.large,
    [selectedGridSize]
  );

  useEffect(() => {
    fetchData();
  }, [selectedDays]);

  return (
    <Card
      className="total-data-insight-card data-insight-card-chart"
      data-testid="total-assets-widget"
      id={SystemChartType.TotalDataAssets}
      loading={isLoading}>
      {isEditView && (
        <Row gutter={8} justify="end">
          <Col>
            <DragOutlined
              className="drag-widget-icon cursor-pointer"
              data-testid="drag-widget-button"
              size={14}
            />
          </Col>
          <Col>
            <CloseOutlined
              data-testid="remove-widget-button"
              size={14}
              onClick={handleCloseClick}
            />
          </Col>
        </Row>
      )}
      {isEmpty(graphData) ? (
        <Row className="h-full">
          <Col span={14}>
            <Typography.Text className="font-medium">
              {t('label.data-insight-total-entity-summary')}
            </Typography.Text>
          </Col>
          <Col className="h-95" span={24}>
            <EmptyGraphPlaceholder
              icon={
                <TotalDataAssetsEmptyIcon
                  height={SIZE.X_SMALL}
                  width={SIZE.X_SMALL}
                />
              }
            />
          </Col>
        </Row>
      ) : (
        <Row className="h-95">
          <Col span={isWidgetSizeLarge ? 14 : 24}>
            <Typography.Text className="font-medium">
              {t('label.data-insight-total-entity-summary')}
            </Typography.Text>
            <div className="p-t-md">
              <ResponsiveContainer height={250} width="100%">
                <AreaChart
                  data={graphData}
                  margin={{
                    top: 10,
                    right: 30,
                    left: 0,
                    bottom: 0,
                  }}
                  syncId="anyId">
                  <XAxis
                    allowDuplicatedCategory={false}
                    dataKey="day"
                    tickFormatter={(value: number) =>
                      customFormatDateTime(value, 'MMM dd')
                    }
                  />
                  <YAxis />
                  <CartesianGrid strokeDasharray="3 3" />
                  <Tooltip
                    content={<CustomTooltip timeStampKey="day" />}
                    wrapperStyle={{ pointerEvents: 'auto' }}
                  />
                  {rightSideEntityList.map((label, i) => (
                    <Area
                      dataKey={label}
                      fill={entityChartColor(i) ?? getRandomHexColor()}
                      key={label}
                      name={label}
                      stroke={entityChartColor(i) ?? getRandomHexColor()}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Col>
          {isWidgetSizeLarge && (
            <Col className="total-entity-insight-summary-container" span={10}>
              <TotalEntityInsightSummary
                entities={rightSideEntityList}
                latestData={latestData}
                relativePercentage={changeInValue}
                selectedDays={selectedDays}
                total={total}
              />
            </Col>
          )}
        </Row>
      )}
    </Card>
  );
};

export default TotalDataAssetsWidget;
