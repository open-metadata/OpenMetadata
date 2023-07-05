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

import { Col, Row, Tabs, TabsProps, Typography } from 'antd';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { TestCases } from 'components/DataQuality/TestCases/TestCases.component';
import { TestSuites } from 'components/DataQuality/TestSuites/TestSuites.component';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getDataQualityPagePath } from 'utils/RouterUtils';
import { DataQualityPageTabs } from './DataQualityPage.interface';

const DataQualityPage = () => {
  const { t } = useTranslation();
  const { tab: activeTab } = useParams<{ tab: DataQualityPageTabs }>();
  const history = useHistory();

  const tabDetails = useMemo(() => {
    const tab: TabsProps['items'] = [
      {
        label: t('label.by-entity', { entity: t('label.table-plural') }),
        children: <TestSuites />,
        key: DataQualityPageTabs.TABLES,
      },
      {
        label: t('label.by-entity', { entity: t('label.test-case-plural') }),
        key: DataQualityPageTabs.TEST_CASES,
        children: <TestCases />,
      },
      {
        label: t('label.by-entity', { entity: t('label.test-suite-plural') }),
        key: DataQualityPageTabs.TEST_SUITES,
        children: <TestSuites />,
      },
    ];

    return tab;
  }, []);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(getDataQualityPagePath(activeKey as DataQualityPageTabs));
    }
  };

  return (
    <PageLayoutV1 pageTitle="Quality">
      <Row className="p-t-md" gutter={[0, 16]}>
        <Col className="p-x-lg" span={24}>
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
        <Col span={24}>
          <Tabs
            destroyInactiveTabPane
            activeKey={activeTab ?? DataQualityPageTabs.TABLES}
            className="custom-tab-spacing"
            data-testid="tabs"
            items={tabDetails}
            onChange={handleTabChange}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default DataQualityPage;
