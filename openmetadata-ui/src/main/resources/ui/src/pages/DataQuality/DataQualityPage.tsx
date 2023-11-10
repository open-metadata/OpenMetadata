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
import { AxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { SummaryPanel } from '../../components/DataQuality/SummaryPannel/SummaryPanel.component';
import { TestCases } from '../../components/DataQuality/TestCases/TestCases.component';
import { TestSuites } from '../../components/DataQuality/TestSuites/TestSuites.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import TabsLabel from '../../components/TabsLabel/TabsLabel.component';
import { INITIAL_TEST_SUMMARY } from '../../constants/TestSuite.constant';
import { TestSummary } from '../../generated/tests/testCase';
import { getTestCaseExecutionSummary } from '../../rest/testAPI';
import { getDataQualityPagePath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { DataQualityPageTabs } from './DataQualityPage.interface';

const DataQualityPage = () => {
  const { t } = useTranslation();
  const { tab: activeTab } = useParams<{ tab: DataQualityPageTabs }>();
  const history = useHistory();
  const [summary, setSummary] = useState<TestSummary>(INITIAL_TEST_SUMMARY);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const { permissions } = usePermissionProvider();
  const { testCase: testCasePermission } = permissions;

  const summaryPanel = useMemo(
    () => <SummaryPanel isLoading={isSummaryLoading} testSummary={summary} />,
    [summary, isSummaryLoading]
  );

  const tabDetails = useMemo(() => {
    const tab: TabsProps['items'] = [
      {
        label: (
          <TabsLabel
            id="by-tables"
            name={t('label.by-entity', { entity: t('label.table-plural') })}
          />
        ),
        children: <TestSuites summaryPanel={summaryPanel} />,
        key: DataQualityPageTabs.TABLES,
      },
      {
        label: (
          <TabsLabel
            id="by-test-cases"
            name={t('label.by-entity', { entity: t('label.test-case-plural') })}
          />
        ),
        key: DataQualityPageTabs.TEST_CASES,
        children: <TestCases summaryPanel={summaryPanel} />,
      },
      {
        label: (
          <TabsLabel
            id="by-test-suites"
            name={t('label.by-entity', {
              entity: t('label.test-suite-plural'),
            })}
          />
        ),
        key: DataQualityPageTabs.TEST_SUITES,
        children: <TestSuites summaryPanel={summaryPanel} />,
      },
    ];

    return tab;
  }, [summaryPanel]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(getDataQualityPagePath(activeKey as DataQualityPageTabs));
    }
  };

  const fetchTestSummary = async () => {
    try {
      const response = await getTestCaseExecutionSummary();
      setSummary(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (testCasePermission?.ViewAll || testCasePermission?.ViewBasic) {
      fetchTestSummary();
    } else {
      setIsSummaryLoading(false);
    }
  }, []);

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
