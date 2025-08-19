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
import { Button, Col, Row, Space } from 'antd';;
import { Dropdown, Tooltip } from '../../../../common/AntdCompat';;
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEqual, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as SettingIcon } from '../../../../../assets/svg/ic-settings-primery.svg';
import { PAGE_HEADERS } from '../../../../../constants/PageHeaders.constant';
import {
  DEFAULT_RANGE_DATA,
  INITIAL_OPERATION_METRIC_VALUE,
  INITIAL_ROW_METRIC_VALUE,
} from '../../../../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../../enums/common.enum';
import { ProfilerDashboardType } from '../../../../../enums/table.enum';
import { TableProfile } from '../../../../../generated/entity/data/table';
import { Operation } from '../../../../../generated/entity/policies/policy';
import LimitWrapper from '../../../../../hoc/LimitWrapper';
import { useFqn } from '../../../../../hooks/useFqn';
import {
  getSystemProfileList,
  getTableProfilesList,
} from '../../../../../rest/tableAPI';
import { Transi18next } from '../../../../../utils/CommonUtils';
import documentationLinksClassBase from '../../../../../utils/DocumentationLinksClassBase';
import { getPrioritizedEditPermission } from '../../../../../utils/PermissionsUtils';
import { getAddCustomMetricPath } from '../../../../../utils/RouterUtils';
import {
  calculateCustomMetrics,
  calculateRowCountMetrics,
  calculateSystemMetrics,
} from '../../../../../utils/TableProfilerUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import DatePickerMenu from '../../../../common/DatePickerMenu/DatePickerMenu.component';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { SummaryCard } from '../../../../common/SummaryCard/SummaryCard.component';
import TabsLabel from '../../../../common/TabsLabel/TabsLabel.component';
import { TestLevel } from '../../../../DataQuality/AddDataQualityTest/components/TestCaseFormV1.interface';
import PageHeader from '../../../../PageHeader/PageHeader.component';
import CustomBarChart from '../../../../Visualisations/Chart/CustomBarChart';
import OperationDateBarChart from '../../../../Visualisations/Chart/OperationDateBarChart';
import { MetricChartType } from '../../ProfilerDashboard/profilerDashboard.interface';
import ProfilerDetailsCard from '../../ProfilerDetailsCard/ProfilerDetailsCard';
import ProfilerStateWrapper from '../../ProfilerStateWrapper/ProfilerStateWrapper.component';
import CustomMetricGraphs from '../CustomMetricGraphs/CustomMetricGraphs.component';
import NoProfilerBanner from '../NoProfilerBanner/NoProfilerBanner.component';
import { TableProfilerChartProps } from '../TableProfiler.interface';
import { useTableProfiler } from '../TableProfilerProvider';

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
    dateRangeObject = DEFAULT_RANGE_DATA,
    onDateRangeChange,
    onTestCaseDrawerOpen,
  } = useTableProfiler();

  const { fqn: datasetFQN } = useFqn();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const customMetrics = useMemo(
    () => tableDetails?.customMetrics ?? tableCustomMetric?.customMetrics ?? [],
    [tableCustomMetric, tableDetails]
  );

  const editDataProfile =
    permissions &&
    getPrioritizedEditPermission(permissions, Operation.EditDataProfile);
  const [rowCountMetrics, setRowCountMetrics] = useState<MetricChartType>(
    INITIAL_ROW_METRIC_VALUE
  );
  const [operationMetrics, setOperationMetrics] = useState<MetricChartType>(
    INITIAL_OPERATION_METRIC_VALUE
  );
  const [operationDateMetrics, setOperationDateMetrics] =
    useState<MetricChartType>(INITIAL_OPERATION_METRIC_VALUE);
  const [isTableProfilerLoading, setIsTableProfilerLoading] = useState(true);
  const [isSystemProfilerLoading, setIsSystemProfilerLoading] = useState(true);
  const [showSystemMetrics, setshowSystemMetrics] = useState(false);
  const [profileMetrics, setProfileMetrics] = useState<TableProfile[]>([]);
  const profilerDocsLink =
    documentationLinksClassBase.getDocsURLS()
      .DATA_QUALITY_PROFILER_WORKFLOW_DOCS;

  const addButtonContent = [
    {
      label: <TabsLabel id="test-case" name={t('label.test-case')} />,
      key: 'test-case',
      onClick: () => {
        onTestCaseDrawerOpen(TestLevel.TABLE);
      },
    },
    {
      label: <TabsLabel id="custom-metric" name={t('label.custom-metric')} />,
      key: 'custom-metric',
      onClick: () => {
        navigate(
          getAddCustomMetricPath(ProfilerDashboardType.TABLE, datasetFQN)
        );
      },
    },
  ];

  const noProfilerMessage = useMemo(() => {
    return isProfilingEnabled ? (
      t('message.profiler-is-enabled-but-no-data-available')
    ) : (
      <Transi18next
        i18nKey="message.no-profiler-card-message-with-link"
        renderElement={
          <a
            href={profilerDocsLink}
            rel="noreferrer"
            target="_blank"
            title="Profiler Documentation"
          />
        }
      />
    );
  }, [isProfilingEnabled]);

  const tableCustomMetricsProfiling = useMemo(
    () => calculateCustomMetrics(profileMetrics, customMetrics),
    [profileMetrics, customMetrics]
  );

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, dateRangeObject)) {
      onDateRangeChange(value);
    }
  };

  const fetchTableProfiler = useCallback(
    async (fqn: string, dateRangeObj: DateRangeObject) => {
      setIsTableProfilerLoading(true);
      try {
        const { data } = await getTableProfilesList(fqn, dateRangeObj);
        const rowMetricsData = calculateRowCountMetrics(data, rowCountMetrics);
        setRowCountMetrics(rowMetricsData);
        setProfileMetrics(data);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsTableProfilerLoading(false);
      }
    },
    [rowCountMetrics, profileMetrics]
  );
  const fetchSystemProfiler = useCallback(
    async (fqn: string, dateRangeObj: DateRangeObject) => {
      setIsSystemProfilerLoading(true);
      try {
        const { data } = await getSystemProfileList(fqn, dateRangeObj);
        if (data.length > 0) {
          setshowSystemMetrics(true);
          const { operationMetrics: metricsData, operationDateMetrics } =
            calculateSystemMetrics(data, operationMetrics);

          setOperationDateMetrics(operationDateMetrics);
          setOperationMetrics(metricsData);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSystemProfilerLoading(false);
      }
    },
    [operationMetrics, operationDateMetrics]
  );

  const fetchProfilerData = useCallback(
    (fqn: string, dateRangeObj: DateRangeObject) => {
      const dateRange = pick(dateRangeObj, ['startTs', 'endTs']);
      fetchTableProfiler(fqn, dateRange);
      fetchSystemProfiler(fqn, dateRange);
    },
    [fetchSystemProfiler, fetchTableProfiler]
  );

  useEffect(() => {
    if (datasetFQN || entityFqn) {
      fetchProfilerData(datasetFQN || entityFqn, dateRangeObject);
    } else {
      setIsTableProfilerLoading(false);
      setIsSystemProfilerLoading(false);
    }
  }, [datasetFQN, dateRangeObject, entityFqn]);

  const operationDateMetricsCard = useMemo(() => {
    return (
      <ProfilerStateWrapper
        dataTestId="operation-date-metrics"
        isLoading={isSystemProfilerLoading}
        profilerLatestValueProps={{
          information: operationDateMetrics.information,
          stringValue: true,
        }}
        title={t('label.table-update-plural')}>
        <OperationDateBarChart
          chartCollection={operationDateMetrics}
          name="operationDateMetrics"
          noDataPlaceholderText={noProfilerMessage}
        />
      </ProfilerStateWrapper>
    );
  }, [isSystemProfilerLoading, operationDateMetrics, noProfilerMessage]);

  const operationMetricsCard = useMemo(() => {
    return (
      <ProfilerStateWrapper
        dataTestId="operation-metrics"
        isLoading={isSystemProfilerLoading}
        profilerLatestValueProps={{
          information: operationMetrics.information,
        }}
        title={t('label.volume-change')}>
        <CustomBarChart
          chartCollection={operationMetrics}
          name="operationMetrics"
          noDataPlaceholderText={noProfilerMessage}
        />
      </ProfilerStateWrapper>
    );
  }, [isSystemProfilerLoading, operationMetrics, noProfilerMessage]);

  if (permissions && !permissions?.ViewDataProfile) {
    return (
      <ErrorPlaceHolder
        permissionValue={t('label.view-entity', {
          entity: t('label.data-observability'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

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
                    defaultDateRange={dateRangeObject}
                    handleDateRangeChange={handleDateRangeChange}
                  />

                  {editDataProfile && !isTableDeleted && (
                    <>
                      <LimitWrapper resource="dataQuality">
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
                      </LimitWrapper>
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
          isLoading={isTableProfilerLoading}
          name="rowCount"
          noDataPlaceholderText={noProfilerMessage}
          title={t('label.data-volume')}
        />
      </Col>
      {showSystemMetrics && (
        <>
          <Col span={24}>{operationDateMetricsCard}</Col>
          <Col span={24}>{operationMetricsCard}</Col>
        </>
      )}
      <Col span={24}>
        <CustomMetricGraphs
          customMetrics={customMetrics}
          customMetricsGraphData={tableCustomMetricsProfiling}
          isLoading={isTableProfilerLoading || isSummaryLoading}
        />
      </Col>
    </Row>
  );
};

export default TableProfilerChart;
