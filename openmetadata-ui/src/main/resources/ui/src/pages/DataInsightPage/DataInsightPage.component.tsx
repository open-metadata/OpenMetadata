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

import { Col, Row } from 'antd';
import { t } from 'i18next';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
  Redirect,
  Route,
  Switch,
  useHistory,
  useParams,
} from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../components/PermissionProvider/PermissionProvider.interface';
import { ROUTES } from '../../constants/constants';
import { ENTITIES_CHARTS } from '../../constants/DataInsight.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { DataInsightChartType } from '../../generated/dataInsight/dataInsightChartResult';
import { Operation } from '../../generated/entity/policies/policy';
import { DataInsightTabs } from '../../interface/data-insight.interface';
import { getDataInsightPathWithFqn } from '../../utils/DataInsightUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import './data-insight.less';
import DataInsightClassBase from './DataInsightClassBase';
import DataInsightHeader from './DataInsightHeader/DataInsightHeader.component';
import DataInsightLeftPanel from './DataInsightLeftPanel/DataInsightLeftPanel';
import DataInsightProvider from './DataInsightProvider';

const DataInsightPage = () => {
  const { tab } = useParams<{ tab: DataInsightTabs }>();

  const { permissions } = usePermissionProvider();
  const history = useHistory();
  const isHeaderVisible = useMemo(
    () =>
      [
        DataInsightTabs.DATA_ASSETS,
        DataInsightTabs.KPIS,
        DataInsightTabs.APP_ANALYTICS,
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

  const [selectedChart, setSelectedChart] = useState<DataInsightChartType>();

  const handleScrollToChart = (chartType: DataInsightChartType) => {
    if (ENTITIES_CHARTS.includes(chartType)) {
      history.push(getDataInsightPathWithFqn(DataInsightTabs.DATA_ASSETS));
    } else {
      history.push(getDataInsightPathWithFqn(DataInsightTabs.APP_ANALYTICS));
    }
    setSelectedChart(chartType);
  };

  useLayoutEffect(() => {
    if (selectedChart) {
      const element = document.getElementById(selectedChart);
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setSelectedChart(undefined);
      }
    }
  }, [selectedChart]);

  const { noDataInsightPermission, noKPIPermission, dataInsightTabs } =
    useMemo(() => {
      const data = {
        noDataInsightPermission:
          !viewDataInsightChartPermission &&
          (tab === DataInsightTabs.APP_ANALYTICS ||
            tab === DataInsightTabs.DATA_ASSETS),
        noKPIPermission: !viewKPIPermission && tab === DataInsightTabs.KPIS,
        dataInsightTabs: DataInsightClassBase.getDataInsightTab(),
      };

      return data;
    }, [viewDataInsightChartPermission, viewKPIPermission, tab]);

  if (!viewDataInsightChartPermission && !viewKPIPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  if (noDataInsightPermission || noKPIPermission) {
    return (
      <Row align="middle" className="w-full h-full" justify="center">
        <Col span={24}>
          <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
        </Col>
      </Row>
    );
  }

  return (
    <PageLayoutV1
      leftPanel={<DataInsightLeftPanel />}
      pageTitle={t('label.data-insight')}>
      <DataInsightProvider>
        <Row
          className="page-container"
          data-testid="data-insight-container"
          gutter={[16, 16]}>
          {isHeaderVisible && (
            <Col span={24}>
              <DataInsightHeader onScrollToChart={handleScrollToChart} />
            </Col>
          )}
          <Col span={24}>
            <Switch>
              {dataInsightTabs.map((tab) => (
                <Route
                  exact
                  component={tab.component}
                  key={tab.key}
                  path={tab.path}
                />
              ))}

              <Route exact path={ROUTES.DATA_INSIGHT}>
                <Redirect to={getDataInsightPathWithFqn()} />
              </Route>
            </Switch>
          </Col>
        </Row>
      </DataInsightProvider>
    </PageLayoutV1>
  );
};

export default DataInsightPage;
