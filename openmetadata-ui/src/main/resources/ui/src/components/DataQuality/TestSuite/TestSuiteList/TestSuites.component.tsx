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
  ButtonGroup,
  ButtonGroupItem,
  Table,
} from '@openmetadata/ui-core-components';
import { Col, Form, Row, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { INITIAL_PAGING_VALUE } from '../../../../constants/constants';
import { TEST_SUITE_DOCS } from '../../../../constants/docs.constants';
import { PROGRESS_BAR_COLOR } from '../../../../constants/TestSuite.constant';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import {
  ERROR_PLACEHOLDER_TYPE,
  SORT_ORDER,
} from '../../../../enums/common.enum';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../../../enums/entity.enum';
import { TestSuiteType } from '../../../../enums/TestSuite.enum';
import { Operation } from '../../../../generated/entity/policies/policy';
import { EntityReference } from '../../../../generated/entity/type';
import { TestSuite, TestSummary } from '../../../../generated/tests/testCase';
import { usePaging } from '../../../../hooks/paging/usePaging';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import {
  DataQualityPageTabs,
  DataQualitySubTabs,
} from '../../../../pages/DataQuality/DataQualityPage.interface';
import { useDataQualityProvider } from '../../../../pages/DataQuality/DataQualityProvider';
import {
  getListTestSuitesBySearch,
  ListTestSuitePramsBySearch,
} from '../../../../rest/testAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getPopupContainer } from '../../../../utils/formPureUtils';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { getPrioritizedViewPermission } from '../../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import Loader from '../../../common/Loader/Loader';
import NextPrevious from '../../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import Searchbar from '../../../common/SearchBarComponent/SearchBar.component';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { ProfilerTabPath } from '../../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import ProfilerProgressWidget from '../../../Database/Profiler/TableProfiler/ProfilerProgressWidget/ProfilerProgressWidget';
import { TestSuiteSearchParams } from '../../DataQuality.interface';
import PieChartSummaryPanel from '../../SummaryPannel/PieChartSummaryPanel.component';
import './test-suites.style.less';

export const TestSuites = () => {
  const { t } = useTranslation();
  const {
    tab = DataQualityPageTabs.TEST_CASES,
    subTab = DataQualitySubTabs.TABLE_SUITES,
  } = useParams<{
    tab?: DataQualityPageTabs;
    subTab?: DataQualitySubTabs;
  }>();
  const navigate = useNavigate();
  const location = useCustomLocation();
  const { isTestCaseSummaryLoading, testCaseSummary } =
    useDataQualityProvider();

  const params = useMemo(() => {
    const search = location.search;

    const params = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    );

    return params as TestSuiteSearchParams;
  }, [location]);
  const { searchValue, owner } = params;
  const selectedOwner = useMemo(
    () => (owner ? JSON.parse(owner) : undefined),
    [owner]
  );

  const { permissions } = usePermissionProvider();
  const { testSuite: testSuitePermission } = permissions;
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [sortDescriptor, setSortDescriptor] = useState<
    SortDescriptor | undefined
  >();
  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
  } = usePaging();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const latestRequestId = useRef(0);

  const ownerFilterValue = useMemo(() => {
    return selectedOwner
      ? {
          key: selectedOwner.fullyQualifiedName ?? selectedOwner.name,
          label: getEntityName(selectedOwner),
        }
      : undefined;
  }, [selectedOwner]);

  const columnList = useMemo(
    () => [
      { id: 'name', name: t('label.name'), allowsSorting: true },
      { id: 'tests', name: t('label.test-plural') },
      { id: 'success', name: `${t('label.success')} %` },
      { id: 'owners', name: t('label.owner-plural') },
    ],
    [t]
  );

  const sortedData = useMemo(() => {
    if (!sortDescriptor?.column || !sortDescriptor?.direction) {
      return testSuites;
    }

    return [...testSuites].sort((a, b) => {
      let cmp = 0;
      if (sortDescriptor.column === 'name') {
        const getFqn = (item: TestSuite) =>
          item.basic
            ? item.basicEntityReference?.fullyQualifiedName ?? ''
            : item.fullyQualifiedName ?? '';
        cmp = getFqn(a).localeCompare(getFqn(b));
      }

      return sortDescriptor.direction === 'descending' ? -cmp : cmp;
    });
  }, [testSuites, sortDescriptor]);

  const fetchTestSuites = useCallback(
    async (
      currentPage = INITIAL_PAGING_VALUE,
      params?: ListTestSuitePramsBySearch
    ) => {
      const requestId = latestRequestId.current + 1;
      latestRequestId.current = requestId;

      setIsLoading(true);
      try {
        const result = await getListTestSuitesBySearch({
          ...params,
          fields: [TabSpecificField.OWNERS, TabSpecificField.SUMMARY],
          q: searchValue ? `*${searchValue}*` : undefined,
          owner: ownerFilterValue?.key,
          offset: (currentPage - 1) * pageSize,
          includeEmptyTestSuites: subTab !== DataQualitySubTabs.TABLE_SUITES,
          testSuiteType:
            subTab === DataQualitySubTabs.TABLE_SUITES
              ? TestSuiteType.basic
              : TestSuiteType.logical,
          sortField: 'lastResultTimestamp',
          sortType: SORT_ORDER.DESC,
        });
        if (requestId !== latestRequestId.current) {
          return;
        }

        setTestSuites(result.data);
        handlePagingChange(result.paging);
      } catch (error) {
        if (requestId === latestRequestId.current) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (requestId === latestRequestId.current) {
          setIsLoading(false);
        }
      }
    },
    [searchValue, ownerFilterValue?.key, pageSize, subTab, handlePagingChange]
  );

  const handleTestSuitesPageChange = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      fetchTestSuites(currentPage, { limit: pageSize });
      handlePageChange(currentPage);
    },
    [fetchTestSuites, pageSize, handlePageChange]
  );

  const handleSearchParam = (
    value: string,
    key: keyof TestSuiteSearchParams
  ) => {
    navigate({
      search: QueryString.stringify({
        ...params,
        [key]: isEmpty(value) ? undefined : value,
      }),
    });
  };

  const handleOwnerSelect = (owners: EntityReference[] = []) => {
    handleSearchParam(
      owners?.length > 0 ? JSON.stringify(owners?.[0]) : '',
      'owner'
    );
  };

  const handleSubTabChange = (keys: Set<string | number>) => {
    const selected = [...keys][0] as DataQualitySubTabs;
    if (selected) {
      navigate(
        observabilityRouterClassBase.getDataQualityPagePath(tab, selected)
      );
    }
  };

  const renderNameCell = (record: TestSuite) => {
    if (record.basic) {
      return (
        <Link
          className="break-word"
          data-testid={record.name}
          to={getEntityDetailsPath(
            EntityType.TABLE,
            record.basicEntityReference?.fullyQualifiedName ?? '',
            EntityTabs.PROFILER,
            ProfilerTabPath.DATA_QUALITY
          )}>
          {record.basicEntityReference?.fullyQualifiedName ??
            record.basicEntityReference?.name}
        </Link>
      );
    }

    return (
      <Link
        className="break-word"
        data-testid={record.name}
        to={observabilityRouterClassBase.getTestSuitePath(
          record.fullyQualifiedName ?? record.name
        )}>
        {getEntityName(record)}
      </Link>
    );
  };

  const renderSuccessCell = (summary: TestSuite['summary']) => {
    const percent =
      summary?.total && summary?.success ? summary.success / summary.total : 0;

    return (
      <ProfilerProgressWidget
        direction="right"
        strokeColor={PROGRESS_BAR_COLOR}
        value={percent}
      />
    );
  };

  const renderRow = (record: TestSuite) => (
    <Table.Row id={record.id ?? record.name} key={record.id ?? record.name}>
      <Table.Cell className="tw:max-w-50 tw:overflow-hidden">
        {renderNameCell(record)}
      </Table.Cell>
      <Table.Cell>
        <Typography.Text>
          {(record.summary as TestSummary)?.total ?? 0}
        </Typography.Text>
      </Table.Cell>
      <Table.Cell>{renderSuccessCell(record.summary)}</Table.Cell>
      <Table.Cell>
        <OwnerLabel
          isCompactView={false}
          maxVisibleOwners={4}
          owners={record.owners}
          showLabel={false}
        />
      </Table.Cell>
    </Table.Row>
  );

  const noDataPlaceholder = useMemo(() => {
    if (
      isEmpty(params) &&
      isEmpty(testSuites) &&
      subTab === DataQualitySubTabs.BUNDLE_SUITES
    ) {
      return (
        <ErrorPlaceHolder
          permission
          className="border-none"
          doc={TEST_SUITE_DOCS}
          heading={t('label.bundle-suite')}
          type={ERROR_PLACEHOLDER_TYPE.CREATE}
        />
      );
    }

    return <FilterTablePlaceHolder />;
  }, [params, testSuites, subTab]);

  useEffect(() => {
    if (
      getPrioritizedViewPermission(testSuitePermission, Operation.ViewBasic)
    ) {
      fetchTestSuites(currentPage, {
        limit: pageSize,
      });
    } else {
      setIsLoading(false);
    }
  }, [
    testSuitePermission,
    pageSize,
    searchValue,
    owner,
    subTab,
    currentPage,
    fetchTestSuites,
  ]);

  if (!testSuitePermission?.ViewAll && !testSuitePermission?.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.test-suite'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <Row data-testid="test-suite-container" gutter={[16, 16]}>
      <Col span={24}>
        <Form className="new-form-style" layout="inline">
          <Space align="center" className="w-full justify-between" size={16}>
            <Form.Item className="m-0" label={t('label.owner')} name="owner">
              <UserTeamSelectableList
                hasPermission
                owner={selectedOwner}
                popoverProps={{
                  getPopupContainer: getPopupContainer,
                }}
                onUpdate={(updatedUser) => handleOwnerSelect(updatedUser)}>
                <Select
                  data-testid="owner-select-filter"
                  open={false}
                  placeholder={t('label.owner')}
                  value={ownerFilterValue}
                />
              </UserTeamSelectableList>
            </Form.Item>
          </Space>
        </Form>
      </Col>

      <Col span={24}>
        <PieChartSummaryPanel
          isLoading={isTestCaseSummaryLoading}
          testSummary={testCaseSummary}
        />
      </Col>

      <Col span={24}>
        <div className="test-suite-list-container">
          <div className="test-suite-list-header">
            <Row gutter={[16, 16]}>
              <Col data-testid="test-suite-sub-tab-container" span={16}>
                <ButtonGroup
                  disallowEmptySelection
                  selectedKeys={[subTab]}
                  onSelectionChange={handleSubTabChange}>
                  <ButtonGroupItem
                    className="tw:font-normal tw:selected:bg-[var(--ant-primary-1)] tw:selected:text-[var(--ant-primary-7)] tw:selected:ring-[var(--ant-primary-7)]"
                    data-testid="table-suite-radio-btn"
                    id={DataQualitySubTabs.TABLE_SUITES}>
                    {t('label.table-suite-plural')}
                  </ButtonGroupItem>
                  <ButtonGroupItem
                    className="tw:font-normal tw:selected:bg-[var(--ant-primary-1)] tw:selected:text-[var(--ant-primary-7)] tw:selected:ring-[var(--ant-primary-7)]"
                    data-testid="bundle-suite-radio-btn"
                    id={DataQualitySubTabs.BUNDLE_SUITES}>
                    {t('label.bundle-suite-plural')}
                  </ButtonGroupItem>
                </ButtonGroup>
              </Col>
              <Col span={8}>
                <Searchbar
                  removeMargin
                  placeholder={t('label.search-entity', {
                    entity:
                      subTab === DataQualitySubTabs.TABLE_SUITES
                        ? t('label.table-suite-plural')
                        : t('label.bundle-suite-plural'),
                  })}
                  searchValue={searchValue}
                  onSearch={(value) => handleSearchParam(value, 'searchValue')}
                />
              </Col>
            </Row>
          </div>

          <Table
            aria-label={t('label.test-suite-plural')}
            data-testid="test-suite-table"
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}>
            <Table.Header columns={columnList}>
              {(col) => (
                <Table.Head
                  allowsSorting={col.allowsSorting}
                  id={col.id}
                  key={col.id}
                  label={col.name}
                />
              )}
            </Table.Header>
            <Table.Body
              items={isLoading ? [] : sortedData}
              renderEmptyState={() =>
                isLoading ? (
                  <div className="tw:flex tw:justify-center tw:p-8">
                    <Loader />
                  </div>
                ) : (
                  noDataPlaceholder
                )
              }>
              {(record) => renderRow(record as TestSuite)}
            </Table.Body>
          </Table>

          {showPagination && (
            <NextPrevious
              isNumberBased
              currentPage={currentPage}
              isLoading={isLoading}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={handleTestSuitesPageChange}
              onShowSizeChange={handlePageSizeChange}
            />
          )}
        </div>
      </Col>
    </Row>
  );
};
