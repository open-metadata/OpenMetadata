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

import { Card, Col, Row, Tabs, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import ManageButton from '../../components/common/EntityPageInfos/ManageButton/ManageButton';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { EntityType } from '../../enums/entity.enum';
import { withPageLayout } from '../../hoc/withPageLayout';
import i18n from '../../utils/i18next/LocalUtil';
import { getDataQualityPagePath } from '../../utils/RouterUtils';
import './data-quality-page.less';
import DataQualityClassBase from './DataQualityClassBase';
import { DataQualityPageTabs } from './DataQualityPage.interface';
import DataQualityProvider from './DataQualityProvider';

const DataQualityPage = () => {
  const { tab: activeTab = DataQualityClassBase.getDefaultActiveTab() } =
    useParams<{ tab: DataQualityPageTabs }>();
  const history = useHistory();
  const { t } = useTranslation();
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
      history.replace(getDataQualityPagePath(activeKey as DataQualityPageTabs));
    }
  };

  return (
    <div>
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
            <Col span={24}>
              <Tabs
                activeKey={activeTab}
                className="tabs-new"
                data-testid="tabs"
                items={menuItems}
                onChange={handleTabChange}
              />
            </Col>
          </Row>
        </DataQualityProvider>
      </Card>
    </div>
  );
};

export default withPageLayout(i18n.t('label.data-quality'))(DataQualityPage);
