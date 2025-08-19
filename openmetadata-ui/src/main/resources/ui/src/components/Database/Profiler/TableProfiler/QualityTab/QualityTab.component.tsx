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
import { Button, Col, Dropdown, Form, Row, Space, Tabs } from 'antd';
import { isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as SettingIcon } from '../../../../../assets/svg/ic-settings-primery.svg';
import { INITIAL_PAGING_VALUE } from '../../../../../constants/constants';
import { PAGE_HEADERS } from '../../../../../constants/PageHeaders.constant';
import {
    DEFAULT_SORT_ORDER,
    TEST_CASE_STATUS_OPTION,
    TEST_CASE_TYPE_OPTION
} from '../../../../../constants/profiler.constant';
import { INITIAL_TEST_SUMMARY } from '../../../../../constants/TestSuite.constant';
import { useLimitStore } from '../../../../../context/LimitsProvider/useLimitsStore';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../../../enums/entity.enum';
import { TestCaseType } from '../../../../../enums/TestSuite.enum';
import { Operation } from '../../../../../generated/entity/policies/policy';
import { PipelineType } from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCaseStatus } from '../../../../../generated/tests/testCase';
import LimitWrapper from '../../../../../hoc/LimitWrapper';
import useCustomLocation from '../../../../../hooks/useCustomLocation/useCustomLocation';
import { getIngestionPipelines } from '../../../../../rest/ingestionPipelineAPI';
import { ListTestCaseParamsBySearch } from '../../../../../rest/testAPI';
import {
    getBreadcrumbForTable,
    getEntityName
} from '../../../../../utils/EntityUtils';
import { getPrioritizedEditPermission } from '../../../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../../../utils/RouterUtils';
import { Select, Tooltip } from '../../../../common/AntdCompat';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../../../common/NextPrevious/NextPrevious';
import { NextPreviousProps } from '../../../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../../../common/SearchBarComponent/SearchBar.component';
import TabsLabel from '../../../../common/TabsLabel/TabsLabel.component';
import { TestLevel } from '../../../../DataQuality/AddDataQualityTest/components/TestCaseFormV1.interface';
import { SummaryPanel } from '../../../../DataQuality/SummaryPannel/SummaryPanel.component';
import TestSuitePipelineTab from '../../../../DataQuality/TestSuite/TestSuitePipelineTab/TestSuitePipelineTab.component';
import PageHeader from '../../../../PageHeader/PageHeader.component';
import DataQualityTab from '../../DataQualityTab/DataQualityTab';
import { TableProfilerTab } from '../../ProfilerDashboard/profilerDashboard.interface';
import { useTableProfiler } from '../TableProfilerProvider';
;

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
    onSettingButtonClick,
    onTestCaseDrawerOpen,
  } = useTableProfiler();
  const { getResourceLimit } = useLimitStore();

  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
  } = testCasePaging;

  const { editTest, editDataProfile } = useMemo(() => {
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

  const [selectedTestCaseStatus, setSelectedTestCaseStatus] =
    useState<TestCaseStatus>('' as TestCaseStatus);
  const [selectedTestType, setSelectedTestType] = useState(TestCaseType.all);
  const [searchValue, setSearchValue] = useState<string>();
  const [sortOptions, setSortOptions] =
    useState<ListTestCaseParamsBySearch>(DEFAULT_SORT_ORDER);
  const testSuite = useMemo(() => table?.testSuite, [table]);
  const [ingestionPipelineCount, setIngestionPipelineCount] =
    useState<number>(0);

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
        children: (
          <Row className="p-t-md">
            <Col span={12}>
              <Searchbar
                placeholder={t('label.search-entity', {
                  entity: t('label.test-case-lowercase'),
                })}
                searchValue={searchValue}
                onSearch={handleSearchTestCase}
              />
            </Col>
            <Col span={24}>
              <DataQualityTab
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
        ),
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
        children: <TestSuitePipelineTab testSuite={testSuite} />,
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

  const handleAddTestClick = (type: TestLevel) => {
    onTestCaseDrawerOpen(type);
  };

  const handleTabChange = () => {
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
      },
      { state: undefined, replace: true }
    );
  };

  const addButtonContent = useMemo(
    () => [
      {
        label: <TabsLabel id="table" name={t('label.table')} />,
        key: '1',
        onClick: () => handleAddTestClick(TestLevel.TABLE),
      },
      {
        label: <TabsLabel id="column" name={t('label.column')} />,
        key: '2',
        onClick: () => handleAddTestClick(TestLevel.COLUMN),
      },
    ],
    []
  );

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
    <Row className="quality-tab-container" gutter={[0, 16]}>
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
                    <LimitWrapper resource="dataQuality">
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
                    </LimitWrapper>
                  </Form.Item>
                )}

                {editDataProfile && (
                  <Tooltip
                    placement="topRight"
                    title={t('label.setting-plural')}>
                    <Button
                      className="flex-center"
                      data-testid="profiler-setting-btn"
                      onClick={onSettingButtonClick}>
                      <SettingIcon />
                    </Button>
                  </Tooltip>
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
        <Tabs className="tabs-new" items={tabs} onChange={handleTabChange} />
      </Col>
    </Row>
  );
};
