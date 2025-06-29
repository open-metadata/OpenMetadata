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
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import ManageButton from '../../components/common/EntityPageInfos/ManageButton/ManageButton';
import LeftPanelCard from '../../components/common/LeftPanelCard/LeftPanelCard';
import ResizableLeftPanels from '../../components/common/ResizablePanels/ResizableLeftPanels';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
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
  const menuItems: MenuProps['items'] = useMemo(() => {
    const data = DataQualityClassBase.getLeftSideBar();

    return data.map((value) => {
      const SvgIcon = value.icon;

      return {
        key: value.key,
        label: (
          <TabsLabel
            description={value.description}
            id={value.id}
            name={value.label}
          />
        ),
        icon: <SvgIcon {...value.iconProps} height={16} width={16} />,
      };
    });
  }, []);

  const extraDropdownContent = useMemo(
    () => DataQualityClassBase.getManageExtraOptions(activeTab),
    [activeTab]
  );

  const handleTabChange: MenuProps['onClick'] = (event) => {
    const activeKey = event.key;
    if (activeKey !== activeTab) {
      navigate(getDataQualityPagePath(activeKey as DataQualityPageTabs));
    }
  };

  const renderTabComponent = useMemo(() => {
    const currentTab = DataQualityClassBase.getDataQualityTab().find(
      (tabItem) => tabItem.key === activeTab
    );

    if (!currentTab) {
      return (
        <Navigate
          replace
          to={getDataQualityPagePath(
            DataQualityClassBase.getDefaultActiveTab()
          )}
        />
      );
    }

    const TabComponent = currentTab.component;

    return <TabComponent />;
  }, [activeTab]);

  return (
    <div>
      <ResizableLeftPanels
        className="content-height-with-resizable-panel"
        firstPanel={{
          className: 'content-resizable-panel-container',
          minWidth: 280,
          flex: 0.13,
          children: (
            <LeftPanelCard id="data-quality">
              <Menu
                className="custom-menu custom-menu-with-description data-quality-page-left-panel-menu"
                data-testid="tabs"
                items={menuItems}
                mode="inline"
                selectedKeys={[
                  activeTab ?? DataQualityClassBase.getDefaultActiveTab(),
                ]}
                onClick={handleTabChange}
              />
            </LeftPanelCard>
          ),
        }}
        pageTitle={t('label.data-quality')}
        secondPanel={{
          children: (
            <Card className="h-full overflow-y-auto">
              <DataQualityProvider>
                <Row data-testid="data-insight-container" gutter={[0, 16]}>
                  <Col span={isEmpty(extraDropdownContent) ? 24 : 23}>
                    <Typography.Title
                      className="m-b-md"
                      data-testid="page-title"
                      level={5}>
                      {t('label.data-quality')}
                    </Typography.Title>
                    <Typography.Paragraph
                      className="text-grey-muted"
                      data-testid="page-sub-title">
                      {t('message.page-sub-header-for-data-quality')}
                    </Typography.Paragraph>
                  </Col>
                  {isEmpty(extraDropdownContent) ? null : (
                    <Col className="d-flex justify-end" span={1}>
                      <ManageButton
                        entityName={EntityType.TEST_CASE}
                        entityType={EntityType.TEST_CASE}
                        extraDropdownContent={extraDropdownContent}
                      />
                    </Col>
                  )}
                  <Col span={24}>{renderTabComponent}</Col>
                </Row>
              </DataQualityProvider>
            </Card>
          ),
          className: 'content-resizable-panel-container',
          minWidth: 800,
          flex: 0.87,
        }}
      />
    </div>
  );
};

export default withPageLayout(DataQualityPage);
