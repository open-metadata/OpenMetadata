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
  Card,
  Col,
  Form,
  Radio,
  RadioChangeEvent,
  Row,
  Select,
  Space,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { INITIAL_PAGING_VALUE } from '../../../../constants/constants';
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
  TestSuiteType,
} from '../../../../rest/testAPI';
import { getEntityName } from '../../../../utils/EntityUtils';
import {
  getDataQualityPagePath,
  getEntityDetailsPath,
  getTestSuitePath,
} from '../../../../utils/RouterUtils';
import { ownerTableObject } from '../../../../utils/TableColumn.util';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../../common/SearchBarComponent/SearchBar.component';
import Table from '../../../common/Table/Table';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { TableProfilerTab } from '../../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
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

  const ownerFilterValue = useMemo(() => {
    return selectedOwner
      ? {
          key: selectedOwner.fullyQualifiedName ?? selectedOwner.name,
          label: getEntityName(selectedOwner),
        }
      : undefined;
  }, [selectedOwner]);
  const columns = useMemo(() => {
    const data: ColumnsType<TestSuite> = [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 600,
        sorter: (a, b) => {
          if (a.basic) {
            // Sort for basic test suites
            return (
              a.basicEntityReference?.fullyQualifiedName?.localeCompare(
                b.basicEntityReference?.fullyQualifiedName ?? ''
              ) ?? 0
            );
          } else {
            // Sort for logical test suites
            return (
              a.fullyQualifiedName?.localeCompare(b.fullyQualifiedName ?? '') ??
              0
            );
          }
        },
        sortDirections: ['ascend', 'descend'],
        render: (name, record) => {
          return (
            <Typography.Paragraph className="m-0">
              {record.basic ? (
                <Link
                  data-testid={name}
                  to={{
                    pathname: getEntityDetailsPath(
                      EntityType.TABLE,
                      record.basicEntityReference?.fullyQualifiedName ?? '',
                      EntityTabs.PROFILER
                    ),
                    search: QueryString.stringify({
                      activeTab: TableProfilerTab.DATA_QUALITY,
                    }),
                  }}>
                  {record.basicEntityReference?.fullyQualifiedName ??
                    record.basicEntityReference?.name}
                </Link>
              ) : (
                <Link
                  data-testid={name}
                  to={getTestSuitePath(
                    record.fullyQualifiedName ?? record.name
                  )}>
                  {getEntityName(record)}
                </Link>
              )}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.test-plural'),
        dataIndex: 'summary',
        key: 'tests',
        width: 100,
        render: (value: TestSummary) => value?.total ?? 0,
      },
      {
        title: `${t('label.success')} %`,
        dataIndex: 'summary',
        width: 200,
        key: 'success',
        render: (value: TestSuite['summary']) => {
          const percent =
            value?.total && value?.success ? value.success / value.total : 0;

          return (
            <ProfilerProgressWidget
              direction="right"
              strokeColor={PROGRESS_BAR_COLOR}
              value={percent}
            />
          );
        },
      },
      ...ownerTableObject<TestSuite>(),
    ];

    return data;
  }, []);

  const fetchTestSuites = async (
    currentPage = INITIAL_PAGING_VALUE,
    params?: ListTestSuitePramsBySearch
  ) => {
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
        sortField: 'testCaseResultSummary.timestamp',
        sortType: SORT_ORDER.DESC,
        sortNestedPath: 'testCaseResultSummary',
        sortNestedMode: ['max'],
      });
      setTestSuites(result.data);
      handlePagingChange(result.paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSuitesPageChange = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      fetchTestSuites(currentPage, { limit: pageSize });
      handlePageChange(currentPage);
    },
    [pageSize, paging]
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

  const handleSubTabChange = (e: RadioChangeEvent) => {
    navigate(getDataQualityPagePath(tab, e.target.value as DataQualitySubTabs));
  };

  useEffect(() => {
    if (testSuitePermission?.ViewAll || testSuitePermission?.ViewBasic) {
      fetchTestSuites(INITIAL_PAGING_VALUE, {
        limit: pageSize,
      });
    } else {
      setIsLoading(false);
    }
  }, [testSuitePermission, pageSize, searchValue, owner, subTab]);

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
        <Card className="data-quality-filters-bar">
          <Form layout="inline">
            <Space align="center" className="w-full justify-between" size={16}>
              <Form.Item className="m-0" label={t('label.owner')} name="owner">
                <UserTeamSelectableList
                  hasPermission
                  owner={selectedOwner}
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
        </Card>
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
                <Radio.Group value={subTab} onChange={handleSubTabChange}>
                  <Radio.Button
                    data-testid="table-suite-radio-btn"
                    value={DataQualitySubTabs.TABLE_SUITES}>
                    {t('label.table-suite-plural')}
                  </Radio.Button>
                  <Radio.Button
                    data-testid="bundle-suite-radio-btn"
                    value={DataQualitySubTabs.BUNDLE_SUITES}>
                    {t('label.bundle-suite-plural')}
                  </Radio.Button>
                </Radio.Group>
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
            columns={columns}
            containerClassName="custom-card-with-table"
            customPaginationProps={{
              currentPage,
              isLoading,
              pageSize,
              isNumberBased: true,
              paging,
              pagingHandler: handleTestSuitesPageChange,
              onShowSizeChange: handlePageSizeChange,
              showPagination,
            }}
            data-testid="test-suite-table"
            dataSource={testSuites}
            loading={isLoading}
            locale={{
              emptyText: <FilterTablePlaceHolder />,
            }}
            pagination={false}
            scroll={{
              x: '100%',
            }}
            size="small"
          />
        </div>
      </Col>
    </Row>
  );
};
