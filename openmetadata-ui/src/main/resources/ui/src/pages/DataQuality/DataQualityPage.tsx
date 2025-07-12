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
import { Button, Card, Col, Dropdown, Row, Space, Tabs } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import TestCaseFormV1 from '../../components/DataQuality/AddDataQualityTest/components/TestCaseFormV1';
import BundleSuiteForm from '../../components/DataQuality/BundleSuiteForm/BundleSuiteForm';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { withPageLayout } from '../../hoc/withPageLayout';
import { getDataQualityPagePath } from '../../utils/RouterUtils';
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

  const addButtonContent = [
    {
      label: t('label.test-case'),
      key: '1',
      onClick: handleOpenTestCaseModal,
    },
    {
      label: t('label.bundle-suite'),
      key: '2',
      onClick: handleOpenBundleSuiteModal,
    },
  ];

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

  return (
    <DataQualityProvider>
      <Row
        className="data-quality-page"
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
                      {t('label.add-entity', {
                        entity: t('label.bundle-suite'),
                      })}
                    </Button>
                  )}
                {activeTab === DataQualityPageTabs.TEST_CASES &&
                  testSuitePermission?.Create && (
                    <Button
                      data-testid="add-test-case-btn"
                      type="primary"
                      onClick={handleOpenTestCaseModal}>
                      {t('label.add-entity', {
                        entity: t('label.test-case'),
                      })}
                    </Button>
                  )}
                {exportDataQualityDashboardButton}

                {activeTab === DataQualityPageTabs.DASHBOARD && (
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
          isDrawer
          drawerProps={{
            title: t('label.add-entity', {
              entity: t('label.test-case'),
            }),
            open: isTestCaseModalOpen,
          }}
          onCancel={handleCloseTestCaseModal}
        />
      )}
      {isBundleSuiteModalOpen && (
        <BundleSuiteForm
          isDrawer
          drawerProps={{
            open: isBundleSuiteModalOpen,
          }}
          onCancel={handleCloseBundleSuiteModal}
          onSuccess={handleCloseBundleSuiteModal}
        />
      )}
    </DataQualityProvider>
  );
};

export default withPageLayout(DataQualityPage);
