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
import { Button, Col, Dropdown, Form, Row, Select, Space, Tabs } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { SummaryPanel } from '../../../components/DataQuality/SummaryPannel/SummaryPanel.component';
import DataQualityTab from '../../../components/ProfilerDashboard/component/DataQualityTab';
import TestSuitePipelineTab from '../../../components/TestSuite/TestSuitePipelineTab/TestSuitePipelineTab.component';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import {
  TEST_CASE_STATUS_OPTION,
  TEST_CASE_TYPE_OPTION,
} from '../../../constants/profiler.constant';
import { INITIAL_TEST_SUMMARY } from '../../../constants/TestSuite.constant';
import { EntityTabs, TabSpecificField } from '../../../enums/entity.enum';
import { ProfilerDashboardType } from '../../../enums/table.enum';
import { Table } from '../../../generated/entity/data/table';
import { TestCase } from '../../../generated/tests/testCase';
import { EntityType as TestType } from '../../../generated/tests/testDefinition';
import { getTableDetailsByFQN } from '../../../rest/tableAPI';
import { getAddDataQualityTableTestPath } from '../../../utils/RouterUtils';
import { getDecodedFqn } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import PageHeader from '../../PageHeader/PageHeader.component';
import TabsLabel from '../../TabsLabel/TabsLabel.component';
import { useTableProfiler } from '../TableProfilerProvider';

export const QualityTab = () => {
  const {
    permissions,
    fetchAllTests,
    onTestCaseUpdate,
    allTestCases,
    splitTestCases,
    isTestsLoading,
    isTableDeleted,
  } = useTableProfiler();

  const editTest = permissions.EditAll || permissions.EditTests;
  const { fqn: datasetFQN } = useParams<{ fqn: string }>();
  const history = useHistory();
  const { t } = useTranslation();

  const [selectedTestCaseStatus, setSelectedTestCaseStatus] =
    useState<string>('');
  const [selectedTestType, setSelectedTestType] = useState('');
  const [testSuite, setTestSuite] = useState<Table['testSuite']>();
  const [isTestSuiteLoading, setIsTestSuiteLoading] = useState(true);

  const filteredTestCase = useMemo(() => {
    let tests: TestCase[] = allTestCases ?? [];
    if (selectedTestType === TestType.Table) {
      tests = splitTestCases.table;
    } else if (selectedTestType === TestType.Column) {
      tests = splitTestCases.column;
    }

    return tests.filter(
      (data) =>
        selectedTestCaseStatus === '' ||
        data.testCaseResult?.testCaseStatus === selectedTestCaseStatus
    );
  }, [selectedTestCaseStatus, selectedTestType, allTestCases, splitTestCases]);
  const tabs = useMemo(
    () => [
      {
        label: t('label.test-case-plural'),
        key: EntityTabs.TEST_CASES,
        children: (
          <div className="p-t-md">
            <DataQualityTab
              afterDeleteAction={fetchAllTests}
              isLoading={isTestsLoading}
              showTableColumn={false}
              testCases={filteredTestCase}
              onTestCaseResultUpdate={onTestCaseUpdate}
              onTestUpdate={onTestCaseUpdate}
            />
          </div>
        ),
      },
      {
        label: t('label.pipeline'),
        key: EntityTabs.PIPELINE,
        children: <TestSuitePipelineTab testSuite={testSuite} />,
      },
    ],
    [
      isTestsLoading,
      filteredTestCase,
      onTestCaseUpdate,
      testSuite,
      fetchAllTests,
    ]
  );

  const handleTestCaseStatusChange = (value: string) => {
    if (value !== selectedTestCaseStatus) {
      setSelectedTestCaseStatus(value);
    }
  };

  const handleTestCaseTypeChange = (value: string) => {
    if (value !== selectedTestType) {
      setSelectedTestType(value);
    }
  };

  const handleAddTestClick = (type: ProfilerDashboardType) => {
    history.push(
      getAddDataQualityTableTestPath(type, getDecodedFqn(datasetFQN))
    );
  };

  const addButtonContent = useMemo(
    () => [
      {
        label: <TabsLabel id="table" name={t('label.table')} />,
        key: '1',
        onClick: () => handleAddTestClick(ProfilerDashboardType.TABLE),
      },
      {
        label: <TabsLabel id="column" name={t('label.column')} />,
        key: '2',
        onClick: () => handleAddTestClick(ProfilerDashboardType.COLUMN),
      },
    ],
    []
  );

  const fetchTestSuiteDetails = async () => {
    setIsTestSuiteLoading(true);
    try {
      const details = await getTableDetailsByFQN(datasetFQN, {
        fields: TabSpecificField.TESTSUITE,
      });
      setTestSuite(details.testSuite);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTestSuiteLoading(false);
    }
  };

  useEffect(() => {
    if (isUndefined(testSuite)) {
      fetchTestSuiteDetails();
    } else {
      setIsTestSuiteLoading(false);
    }
  }, [testSuite]);

  return (
    <Row gutter={[0, 16]}>
      <Col span={24}>
        <Row>
          <Col span={10}>
            <PageHeader data={PAGE_HEADERS.DATA_QUALITY} />
          </Col>
          <Col span={14}>
            <Form layout="inline">
              <Space align="center" className="w-full justify-end">
                <Form.Item className="m-0 w-40" label={t('label.type')}>
                  <Select
                    options={TEST_CASE_TYPE_OPTION}
                    value={selectedTestType}
                    onChange={handleTestCaseTypeChange}
                  />
                </Form.Item>
                <Form.Item className="m-0 w-40" label={t('label.status')}>
                  <Select
                    options={TEST_CASE_STATUS_OPTION}
                    value={selectedTestCaseStatus}
                    onChange={handleTestCaseStatusChange}
                  />
                </Form.Item>

                {editTest && !isTableDeleted && (
                  <Form.Item noStyle>
                    <Dropdown
                      menu={{
                        items: addButtonContent,
                      }}
                      placement="bottomRight"
                      trigger={['click']}>
                      <Button
                        data-testid="profiler-add-table-test-btn"
                        type="primary">
                        <Space>
                          {t('label.add-entity', { entity: t('label.test') })}
                          <DownOutlined />
                        </Space>
                      </Button>
                    </Dropdown>
                  </Form.Item>
                )}
              </Space>
            </Form>
          </Col>
        </Row>
      </Col>
      <Col span={24}>
        <SummaryPanel
          isLoading={isTestSuiteLoading}
          testSummary={testSuite?.summary ?? INITIAL_TEST_SUMMARY}
        />
      </Col>
      <Col span={24}>
        <Tabs items={tabs} />
      </Col>
    </Row>
  );
};
