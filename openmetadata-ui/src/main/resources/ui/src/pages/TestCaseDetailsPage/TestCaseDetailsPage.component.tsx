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

import { Col, Layout, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { has, isEmpty, isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import TestSummary from '../../components/ProfilerDashboard/component/TestSummary';
import { TestCase } from '../../generated/tests/testCase';
import { DataQualityPageTabs } from '../../pages/DataQuality/DataQualityPage.interface';
import { getTestCaseByFqn } from '../../rest/testAPI';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getDataQualityPagePath } from '../../utils/RouterUtils';
import { getEncodedFqn } from '../../utils/StringsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './TestCaseDetailsPage.style.less';

function TestCaseDetailsPage() {
  const { fqn: testCaseFQN } = useParams<{ fqn: string }>();
  const { t } = useTranslation();
  const [testCaseData, setTestCaseData] = useState<TestCase>();

  const fetchTestCaseData = async () => {
    try {
      const response = await getTestCaseByFqn(getEncodedFqn(testCaseFQN), {
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
          name: t('label.test-case-plural'),
          url: getDataQualityPagePath(DataQualityPageTabs.TEST_CASES),
        },
        {
          name: testCaseData?.name ?? '',
          url: '',
          activeTitle: true,
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

        <TestSummary data={testCaseData} showExpandIcon={false} />
      </Layout.Content>

      <Layout.Sider className="test-case-details-page-right-panel" width={360}>
        <Row className="p-sm" gutter={[0, 32]}>
          <Col className="m-0" span={24}>
            <Typography.Title level={5}>
              {getEntityName(testCaseData)}
            </Typography.Title>
          </Col>
          <Col className="m-0" span={24}>
            <Row gutter={[16, 8]}>
              <Col span={10}>
                <Typography.Text className="text-grey-muted">
                  {`${t('label.last-run-result')}:`}
                </Typography.Text>
              </Col>
              <Col span={14}>
                <Typography.Text>
                  {testCaseData.testCaseResult?.testCaseStatus ?? '--'}
                </Typography.Text>
              </Col>
              <Col span={10}>
                <Typography.Text className="text-grey-muted">
                  {`${t('label.last-run')}:`}
                </Typography.Text>
              </Col>
              <Col span={14}>
                <Typography.Text>
                  {testCaseData.testCaseResult?.timestamp
                    ? formatDateTime(testCaseData.testCaseResult?.timestamp)
                    : '--'}
                </Typography.Text>
              </Col>
            </Row>
          </Col>

          <Col span={24}>
            <Row className="m-0">
              <Col className="p-0" span={24}>
                <Typography.Text className="text-grey-muted">
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
            <Row className="m-0">
              <Col className="p-0" span={24}>
                <Typography.Text className="text-grey-muted">
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
                      <Col key={param.name} span={24}>
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
        </Row>
      </Layout.Sider>
    </Layout>
  );
}

export default TestCaseDetailsPage;
