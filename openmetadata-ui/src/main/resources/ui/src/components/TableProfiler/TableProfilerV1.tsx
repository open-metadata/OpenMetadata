/*
 *  Copyright 2022 Collate.
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
import {
  Button,
  Col,
  Dropdown,
  Form,
  Menu,
  MenuProps,
  Row,
  Select,
  Space,
  Tooltip,
} from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import {
  filter,
  find,
  groupBy,
  isEmpty,
  isEqual,
  isUndefined,
  map,
  toLower,
} from 'lodash';
import { DateTime } from 'luxon';
import Qs from 'qs';
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import { ReactComponent as ColumnProfileIcon } from '../../assets/svg/column-profile.svg';
import { ReactComponent as DataQualityIcon } from '../../assets/svg/data-quality.svg';
import { ReactComponent as DropDownIcon } from '../../assets/svg/DropDown.svg';
import { ReactComponent as SettingIcon } from '../../assets/svg/ic-settings-primery.svg';
import { ReactComponent as NoDataIcon } from '../../assets/svg/no-data-icon.svg';
import { ReactComponent as TableProfileIcon } from '../../assets/svg/table-profile.svg';
import { SummaryCard } from '../../components/common/SummaryCard/SummaryCard.component';
import { SummaryCardProps } from '../../components/common/SummaryCard/SummaryCard.interface';
import DatePickerMenu from '../../components/DatePickerMenu/DatePickerMenu.component';
import { DateRangeObject } from '../../components/ProfilerDashboard/component/TestSummary';
import TabsLabel from '../../components/TabsLabel/TabsLabel.component';
import { useTourProvider } from '../../components/TourProvider/TourProvider';
import { API_RES_MAX_SIZE } from '../../constants/constants';
import { mockDatasetData } from '../../constants/mockTourData.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import {
  DEFAULT_RANGE_DATA,
  INITIAL_TEST_RESULT_SUMMARY,
} from '../../constants/profiler.constant';
import { TabSpecificField } from '../../enums/entity.enum';
import { ProfilerDashboardType } from '../../enums/table.enum';
import { Column } from '../../generated/entity/data/container';
import { ProfileSampleType, Table } from '../../generated/entity/data/table';
import { TestCase, TestCaseStatus } from '../../generated/tests/testCase';
import { EntityType as TestType } from '../../generated/tests/testDefinition';
import {
  getLatestTableProfileByFqn,
  getTableDetailsByFQN,
} from '../../rest/tableAPI';
import { getListTestCase, ListTestCaseParams } from '../../rest/testAPI';
import { updateTestResults } from '../../utils/DataQualityAndProfilerUtils';
import { getAddDataQualityTableTestPath } from '../../utils/RouterUtils';
import { bytesToSize, getDecodedFqn } from '../../utils/StringsUtils';
import { generateEntityLink } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import PageHeader from '../header/PageHeader.component';
import { TableProfilerTab } from '../ProfilerDashboard/profilerDashboard.interface';
import ColumnPickerMenu from './Component/ColumnPickerMenu';
import ColumnProfileTable from './Component/ColumnProfileTable';
import ColumnSummary from './Component/ColumnSummary';
import ProfilerSettingsModal from './Component/ProfilerSettingsModal';
import TableProfilerChart from './Component/TableProfilerChart';
import { QualityTab } from './QualityTab/QualityTab.component';
import {
  OverallTableSummeryType,
  TableProfilerProps,
  TableTestsType,
} from './TableProfiler.interface';
import './tableProfiler.less';

const TableProfilerV1: FC<TableProfilerProps> = ({
  isTableDeleted,
  permissions,
}: TableProfilerProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const { isTourOpen } = useTourProvider();

  const {
    activeTab = isTourOpen
      ? TableProfilerTab.COLUMN_PROFILE
      : TableProfilerTab.TABLE_PROFILE,
    activeColumnFqn,
  } = useMemo(() => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeTab: string; activeColumnFqn: string };
  }, [location.search, isTourOpen]);

  const { fqn: datasetFQN } = useParams<{ fqn: string }>();
  const [table, setTable] = useState<Table>();
  const { profile, columns } = useMemo(() => {
    return { profile: table?.profile, columns: table?.columns || [] };
  }, [table]);
  const [settingModalVisible, setSettingModalVisible] = useState(false);
  const allTests = useRef<TestCase[]>([]);
  const [columnTests, setColumnTests] = useState<TestCase[]>([]);
  const [tableTests, setTableTests] = useState<TableTestsType>({
    tests: [],
    results: INITIAL_TEST_RESULT_SUMMARY,
  });

  const [selectedTestCaseStatus, setSelectedTestCaseStatus] =
    useState<string>('');
  const [selectedTestType, setSelectedTestType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [dateRangeObject, setDateRangeObject] =
    useState<DateRangeObject>(DEFAULT_RANGE_DATA);
  const [testSuite, setTestSuite] = useState<Table['testSuite']>();
  const [isTestsLoading, setIsTestsLoading] = useState(false);
  const [isProfilerDataLoading, setIsProfilerDataLoading] = useState(false);

  const isColumnProfile = activeTab === TableProfilerTab.COLUMN_PROFILE;
  const isDataQuality = activeTab === TableProfilerTab.DATA_QUALITY;
  const isTableProfile = activeTab === TableProfilerTab.TABLE_PROFILE;

  const updateActiveTab = (key: string) =>
    history.push({ search: Qs.stringify({ activeTab: key }) });

  const testCaseStatusOption = useMemo(() => {
    const testCaseStatus: DefaultOptionType[] = Object.values(
      TestCaseStatus
    ).map((value) => ({
      label: value,
      value: value,
    }));
    testCaseStatus.unshift({
      label: t('label.all'),
      value: '',
    });

    return testCaseStatus;
  }, []);

  const getPageHeader = useMemo(() => {
    if (isTableProfile) {
      return PAGE_HEADERS.TABLE_PROFILE;
    } else if (isDataQuality) {
      return PAGE_HEADERS.DATA_QUALITY;
    } else {
      return {
        ...PAGE_HEADERS.COLUMN_PROFILE,
        header: isEmpty(activeColumnFqn) ? (
          PAGE_HEADERS.COLUMN_PROFILE.header
        ) : (
          <Button
            className="p-0 text-md font-medium"
            type="link"
            onClick={() => updateActiveTab(TableProfilerTab.COLUMN_PROFILE)}>
            <Space>
              <DropDownIcon className="transform-90" height={16} width={16} />
              {PAGE_HEADERS.COLUMN_PROFILE.header}
            </Space>
          </Button>
        ),
      };
    }
  }, [isTableProfile, isDataQuality, activeColumnFqn]);

  const testCaseTypeOption = useMemo(() => {
    const testCaseStatus: DefaultOptionType[] = map(TestType, (value, key) => ({
      label: key,
      value: value,
    }));
    testCaseStatus.unshift({
      label: t('label.all'),
      value: '',
    });

    return testCaseStatus;
  }, []);

  const viewTest =
    permissions.ViewAll || permissions.ViewBasic || permissions.ViewTests;
  const viewProfiler =
    permissions.ViewAll || permissions.ViewBasic || permissions.ViewDataProfile;
  const editTest = permissions.EditAll || permissions.EditTests;
  const editDataProfile = permissions.EditAll || permissions.EditDataProfile;

  const handleSettingModal = (value: boolean) => {
    setSettingModalVisible(value);
  };

  const getProfileSampleValue = () => {
    let value;
    if (profile?.profileSampleType === ProfileSampleType.Percentage) {
      value = `${profile?.profileSample ?? 100}%`;
    } else if (profile?.profileSampleType === ProfileSampleType.Rows) {
      value = `${profile?.profileSample} ${
        profile?.profileSampleType.toString().length > 1
          ? t('label.row-plural')
          : t('label.row')
      } `;
    } else {
      value = '100%';
    }

    return value;
  };

  const overallSummery: OverallTableSummeryType[] = useMemo(() => {
    return [
      {
        title: t('label.entity-count', {
          entity: t('label.row'),
        }),
        value: profile?.rowCount ?? 0,
      },
      {
        title: t('label.column-entity', {
          entity: t('label.count'),
        }),
        value: profile?.columnCount ?? table?.columns.length ?? 0,
      },
      {
        title: `${t('label.profile-sample-type', { type: '' })}`,
        value: getProfileSampleValue(),
      },
      {
        title: t('label.size'),
        value: bytesToSize(profile?.sizeInByte ?? 0),
      },
      {
        title: t('label.created-date'),
        value: profile?.createDateTime
          ? DateTime.fromJSDate(new Date(profile?.createDateTime))
              .toUTC()
              .toFormat('MMM dd, yyyy HH:mm')
          : '--',
      },
    ];
  }, [profile, tableTests]);

  const tabOptions = [
    {
      label: t('label.table-entity-text', {
        entityText: t('label.profile'),
      }),
      key: TableProfilerTab.TABLE_PROFILE,
      disabled: !viewProfiler,
      icon: <TableProfileIcon />,
    },
    {
      label: t('label.column-entity', {
        entity: t('label.profile'),
      }),
      key: TableProfilerTab.COLUMN_PROFILE,
      disabled: !viewProfiler,
      icon: <ColumnProfileIcon />,
    },
    {
      label: t('label.data-entity', {
        entity: t('label.quality'),
      }),
      key: TableProfilerTab.DATA_QUALITY,
      disabled: !viewTest,
      icon: <DataQualityIcon />,
    },
  ];

  const handleAddTestClick = (type: ProfilerDashboardType) => {
    history.push(
      getAddDataQualityTableTestPath(
        type,
        `${getDecodedFqn(datasetFQN) ?? table?.fullyQualifiedName}`
      )
    );
  };

  const addButtonContent = [
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
  ];

  const updateActiveColumnFqn = (key: string) =>
    history.push({ search: Qs.stringify({ activeColumnFqn: key, activeTab }) });

  const handleTabChange: MenuProps['onClick'] = (value) => {
    updateActiveTab(value.key);
  };

  useEffect(() => {
    if (isUndefined(activeTab)) {
      updateActiveTab(
        isTourOpen
          ? TableProfilerTab.COLUMN_PROFILE
          : TableProfilerTab.TABLE_PROFILE
      );
    }
  }, [isTourOpen]);

  const handleResultUpdate = (testCase: TestCase) => {
    setTableTests((prev) => {
      const tests = prev.tests.map((test) => {
        if (test.fullyQualifiedName === testCase.fullyQualifiedName) {
          return testCase;
        }

        return test;
      });

      return {
        ...prev,
        tests,
      };
    });
  };

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, dateRangeObject)) {
      setDateRangeObject(value);
    }
  };

  const splitTableAndColumnTest = (data: TestCase[]) => {
    const columnTestsCase: TestCase[] = [];
    const tableTests: TableTestsType = {
      tests: [],
      results: { ...INITIAL_TEST_RESULT_SUMMARY },
    };
    data.forEach((test) => {
      if (test.entityFQN === table?.fullyQualifiedName) {
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
  };

  const fetchAllTests = async (params?: ListTestCaseParams) => {
    setIsTestsLoading(true);
    try {
      const { data } = await getListTestCase({
        ...params,
        fields: 'testCaseResult, testDefinition',
        entityLink: generateEntityLink(getDecodedFqn(datasetFQN) || ''),
        includeAllTests: true,
        limit: API_RES_MAX_SIZE,
      });
      allTests.current = data;
      splitTableAndColumnTest(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTestsLoading(false);
    }
  };

  const handleTestUpdate = useCallback((testCase?: TestCase) => {
    if (isUndefined(testCase)) {
      return;
    }
    const updatedTests = allTests.current.map((test) => {
      return testCase.id === test.id ? { ...test, ...testCase } : test;
    });
    splitTableAndColumnTest(updatedTests);
    allTests.current = updatedTests;
  }, []);

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

  const filteredTestCase = useMemo(() => {
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
  }, [tableTests, columnTests, selectedTestCaseStatus]);

  const fetchLatestProfilerData = async () => {
    // As we are encoding the fqn in API function to apply all over the application
    // and the datasetFQN comes form url parameter which is already encoded,
    // we are decoding FQN below to avoid double encoding in the API function
    const decodedDatasetFQN = decodeURIComponent(datasetFQN);
    setIsProfilerDataLoading(true);
    try {
      const response = await getLatestTableProfileByFqn(decodedDatasetFQN);
      setTable(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsProfilerDataLoading(false);
    }
  };

  const selectedColumn = useMemo(() => {
    return find(
      columns,
      (column: Column) => column.fullyQualifiedName === activeColumnFqn
    );
  }, [columns, activeColumnFqn]);

  const selectedColumnTestsObj = useMemo(() => {
    const temp = filter(
      columnTests,
      (test: TestCase) => test.entityFQN === activeColumnFqn
    );

    const statusDict = {
      [TestCaseStatus.Success]: [],
      [TestCaseStatus.Aborted]: [],
      [TestCaseStatus.Failed]: [],
      ...groupBy(temp, 'testCaseResult.testCaseStatus'),
    };

    return { statusDict, totalTests: temp.length };
  }, [activeColumnFqn, columnTests]);

  const fetchTestSuiteDetails = async () => {
    setIsLoading(true);
    try {
      const details = await getTableDetailsByFQN(
        datasetFQN,
        TabSpecificField.TESTSUITE
      );
      setTestSuite(details.testSuite);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (isDataQuality && isUndefined(testSuite)) {
      fetchTestSuiteDetails();
    } else {
      setIsLoading(false);
    }
  }, [isDataQuality, testSuite]);

  useEffect(() => {
    const fetchTest =
      viewTest && !isTourOpen && !isTableProfile && isEmpty(allTests.current);

    if (fetchTest) {
      fetchAllTests();
    }
  }, [viewTest, isTourOpen, isTableProfile]);

  useEffect(() => {
    const fetchProfiler =
      !isTableDeleted &&
      datasetFQN &&
      !isTourOpen &&
      (isTableProfile || isColumnProfile) &&
      isUndefined(table);

    if (fetchProfiler) {
      fetchLatestProfilerData();
    } else {
      setIsLoading(false);
    }
    if (isTourOpen) {
      setTable(mockDatasetData.tableDetails as unknown as Table);
    }
  }, [datasetFQN, isTourOpen, isTableProfile, isColumnProfile]);

  return (
    <Row
      className="table-profiler-container h-full flex-grow"
      data-testid="table-profiler-container"
      gutter={[16, 16]}
      id="profilerDetails">
      <Col className="p-t-sm data-quality-left-panel" span={4}>
        <Menu
          className="h-full p-x-0 custom-menu"
          data-testid="profiler-tab-left-panel"
          items={tabOptions}
          mode="inline"
          selectedKeys={[activeTab ?? TableProfilerTab.TABLE_PROFILE]}
          onClick={handleTabChange}
        />
      </Col>
      <Col className="data-quality-content-panel" span={20}>
        <Space
          className="w-full h-min-full p-sm"
          direction="vertical"
          size={16}>
          <Row>
            <Col span={10}>
              <PageHeader data={getPageHeader} />
            </Col>
            <Col span={14}>
              <Space align="center" className="w-full justify-end">
                {isDataQuality && (
                  <>
                    <Form.Item className="m-0 w-40" label={t('label.type')}>
                      <Select
                        options={testCaseTypeOption}
                        value={selectedTestType}
                        onChange={handleTestCaseTypeChange}
                      />
                    </Form.Item>
                    <Form.Item className="m-0 w-40" label={t('label.status')}>
                      <Select
                        options={testCaseStatusOption}
                        value={selectedTestCaseStatus}
                        onChange={handleTestCaseStatusChange}
                      />
                    </Form.Item>
                  </>
                )}

                {(isTableProfile || !isEmpty(activeColumnFqn)) && (
                  <DatePickerMenu
                    showSelectedCustomRange
                    handleDateRangeChange={handleDateRangeChange}
                  />
                )}
                {!isEmpty(activeColumnFqn) && (
                  <ColumnPickerMenu
                    activeColumnFqn={activeColumnFqn}
                    columns={columns}
                    handleChange={updateActiveColumnFqn}
                  />
                )}

                {editTest && (
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
                )}

                {editDataProfile && !isDataQuality && (
                  <Tooltip
                    placement="topRight"
                    title={t('label.setting-plural')}>
                    <Button
                      className="flex-center"
                      data-testid="profiler-setting-btn"
                      onClick={() => handleSettingModal(true)}>
                      <SettingIcon />
                    </Button>
                  </Tooltip>
                )}
              </Space>
            </Col>
          </Row>

          {isUndefined(profile) && !isDataQuality && (
            <div
              className="border d-flex items-center border-warning rounded-4 p-xs m-b-md"
              data-testid="no-profiler-placeholder">
              <NoDataIcon />
              <p className="m-l-xs">
                {t('message.no-profiler-message')}
                <Link
                  target="_blank"
                  to={{
                    pathname:
                      'https://docs.open-metadata.org/connectors/ingestion/workflows/profiler',
                  }}>
                  {`${t('label.here-lowercase')}.`}
                </Link>
              </p>
            </div>
          )}

          <Row gutter={[16, 16]}>
            {!isUndefined(selectedColumn) && (
              <Col span={10}>
                <ColumnSummary column={selectedColumn} />
              </Col>
            )}
            {!isDataQuality && (
              <Col span={selectedColumn ? 14 : 24}>
                <Row
                  wrap
                  className={classNames(
                    activeColumnFqn ? 'justify-start' : 'justify-between'
                  )}
                  gutter={[16, 16]}>
                  {overallSummery.map((summery) => (
                    <Col key={summery.title}>
                      <SummaryCard
                        className={classNames(summery.className, 'h-full')}
                        isLoading={isLoading}
                        showProgressBar={false}
                        title={summery.title}
                        total={0}
                        value={summery.value}
                      />
                    </Col>
                  ))}
                  {!isEmpty(activeColumnFqn) &&
                    map(selectedColumnTestsObj.statusDict, (data, key) => (
                      <Col key={key}>
                        <SummaryCard
                          showProgressBar
                          isLoading={isLoading}
                          title={key}
                          total={selectedColumnTestsObj.totalTests}
                          type={toLower(key) as SummaryCardProps['type']}
                          value={data.length}
                        />
                      </Col>
                    ))}
                </Row>
              </Col>
            )}
          </Row>

          {isColumnProfile && (
            <ColumnProfileTable
              columnTests={columnTests}
              columns={columns.map((col) => ({
                ...col,
                key: col.name,
              }))}
              dateRangeObject={dateRangeObject}
              hasEditAccess={editTest}
              isLoading={isProfilerDataLoading || isLoading}
            />
          )}

          {isDataQuality && (
            <QualityTab
              afterDeleteAction={fetchAllTests}
              isLoading={isTestsLoading || isLoading}
              showTableColumn={false}
              testCases={filteredTestCase}
              testSuite={testSuite}
              onTestCaseResultUpdate={handleResultUpdate}
              onTestUpdate={handleTestUpdate}
            />
          )}

          {isTableProfile && (
            <TableProfilerChart dateRangeObject={dateRangeObject} />
          )}

          {settingModalVisible && (
            <ProfilerSettingsModal
              columns={columns}
              tableId={table?.id || ''}
              visible={settingModalVisible}
              onVisibilityChange={handleSettingModal}
            />
          )}
        </Space>
      </Col>
    </Row>
  );
};

export default TableProfilerV1;
