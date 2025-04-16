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

import { Card, Col, Menu, MenuProps, Row, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { TestSuites } from '../../components/DataQuality/TestSuite/TestSuiteList/TestSuites.component';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { TestSuite } from '../../generated/tests/testSuite';
import { useAuth } from '../../hooks/authHooks';
import { getDataQualityPagePath } from '../../utils/RouterUtils';
import TestSuiteDetailsPage from '../TestSuiteDetailsPage/TestSuiteDetailsPage.component';
import { DataQualityPageTabs } from './DataQualityPage.interface';
import './DataQualityPage.style.less';

const DataQualityPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: DataQualityPageTabs }>();
  const { isAdminUser } = useAuth();
  const { permissions } = usePermissionProvider();

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      {
        label: t('label.test-suite-plural'),
        key: DataQualityPageTabs.TEST_SUITES,
      },
    ],
    [t]
  );

  const handleTabChange = (key: string) => {
    if (key !== tab) {
      navigate(getDataQualityPagePath(key as DataQualityPageTabs));
    }
  };

  const handleTestSuiteClick = (testSuite: TestSuite) => {
    navigate(
      ROUTES.TEST_SUITES_WITH_FQN.replace(
        ':fqn',
        testSuite.fullyQualifiedName ?? ''
      )
    );
  };

  const hasViewPermission = useMemo(() => {
    return (
      isAdminUser ||
      permissions?.[ResourceEntity.TEST_SUITE]?.ViewAll ||
      permissions?.[ResourceEntity.TEST_SUITE]?.ViewBasic
    );
  }, [isAdminUser, permissions]);

  if (!hasViewPermission) {
    return <Navigate replace to="/" />;
  }

  return (
    <div className="data-quality-page">
      <Row className="page-header" gutter={[16, 16]}>
        <Col span={24}>
          <Typography.Title level={5}>
            {t('label.data-quality')}
          </Typography.Title>
        </Col>
        <Col span={24}>
          <Menu
            items={menuItems}
            mode="horizontal"
            selectedKeys={[tab ?? DataQualityPageTabs.TEST_SUITES]}
            onClick={({ key }) => handleTabChange(key)}
          />
        </Col>
      </Row>
      <Card className="page-layout-card">
        <Routes>
          <Route
            element={<TestSuites />}
            path={getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES)}
          />
          <Route
            element={<TestSuiteDetailsPage />}
            path={ROUTES.TEST_SUITES_WITH_FQN}
          />
          <Route
            element={
              <Navigate
                replace
                to={getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES)}
              />
            }
            path="*"
          />
        </Routes>
      </Card>
    </div>
  );
};

export default DataQualityPage;
