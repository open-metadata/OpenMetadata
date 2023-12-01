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
import { Button, Form, Space } from 'antd';
import { AxiosError } from 'axios';
import { noop } from 'lodash';
import QueryString from 'qs';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import RightPanel from '../../components/AddDataQualityTest/components/RightPanel';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import CustomMetricForm from '../../components/CustomMetricForm/CustomMetricForm.component';
import Loader from '../../components/Loader/Loader';
import SingleColumnProfile from '../../components/TableProfiler/Component/SingleColumnProfile';
import TableProfilerChart from '../../components/TableProfiler/Component/TableProfilerChart';
import { getTableTabPath } from '../../constants/constants';
import { DEFAULT_RANGE_DATA } from '../../constants/profiler.constant';
import { EntityType } from '../../enums/entity.enum';
import { ProfilerDashboardType } from '../../enums/table.enum';
import { CustomMetric, Table } from '../../generated/entity/data/table';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { getEntityBreadcrumbs, getEntityName } from '../../utils/EntityUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const AddCustomMetricPage = () => {
  const { fqn, dashboardType } =
    useParams<{ fqn: string; dashboardType: ProfilerDashboardType }>();
  const isColumnMetric = dashboardType === ProfilerDashboardType.COLUMN;
  const { t } = useTranslation();
  const [form] = Form.useForm<CustomMetric>();
  const [table, setTable] = useState<Table>();
  const [isLoading, setIsLoading] = useState(true);

  const breadcrumb = useMemo(() => {
    const data: TitleBreadcrumbProps['titleLinks'] = table
      ? [
          ...getEntityBreadcrumbs(table, EntityType.TABLE),
          {
            name: getEntityName(table),
            url: getTableTabPath(table.fullyQualifiedName ?? '', 'profiler'),
          },
          {
            name: t('label.add-entity-metric', {
              entity: isColumnMetric ? t('label.column') : t('label.table'),
            }),
            url: '',
            activeTitle: true,
          },
        ]
      : [];

    return data;
  }, [table, isColumnMetric]);

  const fetchTableData = async () => {
    setIsLoading(true);
    try {
      const table = await getTableDetailsByFQN(
        fqn,
        'testSuite,customMetrics,columns'
      );
      setTable(table);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTableData();
  }, [fqn]);

  const { activeColumnFqn } = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeColumnFqn: string };
  }, [location.search]);

  const secondPanel = (
    <>
      <RightPanel data={{ title: '', body: '' }} />
      {isColumnMetric ? (
        <SingleColumnProfile
          activeColumnFqn={activeColumnFqn}
          dateRangeObject={DEFAULT_RANGE_DATA}
          tableDetails={table}
        />
      ) : (
        <TableProfilerChart
          entityFqn={fqn}
          showHeader={false}
          tableDetails={table}
        />
      )}
    </>
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      firstPanel={{
        children: (
          <div className="max-width-md w-9/10 service-form-container">
            <TitleBreadcrumb titleLinks={breadcrumb} />
            <div className="m-t-md">
              <CustomMetricForm
                columnOptions={table?.columns}
                form={form}
                isColumnMetric={isColumnMetric}
                onFinish={noop}
              />
              <Form form={form}>
                <Form.Item>
                  <Space className="w-full justify-end">
                    <Button>{t('label.cancel')}</Button>
                    <Button htmlType="submit" type="primary">
                      {t('label.submit')}
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </div>
          </div>
        ),
        minWidth: 700,
        flex: 0.5,
      }}
      pageTitle={t('label.add-entity', {
        entity: t('label.data-quality-test'),
      })}
      secondPanel={{
        children: secondPanel,
        className: 'p-md service-doc-panel',
        minWidth: 60,
        flex: 0.5,
        overlay: {
          displayThreshold: 200,
          header: t('label.data-profiler-metrics'),
          rotation: 'counter-clockwise',
        },
      }}
    />
  );
};

export default AddCustomMetricPage;
