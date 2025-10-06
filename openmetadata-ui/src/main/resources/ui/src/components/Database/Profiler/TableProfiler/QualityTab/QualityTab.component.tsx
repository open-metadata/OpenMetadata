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
import { Box, Grid, Stack, Tab, Tabs, useTheme } from '@mui/material';
import { Col, Form, Row, Select, Space } from 'antd';
import { isEmpty } from 'lodash';
import QueryString from 'qs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as AddItemIcon } from '../../../../../assets/svg/add-item-icon.svg';
import { ReactComponent as RedCircleIcon } from '../../../../../assets/svg/red-circle-with-dash.svg';
import { ReactComponent as SuccessTicketIcon } from '../../../../../assets/svg/success-ticket-with-check.svg';
import { ReactComponent as YellowCalendarIcon } from '../../../../../assets/svg/yellow-calendar.icon.svg';
import { INITIAL_PAGING_VALUE } from '../../../../../constants/constants';
import {
  DEFAULT_SORT_ORDER,
  TEST_CASE_STATUS_OPTION,
  TEST_CASE_TYPE_OPTION,
} from '../../../../../constants/profiler.constant';
import { INITIAL_TEST_SUMMARY } from '../../../../../constants/TestSuite.constant';
import { useLimitStore } from '../../../../../context/LimitsProvider/useLimitsStore';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../../../enums/entity.enum';
import { TestCaseType } from '../../../../../enums/TestSuite.enum';
import { Operation } from '../../../../../generated/entity/policies/policy';
import { PipelineType } from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCaseStatus } from '../../../../../generated/tests/testCase';
import useCustomLocation from '../../../../../hooks/useCustomLocation/useCustomLocation';
import { getIngestionPipelines } from '../../../../../rest/ingestionPipelineAPI';
import { ListTestCaseParamsBySearch } from '../../../../../rest/testAPI';
import {
  getBreadcrumbForTable,
  getEntityName,
} from '../../../../../utils/EntityUtils';
import { getPrioritizedEditPermission } from '../../../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../../../utils/RouterUtils';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../../../common/NextPrevious/NextPrevious';
import { NextPreviousProps } from '../../../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../../../common/SearchBarComponent/SearchBar.component';
import SummaryCardV1 from '../../../../common/SummaryCard/SummaryCardV1';
import TabsLabel from '../../../../common/TabsLabel/TabsLabel.component';
import TestSuitePipelineTab from '../../../../DataQuality/TestSuite/TestSuitePipelineTab/TestSuitePipelineTab.component';
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
    testCasePaging,
    table,
    testCaseSummary,
  } = useTableProfiler();
  const { getResourceLimit } = useLimitStore();
  const theme = useTheme();

  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
  } = testCasePaging;

  const { editTest } = useMemo(() => {
    return {
      editTest:
        permissions &&
        getPrioritizedEditPermission(permissions, Operation.EditTests),
      editDataProfile:
        permissions &&
        getPrioritizedEditPermission(permissions, Operation.EditDataProfile),
    };
  }, [permissions, getPrioritizedEditPermission]);

  const navigate = useNavigate();
  const location = useCustomLocation();
  const { t } = useTranslation();

  const searchData = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as {
      activeTab: TableProfilerTab;
      activeColumnFqn: string;
      qualityTab: string;
    };
  }, [location.search]);

  const { qualityTab = EntityTabs.TEST_CASES } = searchData;

  const isTestCaseTab = useMemo(
    () => qualityTab === EntityTabs.TEST_CASES,
    [qualityTab]
  );

  const [selectedTestCaseStatus, setSelectedTestCaseStatus] =
    useState<TestCaseStatus>('' as TestCaseStatus);
  const [selectedTestType, setSelectedTestType] = useState(TestCaseType.all);
  const [searchValue, setSearchValue] = useState<string>();
  const [sortOptions, setSortOptions] =
    useState<ListTestCaseParamsBySearch>(DEFAULT_SORT_ORDER);
  const testSuite = useMemo(() => table?.testSuite, [table]);
  const [ingestionPipelineCount, setIngestionPipelineCount] =
    useState<number>(0);

  const totalTestCaseSummary = useMemo(() => {
    const tests = testCaseSummary?.total ?? INITIAL_TEST_SUMMARY;

    return [
      {
        title: t('label.test-plural-type', { type: t('label.total') }),
        key: 'total-tests',
        value: tests.total,
        icon: AddItemIcon,
      },
      {
        title: t('label.test-plural-type', { type: t('label.successful') }),
        key: 'successful-tests',
        value: tests.success,
        icon: SuccessTicketIcon,
      },
      {
        title: t('label.test-plural-type', { type: t('label.failed') }),
        key: 'failed-tests',
        value: tests.failed,
        icon: RedCircleIcon,
      },
      {
        title: t('label.test-plural-type', { type: t('label.aborted') }),
        key: 'aborted-tests',
        value: tests.aborted,
        icon: YellowCalendarIcon,
      },
    ];
  }, [testCaseSummary]);

  const fetchIngestionPipelineCount = async () => {
    try {
      const { paging: ingestionPipelinePaging } = await getIngestionPipelines({
        arrQueryFields: [],
        testSuite: testSuite?.fullyQualifiedName ?? '',
        pipelineType: [PipelineType.TestSuite],
        limit: 0,
      });
      setIngestionPipelineCount(ingestionPipelinePaging.total);
    } catch (error) {
      // do nothing for count error
    }
  };

  useEffect(() => {
    if (testSuite?.fullyQualifiedName) {
      fetchIngestionPipelineCount();
    }
  }, [testSuite?.fullyQualifiedName]);

  const handleTestCasePageChange: NextPreviousProps['pagingHandler'] = ({
    currentPage,
  }) => {
    if (currentPage) {
      fetchAllTests({
        ...sortOptions,
        testCaseType: selectedTestType,
        testCaseStatus: isEmpty(selectedTestCaseStatus)
          ? undefined
          : selectedTestCaseStatus,
        offset: (currentPage - 1) * pageSize,
      });
    }
    handlePageChange(currentPage);
  };

  const handleSearchTestCase = (value?: string) => {
    setSearchValue(value);
    fetchAllTests({
      testCaseType: selectedTestType,
      testCaseStatus: isEmpty(selectedTestCaseStatus)
        ? undefined
        : selectedTestCaseStatus,
      q: value,
    });
  };

  const handleSortTestCase = async (apiParams?: ListTestCaseParamsBySearch) => {
    setSortOptions(apiParams ?? DEFAULT_SORT_ORDER);
    await fetchAllTests({ ...(apiParams ?? DEFAULT_SORT_ORDER), offset: 0 });
    handlePageChange(INITIAL_PAGING_VALUE);
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

  const tabs = useMemo(
    () => [
      {
        label: (
          <TabsLabel
            count={paging.total}
            id={EntityTabs.TEST_CASES}
            name={t('label.test-case-plural')}
          />
        ),
        key: EntityTabs.TEST_CASES,
      },
      {
        label: (
          <TabsLabel
            count={ingestionPipelineCount}
            id={EntityTabs.PIPELINE}
            name={t('label.pipeline-plural')}
          />
        ),
        key: EntityTabs.PIPELINE,
      },
    ],
    [
      isTestsLoading,
      allTestCases,
      onTestCaseUpdate,
      testSuite,
      fetchAllTests,
      getResourceLimit,
      tableBreadcrumb,
      testCasePaging,
      ingestionPipelineCount,
    ]
  );

  const handleTabChange = (_: React.SyntheticEvent, tab: string) => {
    navigate(
      {
        pathname: location.pathname,
        search: QueryString.stringify({ ...searchData, qualityTab: tab }),
      },
      { state: undefined, replace: true }
    );
  };

  if (permissions && !permissions?.ViewTests) {
    return (
      <ErrorPlaceHolder
        permissionValue={t('label.view-entity', {
          entity: t('label.data-observability'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <Stack className="quality-tab-container" spacing="30px">
      <Grid container spacing={5}>
        {totalTestCaseSummary?.map((summary) => (
          <Grid key={summary.title} size="grow">
            <SummaryCardV1
              icon={summary.icon}
              isLoading={isTestsLoading}
              title={summary.title}
              value={summary.value}
            />
          </Grid>
        ))}
      </Grid>

      <Box
        sx={{
          border: `1px solid ${theme.palette.grey['200']}`,
          borderRadius: '10px',
        }}>
        <Box
          alignItems="center"
          display="flex"
          justifyContent="space-between"
          p={4}>
          <Box display="flex" gap={5} width="100%">
            <Tabs
              sx={{
                width: 'max-content',
                minHeight: 'unset',
                display: 'inline-flex',
                '.MuiTab-root': {
                  color: theme.palette.grey['700'],
                  transition:
                    'background-color 0.2s ease-in, color 0.2s ease-in',
                  borderRadius: '6px',
                },
                '.Mui-selected, .MuiTab-root:hover': {
                  backgroundColor: `${theme.palette.grey['50']}`,
                  color: `${theme.palette.grey['800']}`,
                },
                'MuiTabs-root': {
                  minHeight: 'unset',
                },
                '.MuiTabs-indicator': {
                  display: 'none',
                },
                '.MuiTabs-scroller': {
                  padding: '0px',
                  height: 'unset',
                },
                '.MuiTab-root:not(:first-of-type)': {
                  marginLeft: '0px',
                  borderLeft: `1px solid ${theme.palette.grey['200']}`,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                },
              }}
              value={qualityTab}
              onChange={handleTabChange}>
              {tabs.map(({ label, key }) => (
                <Tab key={key} label={label} value={key} />
              ))}
            </Tabs>

            {isTestCaseTab && (
              <Box width={400}>
                <Searchbar
                  removeMargin
                  placeholder={t('label.search-entity', {
                    entity: t('label.test-case-lowercase'),
                  })}
                  searchValue={searchValue}
                  onSearch={handleSearchTestCase}
                />
              </Box>
            )}
          </Box>

          {isTestCaseTab && (
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
              </Space>
            </Form>
          )}
        </Box>

        {isTestCaseTab && (
          <Row>
            <Col span={24}>
              <DataQualityTab
                removeTableBorder
                afterDeleteAction={async (...params) => {
                  await fetchAllTests(...params); // Update current count when Create / Delete operation performed
                  params?.length &&
                    (await getResourceLimit('dataQuality', true, true));
                }}
                breadcrumbData={tableBreadcrumb}
                fetchTestCases={handleSortTestCase}
                isEditAllowed={editTest}
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
                  isNumberBased
                  currentPage={currentPage}
                  isLoading={isTestsLoading}
                  pageSize={pageSize}
                  paging={paging}
                  pagingHandler={handleTestCasePageChange}
                  onShowSizeChange={handlePageSizeChange}
                />
              )}
            </Col>
          </Row>
        )}

        {qualityTab === EntityTabs.PIPELINE && (
          <TestSuitePipelineTab testSuite={testSuite} />
        )}
      </Box>
    </Stack>
  );
};
