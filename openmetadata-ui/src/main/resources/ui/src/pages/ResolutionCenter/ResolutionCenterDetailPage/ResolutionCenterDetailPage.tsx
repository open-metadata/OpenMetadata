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
import { Col, Divider, Row, Space, Tabs, TabsProps, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import Loader from '../../../components/Loader/Loader';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import TestCaseIssueTab from '../../../components/ResolutionCenter/TestCaseIssuesTab/TestCaseIssueTab.component';
import TestCaseResultTab from '../../../components/ResolutionCenter/TestCaseResultTab/TestCaseResultTab.component';
import TabsLabel from '../../../components/TabsLabel/TabsLabel.component';
import { ROUTES } from '../../../constants/constants';
import { EntityTabs } from '../../../enums/entity.enum';
import { TestCase } from '../../../generated/tests/testCase';
import { getTestCaseByFqn } from '../../../rest/testAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getResolutionCenterDetailPagePath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ResolutionCenterTabs } from '../ResolutionCenter.interface';
import { TestCaseData } from './ResolutionCenterDetailPage.interface';

const ResolutionCenterDetailPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const {
    fqn: testCaseFQN,
    tab: activeTab = ResolutionCenterTabs.TEST_CASE_RESULTS,
  } = useParams<{ fqn: string; tab: EntityTabs }>();

  const [testCaseData, setTestCaseData] = useState<TestCaseData>({
    data: undefined,
    isLoading: true,
  });

  const onTestCaseUpdate = useCallback(
    (data: TestCase) => setTestCaseData((prev) => ({ ...prev, data })),
    [setTestCaseData]
  );

  const tabDetails: TabsProps['items'] = useMemo(
    () => [
      {
        label: <TabsLabel id="by-tables" name={t('label.test-case-result')} />,
        children: (
          <TestCaseResultTab
            testCaseData={testCaseData.data}
            onTestCaseUpdate={onTestCaseUpdate}
          />
        ),
        key: ResolutionCenterTabs.TEST_CASE_RESULTS,
      },
      {
        label: <TabsLabel id="by-test-cases" name={t('label.issue-plural')} />,
        key: ResolutionCenterTabs.ISSUES,
        children: <TestCaseIssueTab />,
      },
    ],
    [testCaseData]
  );

  const fetchTestCaseData = async () => {
    setTestCaseData((prev) => ({ ...prev, isLoading: true }));
    try {
      const response = await getTestCaseByFqn(testCaseFQN, {
        fields: ['testSuite', 'testCaseResult', 'testDefinition'],
      });
      setTestCaseData((prev) => ({ ...prev, data: response.data }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.test-case') })
      );
    } finally {
      setTestCaseData((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const breadcrumb = useMemo(() => {
    return [
      {
        name: t('label.resolution-center'),
        url: ROUTES.RESOLUTION_CENTER,
      },
      {
        name: testCaseData?.data?.name ?? '',
        url: '',
        activeTitle: true,
      },
    ];
  }, [testCaseData]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(
        getResolutionCenterDetailPagePath(
          testCaseFQN,
          activeKey as ResolutionCenterTabs
        )
      );
    }
  };

  useEffect(() => {
    fetchTestCaseData();
  }, [testCaseFQN]);

  if (testCaseData.isLoading) {
    return <Loader />;
  }

  if (isEmpty(testCaseData)) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1 pageTitle="Resolution Center Detail Page">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <TitleBreadcrumb className="m-b-sm" titleLinks={breadcrumb} />
        </Col>
        <Col className="p-x-lg" data-testid="entity-page-header" span={24}>
          <Space align="center">
            <Typography.Text className="font-bold">
              {getEntityName(testCaseData.data)}
            </Typography.Text>
            <Divider type="vertical" />
            <OwnerLabel owner={testCaseData.data?.owner} />
          </Space>
        </Col>

        <Col span={24}>
          <Tabs
            destroyInactiveTabPane
            activeKey={activeTab}
            className="entity-details-page-tabs"
            data-testid="tabs"
            items={tabDetails}
            onChange={handleTabChange}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default ResolutionCenterDetailPage;
