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
import { Button, Col, Form, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import QueryString from 'qs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { TableProfilerTab } from '../../components/Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import SingleColumnProfile from '../../components/Database/Profiler/TableProfiler/SingleColumnProfile';
import TableProfilerChart from '../../components/Database/Profiler/TableProfiler/TableProfilerChart/TableProfilerChart';
import RightPanel from '../../components/DataQuality/AddDataQualityTest/components/RightPanel';
import CustomMetricForm from '../../components/DataQuality/CustomMetricForm/CustomMetricForm.component';
import { DEFAULT_RANGE_DATA } from '../../constants/profiler.constant';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../enums/entity.enum';
import { ProfilerDashboardType } from '../../enums/table.enum';
import { CustomMetric, Table } from '../../generated/entity/data/table';
import { withPageLayout } from '../../hoc/withPageLayout';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../hooks/useFqn';
import { putCustomMetric } from '../../rest/customMetricAPI';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { getNameFromFQN } from '../../utils/CommonUtils';
import { getEntityBreadcrumbs, getEntityName } from '../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

const AddCustomMetricPage = () => {
  const { dashboardType } =
    useRequiredParams<{ dashboardType: ProfilerDashboardType }>();
  const { fqn } = useFqn();
  const { t } = useTranslation();

  const navigate = useNavigate();
  const location = useCustomLocation();
  const isColumnMetric = dashboardType === ProfilerDashboardType.COLUMN;
  const [form] = Form.useForm<CustomMetric>();
  const [table, setTable] = useState<Table>();
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const columnName = Form.useWatch('columnName', form);
  const entityFqn = useMemo(() => table?.fullyQualifiedName ?? '', [table]);

  const breadcrumb = useMemo(() => {
    const data: TitleBreadcrumbProps['titleLinks'] = table
      ? [
          ...getEntityBreadcrumbs(table, EntityType.TABLE),
          {
            name: getEntityName(table),
            url: getEntityDetailsPath(
              EntityType.TABLE,
              entityFqn,
              EntityTabs.PROFILER
            ),
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

  const { activeColumnFqn } = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeColumnFqn: string };
  }, [location.search]);

  const initialValues = useMemo(
    () =>
      activeColumnFqn
        ? ({ columnName: getNameFromFQN(activeColumnFqn) } as CustomMetric)
        : undefined,
    [activeColumnFqn]
  );

  const handleBackClick = () => {
    navigate({
      pathname: getEntityDetailsPath(
        EntityType.TABLE,
        entityFqn,
        EntityTabs.PROFILER
      ),
      search: QueryString.stringify({
        activeTab: isColumnMetric
          ? TableProfilerTab.COLUMN_PROFILE
          : TableProfilerTab.TABLE_PROFILE,
        activeColumnFqn,
      }),
    });
  };

  const handleFormSubmit = async (values: CustomMetric) => {
    if (table) {
      setIsActionLoading(true);
      try {
        await putCustomMetric(table.id, values);
        showSuccessToast(
          t('server.create-entity-success', {
            entity: values.name,
          })
        );
        handleBackClick();
      } catch (error) {
        showErrorToast(error as AxiosError);
        setIsActionLoading(false);
      }
    }
  };

  const fetchTableData = async () => {
    setIsLoading(true);
    try {
      const table = await getTableDetailsByFQN(fqn, {
        fields: [
          TabSpecificField.TESTSUITE,
          TabSpecificField.CUSTOM_METRICS,
          TabSpecificField.COLUMNS,
        ],
      });
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

  useEffect(() => {
    const selectedColumn = table?.columns.find(
      (column) => column.name === columnName
    );
    if (selectedColumn) {
      navigate({
        search: QueryString.stringify({
          activeColumnFqn: selectedColumn?.fullyQualifiedName,
        }),
      });
    }
  }, [columnName]);

  const secondPanel = (
    <>
      <RightPanel
        data={{
          title: t('label.add-entity-metric', {
            entity: isColumnMetric ? t('label.column') : t('label.table'),
          }),
          body: '',
        }}
      />
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
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: (
          <div data-testid="add-custom-metric-page-container">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <TitleBreadcrumb titleLinks={breadcrumb} />
              </Col>
              <Col span={24}>
                <Typography.Title
                  className="m-b-0"
                  data-testid="heading"
                  level={5}>
                  {t('label.add-entity-metric', {
                    entity: isColumnMetric
                      ? t('label.column')
                      : t('label.table'),
                  })}
                </Typography.Title>
              </Col>
              <Col span={24}>
                <CustomMetricForm
                  form={form}
                  initialValues={initialValues}
                  isColumnMetric={isColumnMetric}
                  table={table}
                  onFinish={handleFormSubmit}
                />
                <Space className="w-full justify-end">
                  <Button
                    data-testid="cancel-button"
                    disabled={isActionLoading}
                    onClick={handleBackClick}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    data-testid="submit-button"
                    htmlType="submit"
                    loading={isActionLoading}
                    type="primary"
                    onClick={() => form.submit()}>
                    {t('label.submit')}
                  </Button>
                </Space>
              </Col>
            </Row>
          </div>
        ),
        minWidth: 700,
        flex: 0.5,
      }}
      pageTitle={t('label.add-entity', {
        entity: t('label.custom-metric'),
      })}
      secondPanel={{
        children: secondPanel,
        className: 'content-resizable-panel-container',
        flex: 0.5,
        minWidth: 400,
      }}
    />
  );
};

export default withPageLayout(AddCustomMetricPage);
