/*
 *  Copyright 2022 Collate
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

import {
  Button,
  Col,
  Form,
  Radio,
  RadioChangeEvent,
  Row,
  Select,
  Space,
  Tooltip,
} from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import { SelectableOption } from 'Models';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as NoDataIcon } from '../../assets/svg/no-data-icon.svg';
import { getListTestCase } from '../../axiosAPIs/testAPI';
import { API_RES_MAX_SIZE } from '../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { INITIAL_TEST_RESULT_SUMMARY } from '../../constants/profiler.constant';
import { ProfilerDashboardType } from '../../enums/table.enum';
import { TestCase, TestCaseStatus } from '../../generated/tests/testCase';
import { EntityType as TestType } from '../../generated/tests/testDefinition';
import {
  formatNumberWithComma,
  formTwoDigitNmber,
} from '../../utils/CommonUtils';
import { updateTestResults } from '../../utils/DataQualityAndProfilerUtils';
import { getAddDataQualityTableTestPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { generateEntityLink } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import DataQualityTab from '../ProfilerDashboard/component/DataQualityTab';
import { ProfilerDashboardTab } from '../ProfilerDashboard/profilerDashboard.interface';
import ColumnProfileTable from './Component/ColumnProfileTable';
import ProfilerSettingsModal from './Component/ProfilerSettingsModal';
import {
  OverallTableSummeryType,
  TableProfilerProps,
  TableTestsType,
} from './TableProfiler.interface';
import './tableProfiler.less';

const TableProfilerV1: FC<TableProfilerProps> = ({ table, permissions }) => {
  const { profile, columns = [] } = table;
  const [settingModalVisible, setSettingModalVisible] = useState(false);
  const [columnTests, setColumnTests] = useState<TestCase[]>([]);
  const [tableTests, setTableTests] = useState<TableTestsType>({
    tests: [],
    results: INITIAL_TEST_RESULT_SUMMARY,
  });
  const [activeTab, setActiveTab] = useState<ProfilerDashboardTab>(
    ProfilerDashboardTab.SUMMARY
  );
  const [selectedTestCaseStatus, setSelectedTestCaseStatus] =
    useState<string>('');
  const [selectedTestType, setSelectedTestType] = useState('');
  const isSummary = activeTab === ProfilerDashboardTab.SUMMARY;
  const isDataQuality = activeTab === ProfilerDashboardTab.DATA_QUALITY;

  const testCaseStatusOption = useMemo(() => {
    const testCaseStatus: SelectableOption[] = Object.values(
      TestCaseStatus
    ).map((value) => ({
      label: value,
      value: value,
    }));
    testCaseStatus.unshift({
      label: 'All',
      value: '',
    });

    return testCaseStatus;
  }, []);

  const testCaseTypeOption = useMemo(() => {
    const testCaseStatus: SelectableOption[] = Object.entries(TestType).map(
      ([key, value]) => ({
        label: key,
        value: value,
      })
    );
    testCaseStatus.unshift({
      label: 'All',
      value: '',
    });

    return testCaseStatus;
  }, []);

  const viewTest = permissions.ViewAll || permissions.ViewTests;
  const viewProfiler = permissions.ViewAll || permissions.ViewDataProfile;
  const editTest = permissions.EditAll || permissions.EditTests;

  const handleSettingModal = (value: boolean) => {
    setSettingModalVisible(value);
  };
  const overallSummery: OverallTableSummeryType[] = useMemo(() => {
    return [
      {
        title: 'Row Count',
        value: formatNumberWithComma(profile?.rowCount ?? 0),
      },
      {
        title: 'Column Count',
        value: profile?.columnCount ?? 0,
      },
      {
        title: 'Table Sample %',
        value: `${profile?.profileSample ?? 100}%`,
      },
      {
        title: 'Success',
        value: formTwoDigitNmber(tableTests.results.success),
        className: 'success',
      },
      {
        title: 'Aborted',
        value: formTwoDigitNmber(tableTests.results.aborted),
        className: 'aborted',
      },
      {
        title: 'Failed',
        value: formTwoDigitNmber(tableTests.results.failed),
        className: 'failed',
      },
    ];
  }, [profile, tableTests]);

  const tabOptions = [
    {
      label: ProfilerDashboardTab.SUMMARY,
      value: ProfilerDashboardTab.SUMMARY,
      disabled: !viewProfiler,
    },
    {
      label: ProfilerDashboardTab.DATA_QUALITY,
      value: ProfilerDashboardTab.DATA_QUALITY,
      disabled: !viewTest,
    },
  ];

  const handleTabChange = (e: RadioChangeEvent) => {
    const value = e.target.value as ProfilerDashboardTab;
    setActiveTab(value);
  };

  const fetchAllTests = async () => {
    try {
      const { data } = await getListTestCase({
        fields: 'testCaseResult,entityLink,testDefinition,testSuite',
        entityLink: generateEntityLink(table.fullyQualifiedName || ''),
        includeAllTests: true,
        limit: API_RES_MAX_SIZE,
      });
      const columnTestsCase: TestCase[] = [];
      const tableTests: TableTestsType = {
        tests: [],
        results: { ...INITIAL_TEST_RESULT_SUMMARY },
      };
      data.forEach((test) => {
        if (test.entityFQN === table.fullyQualifiedName) {
          tableTests.tests.push(test);

          updateTestResults(
            tableTests.results,
            test.testCaseResult?.testCaseStatus || ''
          );

          return;
        }
        columnTestsCase.push(test);
      });
      setTableTests(tableTests);
      setColumnTests(columnTestsCase);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

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

  const getFilterTestCase = () => {
    let tests: TestCase[] = [];
    if (selectedTestType === TestType.Table) {
      tests = tableTests.tests;
    } else if (selectedTestType === TestType.Column) {
      tests = columnTests;
    } else {
      tests = [...tableTests.tests, ...columnTests];
    }

    return tests.filter(
      (data) =>
        selectedTestCaseStatus === '' ||
        data.testCaseResult?.testCaseStatus === selectedTestCaseStatus
    );
  };

  useEffect(() => {
    if (!isEmpty(table) && viewTest) {
      fetchAllTests();
    }
  }, [table, viewTest]);

  return (
    <div
      className="table-profiler-container"
      data-testid="table-profiler-container"
      id="profilerDetails">
      <Row className="tw-mb-4" justify="space-between">
        <Radio.Group
          buttonStyle="solid"
          className="profiler-switch"
          optionType="button"
          options={tabOptions}
          value={activeTab}
          onChange={handleTabChange}
        />

        <Space>
          {isDataQuality && (
            <>
              <Form.Item className="mb-0 w-40" label="Type">
                <Select
                  options={testCaseTypeOption}
                  value={selectedTestType}
                  onChange={handleTestCaseTypeChange}
                />
              </Form.Item>
              <Form.Item className="mb-0 w-40" label="Status">
                <Select
                  options={testCaseStatusOption}
                  value={selectedTestCaseStatus}
                  onChange={handleTestCaseStatusChange}
                />
              </Form.Item>
            </>
          )}

          <Tooltip title={editTest ? 'Add Test' : NO_PERMISSION_FOR_ACTION}>
            <Link
              to={
                editTest
                  ? getAddDataQualityTableTestPath(
                      ProfilerDashboardType.TABLE,
                      `${table.fullyQualifiedName}`
                    )
                  : '#'
              }>
              <Button
                className="tw-rounded"
                data-testid="profiler-add-table-test-btn"
                disabled={!editTest}
                type="primary">
                Add Test
              </Button>
            </Link>
          </Tooltip>
          {isSummary && (
            <Tooltip title={editTest ? 'Settings' : NO_PERMISSION_FOR_ACTION}>
              <Button
                ghost
                data-testid="profiler-setting-btn"
                disabled={!editTest}
                icon={
                  <SVGIcons
                    alt="setting"
                    className="mr-2"
                    icon={
                      editTest ? Icons.SETTINGS_PRIMERY : Icons.SETTINGS_GRAY
                    }
                  />
                }
                type="primary"
                onClick={() => handleSettingModal(true)}>
                Settings
              </Button>
            </Tooltip>
          )}
        </Space>
      </Row>

      {isUndefined(profile) && (
        <div className="tw-border tw-flex tw-items-center tw-border-warning tw-rounded tw-p-2 tw-mb-4">
          <NoDataIcon />
          <p className="tw-mb-0 tw-ml-2">
            Data Profiler is an optional configuration in Ingestion. Please
            enable the data profiler by following the documentation
            <Link
              className="tw-ml-1"
              target="_blank"
              to={{
                pathname:
                  'https://docs.open-metadata.org/openmetadata/ingestion/workflows/profiler',
              }}>
              here.
            </Link>
          </p>
        </div>
      )}

      <Row className="tw-rounded tw-border tw-p-4 tw-mb-4">
        {overallSummery.map((summery) => (
          <Col
            className="overall-summery-card"
            data-testid={`header-card-${summery.title}`}
            key={summery.title}
            span={4}>
            <p className="overall-summery-card-title tw-font-medium tw-text-grey-muted tw-mb-1">
              {summery.title}
            </p>
            <p
              className={classNames(
                'tw-text-2xl tw-font-semibold',
                summery.className
              )}>
              {summery.value}
            </p>
          </Col>
        ))}
      </Row>

      {isSummary && (
        <ColumnProfileTable
          columnTests={columnTests}
          columns={columns.map((col) => ({
            ...col,
            key: col.name,
          }))}
          hasEditAccess={editTest}
        />
      )}

      {isDataQuality && (
        <DataQualityTab
          hasAccess={permissions.EditAll}
          testCases={getFilterTestCase()}
          onTestUpdate={fetchAllTests}
        />
      )}

      {settingModalVisible && (
        <ProfilerSettingsModal
          columns={columns}
          tableId={table.id}
          visible={settingModalVisible}
          onVisibilityChange={handleSettingModal}
        />
      )}
    </div>
  );
};

export default TableProfilerV1;
