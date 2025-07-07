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

import { Card, Col, Row } from 'antd';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ResizableLeftPanels from '../../components/common/ResizablePanels/ResizableLeftPanels';
import { ENTITIES_CHARTS } from '../../constants/DataInsight.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { SystemChartType } from '../../enums/DataInsight.enum';
import { DataInsightChartType } from '../../generated/dataInsight/dataInsightChartResult';
import { Operation } from '../../generated/entity/policies/policy';
import { withPageLayout } from '../../hoc/withPageLayout';
import { DataInsightTabs } from '../../interface/data-insight.interface';
import { getDataInsightPathWithFqn } from '../../utils/DataInsightUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import './data-insight.less';
import { default as dataInsightClassBase } from './DataInsightClassBase';
import DataInsightHeader from './DataInsightHeader/DataInsightHeader.component';
import DataInsightProvider from './DataInsightProvider';

const DataInsightPage = () => {
  const { tab } = useRequiredParams<{ tab: DataInsightTabs }>();
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const navigate = useNavigate();
  const LeftPanel = dataInsightClassBase.getLeftPanel();
  const isHeaderVisible = useMemo(
    () =>
      [
        DataInsightTabs.DATA_ASSETS,
        DataInsightTabs.KPIS,
        DataInsightTabs.APP_ANALYTICS,
        'dashboard',
      ].includes(tab),
    [tab]
  );

  const viewDataInsightChartPermission = useMemo(
    () =>
      checkPermission(
        Operation.ViewAll,
        ResourceEntity.DATA_INSIGHT_CHART,
        permissions
      ),
    [permissions]
  );

  const viewKPIPermission = useMemo(
    () => checkPermission(Operation.ViewAll, ResourceEntity.KPI, permissions),
    [permissions]
  );

  const [selectedChart, setSelectedChart] = useState<
    SystemChartType | DataInsightChartType
  >();

  const handleScrollToChart = useCallback(
    (chartType: SystemChartType | DataInsightChartType) => {
      if (ENTITIES_CHARTS.includes(chartType as SystemChartType)) {
        navigate(getDataInsightPathWithFqn(DataInsightTabs.DATA_ASSETS));
      } else {
        navigate(getDataInsightPathWithFqn(DataInsightTabs.APP_ANALYTICS));
      }
      setSelectedChart(chartType);
    },
    [navigate]
  );

  useLayoutEffect(() => {
    if (selectedChart) {
      const element = document.getElementById(selectedChart);
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setSelectedChart(undefined);
      }
    }
  }, [selectedChart]);

  const { noDataInsightPermission, noKPIPermission } = useMemo(() => {
    const data = {
      noDataInsightPermission:
        !viewDataInsightChartPermission &&
        (tab === DataInsightTabs.APP_ANALYTICS ||
          tab === DataInsightTabs.DATA_ASSETS),
      noKPIPermission: !viewKPIPermission && tab === DataInsightTabs.KPIS,
    };

    return data;
  }, [viewDataInsightChartPermission, viewKPIPermission, tab]);

  const renderTabComponent = useMemo(() => {
    const currentTabComponent =
      dataInsightClassBase.getDataInsightTabComponent(tab);

    if (!currentTabComponent) {
      return <Navigate replace to={DataInsightTabs.DATA_ASSETS} />;
    }

    const TabComponent = currentTabComponent;

    return <TabComponent />;
  }, [tab]);

  if (!viewDataInsightChartPermission && !viewKPIPermission) {
    return (
      <ErrorPlaceHolder
        className="border-none h-min-80"
        permissionValue={t('label.view-entity', {
          entity: t('label.data-insight'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (noDataInsightPermission || noKPIPermission) {
    return (
      <Row align="middle" className="w-full h-full" justify="center">
        <Col span={24}>
          <ErrorPlaceHolder
            className="border-none"
            permissionValue={t('label.view-entity', {
              entity: t('label.data-insight'),
            })}
            type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
          />
        </Col>
      </Row>
    );
  }

  return (
    <ResizableLeftPanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        minWidth: 280,
        flex: 0.13,
        children: <LeftPanel />,
      }}
      pageTitle={t('label.data-insight')}
      secondPanel={{
        children: (
          <DataInsightProvider>
            <Card className="h-full overflow-y-auto">
              <Row data-testid="data-insight-container" gutter={[16, 16]}>
                {isHeaderVisible && (
                  <Col span={24}>
                    <DataInsightHeader onScrollToChart={handleScrollToChart} />
                  </Col>
                )}
                <Col span={24}>{renderTabComponent}</Col>
              </Row>
            </Card>
          </DataInsightProvider>
        ),
        className: 'content-resizable-panel-container',
        minWidth: 800,
        flex: 0.87,
      }}
    />
  );
};

export default withPageLayout(DataInsightPage);
