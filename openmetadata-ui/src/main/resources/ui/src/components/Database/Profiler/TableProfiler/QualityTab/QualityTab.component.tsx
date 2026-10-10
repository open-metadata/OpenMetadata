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
import {
  Box,
  Select,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import QueryString from 'qs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as AbortedTestIcon } from '../../../../../assets/svg/data-observability/aborted-test.svg';
import { ReactComponent as FailedTestIcon } from '../../../../../assets/svg/data-observability/failed-test.svg';
import { ReactComponent as SuccessTestIcon } from '../../../../../assets/svg/data-observability/success-test.svg';
import { ReactComponent as TotalTestIcon } from '../../../../../assets/svg/data-observability/total-test.svg';
import { INITIAL_PAGING_VALUE } from '../../../../../constants/constants';
import {
  DEFAULT_SORT_ORDER,
  TEST_CASE_STATUS_OPTION,
  TEST_CASE_TYPE_OPTION,
} from '../../../../../constants/profiler.constant';
import { INITIAL_TEST_SUMMARY } from '../../../../../constants/TestSuite.constant';
import { useLimitStore } from '../../../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../../enums/permissions.enum';
import { TestCaseType } from '../../../../../enums/TestSuite.enum';
import { Operation } from '../../../../../generated/entity/policies/policy';
import { PipelineType } from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCaseStatus } from '../../../../../generated/tests/testCase';
import useCustomLocation from '../../../../../hooks/useCustomLocation/useCustomLocation';
import { getIngestionPipelines } from '../../../../../rest/ingestionPipelineAPI';
import { ListTestCaseParamsBySearch } from '../../../../../rest/testAPI';
import { getBreadcrumbForTable } from '../../../../../utils/EntityDataBreadcrumbUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../../utils/PermissionDerivation';
import { checkPermission } from '../../../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../../../utils/RouterUtils';
import { getTestCaseManageMenuItems } from '../../../../../utils/TestCaseUtils';
import ManageButton from '../../../../common/EntityPageInfos/ManageButton/ManageButton';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { NextPreviousProps } from '../../../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../../../common/SearchBarComponent/SearchBar.component';
import SummaryCardV1 from '../../../../common/SummaryCard/SummaryCardV1';
import TabsLabel from '../../../../common/TabsLabel/TabsLabel.component';
import TestSuitePipelineTab from '../../../../DataQuality/TestSuite/TestSuitePipelineTab/TestSuitePipelineTab.component';
import { useEntityExportModalProvider } from '../../../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import DataQualityTab from '../../DataQualityTab/DataQualityTab';
import {
  DataQualityTabProps,
  ProfilerTabPath,
} from '../../ProfilerDashboard/profilerDashboard.interface';
import { useTableProfiler } from '../TableProfilerProvider';

