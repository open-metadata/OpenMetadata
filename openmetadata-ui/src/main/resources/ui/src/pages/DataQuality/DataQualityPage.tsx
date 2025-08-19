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

import { DownOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Tabs } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Dropdown } from '../../components/common/AntdCompat';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import TestCaseFormV1 from '../../components/DataQuality/AddDataQualityTest/components/TestCaseFormV1';
import BundleSuiteForm from '../../components/DataQuality/BundleSuiteForm/BundleSuiteForm';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { TestCase } from '../../generated/tests/testCase';
import { TestSuite } from '../../generated/tests/testSuite';
import { withPageLayout } from '../../hoc/withPageLayout';
import {
    getDataQualityPagePath,
    getTestCaseDetailPagePath,
    getTestSuitePath
} from '../../utils/RouterUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import './data-quality-page.less';
import DataQualityClassBase from './DataQualityClassBase';
import { DataQualityPageTabs } from './DataQualityPage.interface';
import DataQualityProvider from './DataQualityProvider';

const DataQualityPage = () => {
  const { tab: activeTab = DataQualityClassBase.getDefaultActiveTab() } =
    useRequiredParams<{ tab: DataQualityPageTabs }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { testSuite: testSuitePermission } = permissions;

  // Add state for modal open/close
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] = useState(false);
  const [isBundleSuiteModalOpen, setIsBundleSuiteModalOpen] = useState(false);

  // Add handlers for modal
  const handleOpenTestCaseModal = () => {
    setIsTestCaseModalOpen(true);
  };

  const handleCloseTestCaseModal = () => {
    setIsTestCaseModalOpen(false);
  };

  const handleOpenBundleSuiteModal = () => {
    setIsBundleSuiteModalOpen(true);
  };

  const handleCloseBundleSuiteModal = () => {
    setIsBundleSuiteModalOpen(false);
  };

  const handleBundleSuiteSuccess = (testSuite: TestSuite) => {
    if (testSuite.fullyQualifiedName) {
      navigate(getTestSuitePath(testSuite.fullyQualifiedName));
    }
  };

  const addButtonContent = useMemo(() => {
    // Since we will be checking permissions during test case creation, based on table ownership and
    // test case creation rights
    const btn = [
      {
        label: t('label.test-case'),
        key: '1',
        onClick: handleOpenTestCaseModal,
      },
    ];

    if (testSuitePermission?.Create) {
      btn.push({
        label: t('label.bundle-suite'),
        key: '2',
        onClick: handleOpenBundleSuiteModal,
      });
    }

    return btn;
  }, [permissions]);

  const menuItems = useMemo(() => {
    const data = DataQualityClassBase.getDataQualityTab();

    return data.map((value) => {
      const Component = value.component;

      return {
        key: value.key,
        label: <TabsLabel id={value.key} name={value.label} />,
        children: <Component />,
      };
    });
  }, []);

  const exportDataQualityDashboardButton = useMemo(
    () => DataQualityClassBase.getExportDataQualityDashboardButton(activeTab),
    [activeTab]
  );

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(getDataQualityPagePath(activeKey as DataQualityPageTabs));
    }
  };

  const handleFormSubmit = (testCase: TestCase) => {
    if (testCase.fullyQualifiedName) {
      navigate(getTestCaseDetailPagePath(testCase.fullyQualifiedName));
    }
  };

  return (
    <DataQualityProvider>
      <Row
        className="data-quality-page m-b-md"
        data-testid="data-insight-container"
        gutter={[0, 16]}>
        <Col span={24}>
          <Card>
            <Row>
              <Col span={16}>
                <PageHeader
                  data={{
                    header: t('label.data-quality'),
                    subHeader: t('message.page-sub-header-for-data-quality'),
                  }}
                />
              </Col>

              <Col className="d-flex justify-end" span={8}>
                {activeTab === DataQualityPageTabs.TEST_SUITES &&
                  testSuitePermission?.Create && (
                    <Button
                      data-testid="add-test-suite-btn"
                      type="primary"
                      onClick={handleOpenBundleSuiteModal}>
                      {t('label.add-a-entity', {
                        entity: t('label.bundle-suite'),
                      })}
                    </Button>
                  )}
                {activeTab === DataQualityPageTabs.TEST_CASES && (
                  <Button
                    data-testid="add-test-case-btn"
                    type="primary"
                    onClick={handleOpenTestCaseModal}>
                    {t('label.add-a-entity', {
                      entity: t('label.test-case'),
                    })}
                  </Button>
                )}
                {exportDataQualityDashboardButton}

                {activeTab === DataQualityPageTabs.DASHBOARD &&
                  !isEmpty(addButtonContent) && (
                    <Dropdown
                      className="m-l-md h-10"
                      menu={{
                        items: addButtonContent,
                      }}
                      placement="bottomRight"
                      trigger={['click']}>
                      <Button
                        data-testid="data-quality-add-button-menu"
                        type="primary">
                        <Space>
                          {t('label.add')}
                          <DownOutlined />
                        </Space>
                      </Button>
                    </Dropdown>
                  )}
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={24}>
          <Tabs
            activeKey={activeTab}
            className="tabs-new data-quality-page-tabs"
            data-testid="tabs"
            items={menuItems}
            onChange={handleTabChange}
          />
        </Col>
      </Row>
      {isTestCaseModalOpen && (
        <TestCaseFormV1
          drawerProps={{
            title: t('label.add-entity', {
              entity: t('label.test-case'),
            }),
            open: isTestCaseModalOpen,
          }}
          onCancel={handleCloseTestCaseModal}
          onFormSubmit={handleFormSubmit}
        />
      )}
      {isBundleSuiteModalOpen && (
        <BundleSuiteForm
          drawerProps={{
            open: isBundleSuiteModalOpen,
          }}
          onCancel={handleCloseBundleSuiteModal}
          onSuccess={handleBundleSuiteSuccess}
        />
      )}
    </DataQualityProvider>
  );
};

export default withPageLayout(DataQualityPage);
