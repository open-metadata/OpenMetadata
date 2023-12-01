/*
 *  Copyright 2022 Collate.
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

import { DownOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Row,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEqual } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ReactComponent as SettingIcon } from '../../../assets/svg/ic-settings-primery.svg';
import { DateRangeObject } from '../../../components/ProfilerDashboard/component/TestSummary';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import {
  DEFAULT_RANGE_DATA,
  INITIAL_OPERATION_METRIC_VALUE,
  INITIAL_ROW_METRIC_VALUE,
} from '../../../constants/profiler.constant';
import { ProfilerDashboardType } from '../../../enums/table.enum';
import { TableProfile } from '../../../generated/entity/data/table';
import {
  getSystemProfileList,
  getTableProfilesList,
} from '../../../rest/tableAPI';
import {
  getAddCustomMetricPath,
  getAddDataQualityTableTestPath,
} from '../../../utils/RouterUtils';
import { getDecodedFqn } from '../../../utils/StringsUtils';
import {
  calculateCustomMetrics,
  calculateRowCountMetrics,
  calculateSystemMetrics,
} from '../../../utils/TableProfilerUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import CustomBarChart from '../../Chart/CustomBarChart';
import OperationDateBarChart from '../../Chart/OperationDateBarChart';
import { SummaryCard } from '../../common/SummaryCard/SummaryCard.component';
import DatePickerMenu from '../../DatePickerMenu/DatePickerMenu.component';
import PageHeader from '../../PageHeader/PageHeader.component';
import ProfilerDetailsCard from '../../ProfilerDashboard/component/ProfilerDetailsCard';
import ProfilerLatestValue from '../../ProfilerDashboard/component/ProfilerLatestValue';
import { MetricChartType } from '../../ProfilerDashboard/profilerDashboard.interface';
import TabsLabel from '../../TabsLabel/TabsLabel.component';
import CustomMetricGraphs from '../CustomMetricGraphs/CustomMetricGraphs.component';
import { TableProfilerChartProps } from '../TableProfiler.interface';
import { useTableProfiler } from '../TableProfilerProvider';
import NoProfilerBanner from './NoProfilerBanner.component';

const TableProfilerChart = ({
  entityFqn = '',
  showHeader = true,
  tableDetails,
}: TableProfilerChartProps) => {
  const {
    isProfilerDataLoading: isSummaryLoading,
    permissions,
    isTableDeleted = false,
    overallSummary,
    onSettingButtonClick,
    isProfilingEnabled,
    customMetric: tableCustomMetric,
  } = useTableProfiler();
  const { fqn: datasetFQN } = useParams<{ fqn: string }>();
  const history = useHistory();
  const { t } = useTranslation();
  const customMetrics = useMemo(
    () => tableDetails?.customMetrics ?? tableCustomMetric?.customMetrics ?? [],
    [tableCustomMetric, tableDetails]
  );

  const editDataProfile = permissions?.EditAll || permissions?.EditDataProfile;
  const [dateRangeObject, setDateRangeObject] =
    useState<DateRangeObject>(DEFAULT_RANGE_DATA);
  const [rowCountMetrics, setRowCountMetrics] = useState<MetricChartType>(
    INITIAL_ROW_METRIC_VALUE
  );
  const [operationMetrics, setOperationMetrics] = useState<MetricChartType>(
    INITIAL_OPERATION_METRIC_VALUE
  );
  const [operationDateMetrics, setOperationDateMetrics] =
    useState<MetricChartType>(INITIAL_OPERATION_METRIC_VALUE);
  const [isLoading, setIsLoading] = useState(true);
  const [profileMetrics, setProfileMetrics] = useState<TableProfile[]>([]);

  const addButtonContent = [
    {
      label: <TabsLabel id="test-case" name={t('label.test-case')} />,
      key: '1',
      onClick: () => {
        history.push(
          getAddDataQualityTableTestPath(
            ProfilerDashboardType.TABLE,
            getDecodedFqn(datasetFQN)
          )
        );
      },
    },
    {
      label: <TabsLabel id="matrix" name={t('label.matrix')} />,
      key: '2',
      onClick: () => {
        history.push(
          getAddCustomMetricPath(
            ProfilerDashboardType.TABLE,
            getDecodedFqn(datasetFQN)
          )
        );
      },
    },
  ];

  const tableCustomMetricsProfiling = useMemo(
    () => calculateCustomMetrics(profileMetrics, customMetrics),
    [profileMetrics, customMetrics]
  );

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, dateRangeObject)) {
      setDateRangeObject(value);
    }
  };

  const fetchTableProfiler = async (
    fqn: string,
    dateRangeObj: DateRangeObject
  ) => {
    try {
      const { data } = await getTableProfilesList(fqn, dateRangeObj);
      const rowMetricsData = calculateRowCountMetrics(data, rowCountMetrics);
      setRowCountMetrics(rowMetricsData);
      setProfileMetrics(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const fetchSystemProfiler = async (
    fqn: string,
    dateRangeObj: DateRangeObject
  ) => {
    try {
      const { data } = await getSystemProfileList(fqn, dateRangeObj);
      const { operationMetrics: metricsData, operationDateMetrics } =
        calculateSystemMetrics(data, operationMetrics);

      setOperationDateMetrics(operationDateMetrics);
      setOperationMetrics(metricsData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchProfilerData = async (
    fqn: string,
    dateRangeObj: DateRangeObject
  ) => {
    setIsLoading(true);
    await fetchTableProfiler(fqn, dateRangeObj);
    await fetchSystemProfiler(fqn, dateRangeObj);
    setIsLoading(false);
  };

  useEffect(() => {
    if (datasetFQN || entityFqn) {
      fetchProfilerData(datasetFQN || entityFqn, dateRangeObject);
    } else {
      setIsLoading(false);
    }
  }, [datasetFQN, dateRangeObject]);

  return (
    <Row data-testid="table-profiler-chart-container" gutter={[16, 16]}>
      {showHeader && (
        <>
          <Col span={24}>
            <Row>
              <Col span={10}>
                <PageHeader data={PAGE_HEADERS.TABLE_PROFILE} />
              </Col>
              <Col span={14}>
                <Space align="center" className="w-full justify-end">
                  <DatePickerMenu
                    showSelectedCustomRange
                    handleDateRangeChange={handleDateRangeChange}
                  />

                  {editDataProfile && !isTableDeleted && (
                    <>
                      <Dropdown
                        menu={{
                          items: addButtonContent,
                        }}
                        placement="bottomRight"
                        trigger={['click']}>
                        <Button
                          data-testid="profiler-add-table-test-btn"
                          type="primary">
                          <Space>
                            {t('label.add')}
                            <DownOutlined />
                          </Space>
                        </Button>
                      </Dropdown>
                      <Tooltip
                        placement="topRight"
                        title={t('label.setting-plural')}>
                        <Button
                          className="flex-center"
                          data-testid="profiler-setting-btn"
                          onClick={onSettingButtonClick}>
                          <SettingIcon />
                        </Button>
                      </Tooltip>
                    </>
                  )}
                </Space>
              </Col>
            </Row>
          </Col>
          {!isSummaryLoading && !isProfilingEnabled && (
            <Col span={24}>
              <NoProfilerBanner />
            </Col>
          )}
          <Col span={24}>
            <Row wrap className="justify-between" gutter={[16, 16]}>
              {overallSummary?.map((summary) => (
                <Col key={summary.title}>
                  <SummaryCard
                    className={classNames(summary.className, 'h-full')}
                    isLoading={isSummaryLoading}
                    showProgressBar={false}
                    title={summary.title}
                    total={0}
                    value={summary.value}
                  />
                </Col>
              ))}
            </Row>
          </Col>
        </>
      )}
      <Col data-testid="row-metrics" span={24}>
        <ProfilerDetailsCard
          chartCollection={rowCountMetrics}
          curveType="stepAfter"
          isLoading={isLoading}
          name="rowCount"
          title={t('label.data-volume')}
        />
      </Col>
      <Col span={24}>
        <Card
          className="shadow-none global-border-radius"
          data-testid="operation-date-metrics"
          loading={isLoading}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Typography.Title level={5}>
                {t('label.table-update-plural')}
              </Typography.Title>
            </Col>
            <Col span={4}>
              <ProfilerLatestValue
                stringValue
                information={operationDateMetrics.information}
              />
            </Col>
            <Col span={20}>
              <OperationDateBarChart
                chartCollection={operationDateMetrics}
                name="operationDateMetrics"
              />
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={24}>
        <Card
          className="shadow-none global-border-radius"
          data-testid="operation-metrics"
          loading={isLoading}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Typography.Title level={5}>
                {t('label.volume-change')}
              </Typography.Title>
            </Col>
            <Col span={4}>
              <ProfilerLatestValue information={operationMetrics.information} />
            </Col>
            <Col span={20}>
              <CustomBarChart
                chartCollection={operationMetrics}
                name="operationMetrics"
              />
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={24}>
        <CustomMetricGraphs
          customMetrics={customMetrics}
          customMetricsGraphData={tableCustomMetricsProfiling}
          isLoading={isLoading || isSummaryLoading}
        />
      </Col>
    </Row>
  );
};

export default TableProfilerChart;
