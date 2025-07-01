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

import { Button, Card, Col, Row, Tabs } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import ManageButton from '../../components/common/EntityPageInfos/ManageButton/ManageButton';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import TestCaseFormV1 from '../../components/DataQuality/AddDataQualityTest/components/TestCaseFormV1';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { EntityType } from '../../enums/entity.enum';
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

  // Add handlers for modal
  const handleOpenTestCaseModal = () => {
    setIsTestCaseModalOpen(true);
  };

  const handleCloseTestCaseModal = () => {
    setIsTestCaseModalOpen(false);
  };

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

  const extraDropdownContent = useMemo(
    () => DataQualityClassBase.getManageExtraOptions(activeTab),
    [activeTab]
  );

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(getDataQualityPagePath(activeKey as DataQualityPageTabs));
    }
  };

  return (
    <DataQualityProvider>
      <Row data-testid="data-insight-container" gutter={[0, 16]}>
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
                    <Link
                      data-testid="add-test-suite-btn"
                      to={ROUTES.ADD_TEST_SUITES}>
                      <Button type="primary">
                        {t('label.add-entity', {
                          entity: t('label.bundle-suite-plural'),
                        })}
                      </Button>
                    </Link>
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
                {isEmpty(extraDropdownContent) ? null : (
                  <ManageButton
                    entityName={EntityType.TEST_CASE}
                    entityType={EntityType.TEST_CASE}
                    extraDropdownContent={extraDropdownContent}
                  />
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
    </DataQualityProvider>
  );
};

export default withPageLayout(DataQualityPage);
