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

import { Card, Col, Divider, Layout, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import TestSummary from 'components/ProfilerDashboard/component/TestSummary';
import { ROUTES } from 'constants/constants';
import { TestCase } from 'generated/tests/testCase';
import { camelCase, has, isEmpty, isUndefined, startCase } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { getTestCaseByFqn } from 'rest/testAPI';
import { getEntityName } from 'utils/EntityUtils';
import { getTestSuitePath } from 'utils/RouterUtils';
import { getFormattedDateFromSeconds } from 'utils/TimeUtils';
import { showErrorToast } from 'utils/ToastUtils';
import './TestCaseDetailsPage.style.less';

function TestCaseDetailsPage() {
  const { testCaseFQN } = useParams<{ testCaseFQN: string }>();
  const { t } = useTranslation();
  const [testCaseData, setTestCaseData] = useState<TestCase>();

  const fetchTestCaseData = async () => {
    try {
      const response = await getTestCaseByFqn(testCaseFQN, {
        fields: ['testSuite', 'testCaseResult'],
      });
      setTestCaseData(response.data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.test-case') })
      );
    }
  };

  const breadcrumb = useMemo(() => {
    if (has(testCaseData, 'testSuite')) {
      return [
        {
          name: t('label.test-suite-plural'),
          url: ROUTES.TEST_SUITES,
        },
        {
          name: startCase(
            camelCase(
              testCaseData?.testSuite?.fullyQualifiedName ||
                testCaseData?.testSuite?.name
            )
          ),
          url: getTestSuitePath(testCaseData?.testSuite?.name ?? ''),
        },
        {
          name: testCaseData?.name ?? '',
          url: '',
        },
      ];
    } else {
      return [];
    }
  }, [testCaseData]);

  const parameterValuesWithoutSqlExpression = useMemo(
    () =>
      testCaseData?.parameterValues && testCaseData.parameterValues.length > 0
        ? testCaseData.parameterValues.filter(
            (param) => param.name !== 'sqlExpression'
          )
        : undefined,
    [testCaseData?.parameterValues]
  );

  useEffect(() => {
    fetchTestCaseData();
  }, [testCaseFQN]);

  if (isUndefined(testCaseData)) {
    return <ErrorPlaceHolder />;
  }

  return (
    <Layout
      className="test-case-details-page-container"
      style={{ height: '100vh' }}>
      <Layout.Content className="p-lg">
        <TitleBreadcrumb className="m-b-md" titleLinks={breadcrumb} />
        <Card>
          <TestSummary data={testCaseData} showExpandIcon={false} />
        </Card>
      </Layout.Content>

      <Layout.Sider className="test-case-details-page-right-panel" width={360}>
        <Row>
          <Col span={24}>
            <Row className="p-sm m-0">
              <Col span={24}>
                <Typography.Title level={5}>
                  {getEntityName(testCaseData)}
                </Typography.Title>
              </Col>
              <Col className="text-xs" span={24}>
                <Space>
                  <Typography.Text className="text-grey-muted">
                    {`${t('label.last-run-result')}:`}
                  </Typography.Text>
                  <Typography.Text className="font-medium">
                    {testCaseData.testCaseResult?.testCaseStatus ?? '--'}
                  </Typography.Text>
                </Space>
                <Divider className="border-gray" type="vertical" />
                <Space>
                  <Typography.Text className="text-grey-muted">
                    {`${t('label.last-run')}:`}
                  </Typography.Text>
                  <Typography.Text className="font-medium">
                    {testCaseData.testCaseResult?.timestamp
                      ? getFormattedDateFromSeconds(
                          testCaseData.testCaseResult?.timestamp
                        )
                      : '--'}
                  </Typography.Text>
                </Space>
              </Col>
            </Row>
          </Col>
          <Col span={24}>
            <Divider className="m-0" />
          </Col>
          <Col span={24}>
            <Row className="p-sm m-0" gutter={[16, 16]}>
              <Col className="p-0" span={24}>
                <Typography.Text className="text-base text-grey-muted">
                  {t('label.description')}
                </Typography.Text>
              </Col>
              <Col className="p-0" span={24}>
                <Typography.Text>
                  {testCaseData.description
                    ? testCaseData.description
                    : t('label.no-description')}
                </Typography.Text>
              </Col>
            </Row>
          </Col>
          <Col span={24}>
            <Divider className="m-0" />
          </Col>
          <Col span={24}>
            <Row className="p-sm m-0" gutter={[16, 16]}>
              <Col className="p-0" span={24}>
                <Typography.Text className="text-base text-grey-muted">
                  {t('label.parameter')}
                </Typography.Text>
              </Col>
              <Col className="p-0" span={24}>
                {!isEmpty(parameterValuesWithoutSqlExpression) &&
                !isUndefined(parameterValuesWithoutSqlExpression) ? (
                  <Row
                    className="parameter-value-container m-0"
                    gutter={[16, 4]}>
                    {parameterValuesWithoutSqlExpression.map((param) => (
                      <Col key={param.name}>
                        <Typography.Text className="text-grey-muted">
                          {`${param.name}:`}{' '}
                        </Typography.Text>
                        <Typography.Text>{param.value}</Typography.Text>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Typography.Text type="secondary">
                    {t('label.no-parameter-available')}
                  </Typography.Text>
                )}
              </Col>
            </Row>
          </Col>
          <Col span={24}>
            <Divider className="m-0" />
          </Col>
        </Row>
      </Layout.Sider>
    </Layout>
  );
}

export default TestCaseDetailsPage;
