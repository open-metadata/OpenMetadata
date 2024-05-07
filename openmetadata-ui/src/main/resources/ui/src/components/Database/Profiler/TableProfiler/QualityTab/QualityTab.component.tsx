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
import { isEmpty } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getEntityDetailsPath } from '../../../../../constants/constants';
import { PAGE_HEADERS } from '../../../../../constants/PageHeaders.constant';
import {
  TEST_CASE_STATUS_OPTION,
  TEST_CASE_TYPE_OPTION,
} from '../../../../../constants/profiler.constant';
import { INITIAL_TEST_SUMMARY } from '../../../../../constants/TestSuite.constant';
import { EntityTabs, EntityType } from '../../../../../enums/entity.enum';
import { ProfilerDashboardType } from '../../../../../enums/table.enum';
import { TestCaseStatus } from '../../../../../generated/tests/testCase';
import { useFqn } from '../../../../../hooks/useFqn';
import { TestCaseType } from '../../../../../rest/testAPI';
import {
  getBreadcrumbForTable,
  getEntityName,
} from '../../../../../utils/EntityUtils';
import { getAddDataQualityTableTestPath } from '../../../../../utils/RouterUtils';
import NextPrevious from '../../../../common/NextPrevious/NextPrevious';
import { NextPreviousProps } from '../../../../common/NextPrevious/NextPrevious.interface';
import TabsLabel from '../../../../common/TabsLabel/TabsLabel.component';
import { SummaryPanel } from '../../../../DataQuality/SummaryPannel/SummaryPanel.component';
import TestSuitePipelineTab from '../../../../DataQuality/TestSuite/TestSuitePipelineTab/TestSuitePipelineTab.component';
import PageHeader from '../../../../PageHeader/PageHeader.component';
import DataQualityTab from '../../DataQualityTab/DataQualityTab';
import { TableProfilerTab } from '../../ProfilerDashboard/profilerDashboard.interface';
import { useTableProfiler } from '../TableProfilerProvider';

export const QualityTab = () => {
  const {
    permissions,
    fetchAllTests,
    onTestCaseUpdate,
    allTestCases,
    isTestsLoading,
    isTableDeleted,
    testCasePaging,
    table,
    testCaseSummary,
  } = useTableProfiler();

  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
  } = testCasePaging;

  const editTest = permissions.EditAll || permissions.EditTests;
  const { fqn: datasetFQN } = useFqn();
  const history = useHistory();
  const { t } = useTranslation();

  const [selectedTestCaseStatus, setSelectedTestCaseStatus] =
    useState<TestCaseStatus>('' as TestCaseStatus);
  const [selectedTestType, setSelectedTestType] = useState(TestCaseType.all);
  const testSuite = useMemo(() => table?.testSuite, [table]);

  const handleTestCasePageChange: NextPreviousProps['pagingHandler'] = ({
    cursorType,
    currentPage,
  }) => {
    if (cursorType) {
      fetchAllTests({
        [cursorType]: paging[cursorType],
        testCaseType: selectedTestType,
        testCaseStatus: isEmpty(selectedTestCaseStatus)
          ? undefined
          : selectedTestCaseStatus,
      });
    }
    handlePageChange(currentPage);
  };

  const tableBreadcrumb = useMemo(() => {
    return table
      ? [
          ...getBreadcrumbForTable(table),
          {
            name: getEntityName(table),
            url:
              getEntityDetailsPath(
                EntityType.TABLE,
                table.fullyQualifiedName ?? '',
                EntityTabs.PROFILER
              ) + `?activeTab=${TableProfilerTab.DATA_QUALITY}`,
          },
        ]
      : undefined;
  }, [table]);

  const tabs = useMemo(
    () => [
      {
        label: t('label.test-case-plural'),
        key: EntityTabs.TEST_CASES,
        children: (
          <Row className="p-t-md">
            <Col span={24}>
              <DataQualityTab
                afterDeleteAction={fetchAllTests}
                breadcrumbData={tableBreadcrumb}
                isLoading={isTestsLoading}
                showTableColumn={false}
                testCases={allTestCases}
                onTestCaseResultUpdate={onTestCaseUpdate}
                onTestUpdate={onTestCaseUpdate}
              />
            </Col>
            <Col span={24}>
              {showPagination && (
                <NextPrevious
                  currentPage={currentPage}
                  pageSize={pageSize}
                  paging={paging}
                  pagingHandler={handleTestCasePageChange}
                  onShowSizeChange={handlePageSizeChange}
                />
              )}
            </Col>
          </Row>
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
      allTestCases,
      onTestCaseUpdate,
      testSuite,
      fetchAllTests,
      tableBreadcrumb,
      testCasePaging,
    ]
  );

  const handleTestCaseStatusChange = (value: TestCaseStatus) => {
    if (value !== selectedTestCaseStatus) {
      setSelectedTestCaseStatus(value);
      fetchAllTests({
        testCaseType: selectedTestType,
        testCaseStatus: isEmpty(value) ? undefined : value,
      });
    }
  };

  const handleTestCaseTypeChange = (value: TestCaseType) => {
    if (value !== selectedTestType) {
      setSelectedTestType(value);
      fetchAllTests({
        testCaseType: value,
        testCaseStatus: isEmpty(selectedTestCaseStatus)
          ? undefined
          : selectedTestCaseStatus,
      });
    }
  };

  const handleAddTestClick = (type: ProfilerDashboardType) => {
    history.push(getAddDataQualityTableTestPath(type, datasetFQN));
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
        <SummaryPanel testSummary={testCaseSummary ?? INITIAL_TEST_SUMMARY} />
      </Col>
      <Col span={24}>
        <Tabs items={tabs} />
      </Col>
    </Row>
  );
};