export const QualityTab = () => {
  const {
    permissions,
    fetchAllTests,
    onTestCaseUpdate,
    allTestCases,
    allTestCasesPermissions,
    isTestsLoading,
    testCasePaging,
    table,
    testCaseSummary,
  } = useTableProfiler();
  const { getResourceLimit } = useLimitStore();
  const { permissions: globalPermissions } = usePermissionProvider();

  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
  } = testCasePaging;

  const editTest = useMemo(
    () =>
      permissions &&
      getDerivedPermissionFlags(permissions).can(Operation.EditTests),
    [permissions]
  );

  const navigate = useNavigate();
  const location = useCustomLocation();
  const { t } = useTranslation();
  const originBreadcrumb = (
    location.state as {
      breadcrumbData?: DataQualityTabProps['breadcrumbData'];
    } | null
  )?.breadcrumbData;

  const searchData = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as {
      activeColumnFqn: string;
      qualityTab: string;
    };
  }, [location.search]);

  const { showModal } = useEntityExportModalProvider();

  const { qualityTab = EntityTabs.TEST_CASES } = searchData;

  const isTestCaseTab = useMemo(
    () => qualityTab === EntityTabs.TEST_CASES,
    [qualityTab]
  );

  const [selectedTestCaseStatus, setSelectedTestCaseStatus] = useState<
    TestCaseStatus | ''
  >('');
  const [selectedTestType, setSelectedTestType] = useState(TestCaseType.all);
  const [searchValue, setSearchValue] = useState<string>();
  const [sortOptions, setSortOptions] =
    useState<ListTestCaseParamsBySearch>(DEFAULT_SORT_ORDER);
  const testSuite = useMemo(() => table?.testSuite, [table]);
  const [ingestionPipelineCount, setIngestionPipelineCount] =
    useState<number>(0);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(searchValue) ||
      Boolean(selectedTestCaseStatus) ||
      selectedTestType !== TestCaseType.all,
    [searchValue, selectedTestCaseStatus, selectedTestType]
  );

  const totalTestCaseSummary = useMemo(() => {
    const tests = testCaseSummary?.total ?? INITIAL_TEST_SUMMARY;

    return [
      {
        title: t('label.test-plural-type', { type: t('label.total') }),
        key: 'total-tests',
        value: tests.total,
        icon: TotalTestIcon,
      },
      {
        title: t('label.test-plural-type', { type: t('label.successful') }),
        key: 'successful-tests',
        value: tests.success,
        icon: SuccessTestIcon,
      },
      {
        title: t('label.test-plural-type', { type: t('label.failed') }),
        key: 'failed-tests',
        value: tests.failed,
        icon: FailedTestIcon,
      },
      {
        title: t('label.test-plural-type', { type: t('label.aborted') }),
        key: 'aborted-tests',
        value: tests.aborted,
        icon: AbortedTestIcon,
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
    } catch {
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
    if (originBreadcrumb?.length) {
      return originBreadcrumb;
    }

    return table
      ? [
          ...getBreadcrumbForTable(table),
          {
            name: table.name,
            url: getEntityDetailsPath(
              EntityType.TABLE,
              table.fullyQualifiedName ?? '',
              EntityTabs.PROFILER,
              ProfilerTabPath.DATA_QUALITY
            ),
          },
        ]
      : undefined;
  }, [originBreadcrumb, table]);

  const handleTestCaseStatusChange = (value: TestCaseStatus | '') => {
    if (value !== selectedTestCaseStatus) {
      setSelectedTestCaseStatus(value);
      fetchAllTests({
        testCaseType: selectedTestType,
        testCaseStatus: isEmpty(value) ? undefined : value,
      });
    }
  };

  const extraDropdownContent = useMemo(() => {
    const bulkImportExportTestCasePermission = {
      ViewAll:
        checkPermission(
          Operation.ViewAll,
          ResourceEntity.TEST_CASE,
          globalPermissions
        ) ?? false,
      EditAll:
        checkPermission(
          Operation.EditAll,
          ResourceEntity.TEST_CASE,
          globalPermissions
        ) ?? false,
    };

    return table?.fullyQualifiedName
      ? getTestCaseManageMenuItems(
          table.fullyQualifiedName,
          bulkImportExportTestCasePermission,
          table?.deleted ?? false,
          navigate,
          showModal,
          EntityType.TABLE
        )
      : [];
  }, [globalPermissions, table, navigate, showModal]);

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

  const pagingData = useMemo(() => {
    return {
      isNumberBased: true,
      currentPage,
      isLoading: isTestsLoading,
      pageSize,
      paging,
      pagingHandler: handleTestCasePageChange,
      onShowSizeChange: handlePageSizeChange,
    };
  }, [
    currentPage,
    isTestsLoading,
    pageSize,
    paging,
    handleTestCasePageChange,
    handlePageSizeChange,
  ]);

  const handleTabChange = (tab: string | number) => {
    navigate(
      {
        pathname: location.pathname,
        search: QueryString.stringify({
          ...searchData,
          qualityTab: String(tab),
        }),
      },
      { state: location.state, replace: true }
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
    <div className="quality-tab-container tw:flex tw:flex-col tw:gap-7.5">
      <div className="tw:grid tw:grid-cols-4 tw:gap-6">
        {totalTestCaseSummary?.map((summary) => (
          <SummaryCardV1
            icon={summary.icon}
            isLoading={false}
            key={summary.title}
            title={summary.title}
            value={summary.value}
          />
        ))}
      </div>

      <div className="tw:border tw:border-secondary tw:rounded-[10px]">
        <div
          className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-x-4 tw:gap-y-4 tw:p-4"
          data-testid="quality-tab-toolbar">
          <div className="tw:flex tw:min-w-100 tw:flex-auto tw:items-center tw:gap-3">
            <Tabs
              className="tw:w-max"
              selectedKey={qualityTab}
              onSelectionChange={handleTabChange}>
              <Tabs.List size="sm" type="button-border">
                {tabs.map(({ label, key }) => (
                  <Tabs.Item id={key} key={key}>
                    {label}
                  </Tabs.Item>
                ))}
              </Tabs.List>
            </Tabs>

            {isTestCaseTab && (
              <div
                className="tw:min-w-50 tw:max-w-75 tw:flex-1"
                data-testid="quality-tab-search">
                <Searchbar
                  removeMargin
                  placeholder={t('label.search-entity', {
                    entity: t('label.test-case-lowercase'),
                  })}
                  searchValue={searchValue}
                  onSearch={handleSearchTestCase}
                />
              </div>
            )}
          </div>

          {isTestCaseTab && (
            <Box
              className="tw:ml-auto tw:shrink-0"
              data-testid="quality-tab-filter-controls">
              <Box
                inline
                align="center"
                className="layout-space layout-space-horizontal tw:w-full tw:justify-end"
                gap={3}
                itemClassName="layout-space-item">
                <Box
                  align="center"
                  className="tw:w-44"
                  data-testid="classic-quality-filter"
                  gap={2}>
                  <Typography as="span" size="text-sm" weight="medium">
                    {t('label.type')}:
                  </Typography>
                  <Select
                    aria-label={t('label.type')}
                    className="tw:min-w-0 tw:flex-1"
                    fontSize="sm"
                    items={TEST_CASE_TYPE_OPTION.map(({ value, label }) => ({
                      id: value,
                      label,
                    }))}
                    selectedKey={selectedTestType}
                    onSelectionChange={(key) => {
                      const type = TEST_CASE_TYPE_OPTION.find(
                        (option) => option.value === key
                      )?.value;
                      if (type) {
                        handleTestCaseTypeChange(type);
                      }
                    }}>
                    {(item) => (
                      <Select.Item id={item.id}>{item.label}</Select.Item>
                    )}
                  </Select>
                </Box>
                <Box
                  align="center"
                  className="tw:w-44"
                  data-testid="classic-quality-filter"
                  gap={2}>
                  <Typography as="span" size="text-sm">
                    {t('label.status')}:
                  </Typography>
                  <Select
                    aria-label={t('label.status')}
                    className="tw:min-w-0 tw:flex-1"
                    fontSize="sm"
                    items={TEST_CASE_STATUS_OPTION.map(({ value, label }) => ({
                      id: value,
                      label,
                    }))}
                    selectedKey={selectedTestCaseStatus}
                    onSelectionChange={(key) => {
                      const status = Object.values(TestCaseStatus).find(
                        (value) => value === key
                      );
                      if (key === '' || status) {
                        handleTestCaseStatusChange(status ?? '');
                      }
                    }}>
                    {(item) => (
                      <Select.Item id={item.id}>{item.label}</Select.Item>
                    )}
                  </Select>
                </Box>
                <ManageButton
                  canDelete={false}
                  deleted={table?.deleted ?? false}
                  displayName={t('label.manage-entity', {
                    entity: t('label.test-case-plural'),
                  })}
                  entityId={table?.id}
                  entityName={getEntityName(table)}
                  entityType={EntityType.TEST_CASE}
                  extraDropdownContent={extraDropdownContent}
                  isRecursiveDelete={false}
                />
              </Box>
            </Box>
          )}
        </div>

        {qualityTab === EntityTabs.TEST_CASES && (
          <DataQualityTab
            removeTableBorder
            afterDeleteAction={async (...params) => {
              await fetchAllTests(...params);
              params?.length &&
                (await getResourceLimit('dataQuality', true, true));
            }}
            breadcrumbData={tableBreadcrumb}
            entityPermissions={allTestCasesPermissions}
            fetchTestCases={handleSortTestCase}
            hasActiveFilters={hasActiveFilters}
            isEditAllowed={editTest}
            isLoading={isTestsLoading}
            pagingData={pagingData}
            showPagination={showPagination}
            showTableColumn={false}
            testCases={allTestCases}
            onTestCaseResultUpdate={onTestCaseUpdate}
            onTestUpdate={onTestCaseUpdate}
          />
        )}

        {qualityTab === EntityTabs.PIPELINE && (
          <TestSuitePipelineTab testSuite={testSuite} />
        )}
      </div>
    </div>
  );
};
