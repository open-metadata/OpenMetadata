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
import { Button, Col, Dropdown, Row, Space, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
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
import Qs from 'qs';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import { ReactComponent as DropDownIcon } from '../../../assets/svg/DropDown.svg';
import { ReactComponent as SettingIcon } from '../../../assets/svg/ic-settings-primery.svg';
import FilterTablePlaceHolder from '../../../components/common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import Table from '../../../components/common/Table/Table';
import { TableProfilerTab } from '../../../components/ProfilerDashboard/profilerDashboard.interface';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import {
  DEFAULT_RANGE_DATA,
  DEFAULT_TEST_VALUE,
  INITIAL_TEST_RESULT_SUMMARY,
} from '../../../constants/profiler.constant';
import { ProfilerDashboardType } from '../../../enums/table.enum';
import { Column, ColumnProfile } from '../../../generated/entity/data/table';
import { TestCase, TestCaseStatus } from '../../../generated/tests/testCase';
import { formatNumberWithComma } from '../../../utils/CommonUtils';
import { updateTestResults } from '../../../utils/DataQualityAndProfilerUtils';
import {
  getAddCustomMetricPath,
  getAddDataQualityTableTestPath,
} from '../../../utils/RouterUtils';
import { getDecodedFqn, getEncodedFqn } from '../../../utils/StringsUtils';
import { getTableExpandableConfig } from '../../../utils/TableUtils';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import { SummaryCard } from '../../common/SummaryCard/SummaryCard.component';
import { SummaryCardProps } from '../../common/SummaryCard/SummaryCard.interface';
import TestIndicator from '../../common/TestIndicator/TestIndicator';
import DatePickerMenu from '../../DatePickerMenu/DatePickerMenu.component';
import PageHeader from '../../PageHeader/PageHeader.component';
import { DateRangeObject } from '../../ProfilerDashboard/component/TestSummary';
import TabsLabel from '../../TabsLabel/TabsLabel.component';
import {
  columnTestResultType,
  ModifiedColumn,
} from '../TableProfiler.interface';
import { useTableProfiler } from '../TableProfilerProvider';
import ColumnPickerMenu from './ColumnPickerMenu';
import ColumnSummary from './ColumnSummary';
import NoProfilerBanner from './NoProfilerBanner.component';
import ProfilerProgressWidget from './ProfilerProgressWidget';
import SingleColumnProfile from './SingleColumnProfile';

const ColumnProfileTable = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn } = useParams<{ fqn: string }>();
  const {
    isTestsLoading,
    isProfilerDataLoading,
    overallSummary,
    isTableDeleted,
    permissions,
    onSettingButtonClick,
    isProfilingEnabled,
    tableProfiler,
    splitTestCases,
  } = useTableProfiler();
  const isLoading = isTestsLoading || isProfilerDataLoading;
  const columnTests = splitTestCases.column ?? [];
  const columns = tableProfiler?.columns ?? [];
  const [searchText, setSearchText] = useState<string>('');
  const [data, setData] = useState<ModifiedColumn[]>(columns);
  const [columnTestSummary, setColumnTestSummary] =
    useState<columnTestResultType>();
  const [dateRangeObject, setDateRangeObject] =
    useState<DateRangeObject>(DEFAULT_RANGE_DATA);

  const { activeColumnFqn, activeTab } = useMemo(() => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeColumnFqn: string; activeTab: string };
  }, [location.search]);

  const { editTest, editDataProfile } = useMemo(() => {
    return {
      editTest: permissions?.EditAll || permissions?.EditTests,
      editDataProfile: permissions?.EditAll || permissions?.EditDataProfile,
    };
  }, [permissions]);

  const updateActiveColumnFqn = (key: string) =>
    history.push({ search: Qs.stringify({ activeColumnFqn: key, activeTab }) });

  const tableColumn: ColumnsType<ModifiedColumn> = useMemo(() => {
    return [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 250,
        fixed: 'left',
        render: (name: string, record) => {
          return (
            <Button
              className="break-word p-0"
              type="link"
              onClick={() =>
                updateActiveColumnFqn(record.fullyQualifiedName || '')
              }>
              {name}
            </Button>
          );
        },
        sorter: (col1, col2) => col1.name.localeCompare(col2.name),
      },
      {
        title: t('label.data-type'),
        dataIndex: 'dataTypeDisplay',
        key: 'dataType',
        width: 150,
        render: (dataTypeDisplay: string) => {
          return (
            <Typography.Text className="break-word">
              {dataTypeDisplay || 'N/A'}
            </Typography.Text>
          );
        },
        sorter: (col1, col2) => col1.dataType.localeCompare(col2.dataType),
      },
      {
        title: `${t('label.null')} %`,
        dataIndex: 'profile',
        key: 'nullProportion',
        width: 200,
        render: (profile: ColumnProfile) => {
          return (
            <ProfilerProgressWidget
              strokeColor="#351b8e"
              value={profile?.nullProportion || 0}
            />
          );
        },
        sorter: (col1, col2) =>
          (col1.profile?.nullProportion || 0) -
          (col2.profile?.nullProportion || 0),
      },
      {
        title: `${t('label.unique')} %`,
        dataIndex: 'profile',
        key: 'uniqueProportion',
        width: 200,
        render: (profile: ColumnProfile) => (
          <ProfilerProgressWidget
            strokeColor="#7147e8"
            value={profile?.uniqueProportion || 0}
          />
        ),
        sorter: (col1, col2) =>
          (col1.profile?.uniqueProportion || 0) -
          (col2.profile?.uniqueProportion || 0),
      },
      {
        title: `${t('label.distinct')} %`,
        dataIndex: 'profile',
        key: 'distinctProportion',
        width: 200,
        render: (profile: ColumnProfile) => (
          <ProfilerProgressWidget
            strokeColor="#4E8B9C"
            value={profile?.distinctProportion || 0}
          />
        ),
        sorter: (col1, col2) =>
          (col1.profile?.distinctProportion || 0) -
          (col2.profile?.distinctProportion || 0),
      },
      {
        title: t('label.value-count'),
        dataIndex: 'profile',
        key: 'valuesCount',
        width: 120,
        render: (profile: ColumnProfile) =>
          formatNumberWithComma(profile?.valuesCount || 0),
        sorter: (col1, col2) =>
          (col1.profile?.valuesCount || 0) - (col2.profile?.valuesCount || 0),
      },
      {
        title: t('label.test-plural'),
        dataIndex: 'testCount',
        key: 'Tests',
        render: (_, record) => (
          <Link
            data-testid={`${record.name}-test-count`}
            to={{
              search: Qs.stringify({
                activeTab: TableProfilerTab.DATA_QUALITY,
              }),
            }}>
            {record.testCount ?? 0}
          </Link>
        ),
        sorter: (col1, col2) => (col1.testCount ?? 0) - (col2.testCount ?? 0),
      },
      {
        title: t('label.status'),
        dataIndex: 'dataQualityTest',
        key: 'dataQualityTest',
        render: (_, record) => {
          const summary =
            columnTestSummary?.[
              getEncodedFqn(record.fullyQualifiedName || '', true)
            ]?.results;
          const currentResult = summary
            ? Object.entries(summary).map(([key, value]) => ({
                value,
                type: key,
              }))
            : DEFAULT_TEST_VALUE;

          const hasStatus = currentResult.some(({ value }) => value !== 0);

          return hasStatus ? (
            <Space size={16}>
              {currentResult.map((test, i) => (
                <TestIndicator key={i} type={test.type} value={test.value} />
              ))}
            </Space>
          ) : (
            <Typography.Text> {NO_DATA_PLACEHOLDER} </Typography.Text>
          );
        },
      },
    ];
  }, [columns, columnTestSummary]);

  const selectedColumn = useMemo(() => {
    return find(
      columns,
      (column: Column) => column.fullyQualifiedName === activeColumnFqn
    );
  }, [columns, activeColumnFqn]);

  const addButtonContent = [
    {
      label: <TabsLabel id="test-case" name={t('label.test-case')} />,
      key: 'test-case',
      onClick: () => {
        history.push({
          pathname: getAddDataQualityTableTestPath(
            ProfilerDashboardType.COLUMN,
            getDecodedFqn(fqn)
          ),
          search: activeColumnFqn ? Qs.stringify({ activeColumnFqn }) : '',
        });
      },
    },
    {
      label: <TabsLabel id="custom-metric" name={t('label.custom-metric')} />,
      key: 'custom-metric',
      onClick: () => {
        history.push({
          pathname: getAddCustomMetricPath(
            ProfilerDashboardType.COLUMN,
            getDecodedFqn(fqn)
          ),
          search: activeColumnFqn ? Qs.stringify({ activeColumnFqn }) : '',
        });
      },
    },
  ];

  const selectedColumnTestsObj = useMemo(() => {
    const temp = filter(
      columnTests,
      (test: TestCase) =>
        test.entityFQN === activeColumnFqn && !isUndefined(test.testCaseResult)
    );

    const statusDict = {
      [TestCaseStatus.Success]: [],
      [TestCaseStatus.Aborted]: [],
      [TestCaseStatus.Failed]: [],
      ...groupBy(temp, 'testCaseResult.testCaseStatus'),
    };

    return { statusDict, totalTests: temp.length };
  }, [activeColumnFqn, columnTests]);

  const pageHeader = useMemo(() => {
    return {
      ...PAGE_HEADERS.COLUMN_PROFILE,
      header: isEmpty(activeColumnFqn) ? (
        PAGE_HEADERS.COLUMN_PROFILE.header
      ) : (
        <Button
          className="p-0 text-md font-medium"
          type="link"
          onClick={() =>
            history.push({
              search: Qs.stringify({
                activeTab: TableProfilerTab.COLUMN_PROFILE,
              }),
            })
          }>
          <Space>
            <DropDownIcon className="transform-90" height={16} width={16} />
            {PAGE_HEADERS.COLUMN_PROFILE.header}
          </Space>
        </Button>
      ),
    };
  }, [activeColumnFqn]);

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, dateRangeObject)) {
      setDateRangeObject(value);
    }
  };

  const handleSearchAction = (searchText: string) => {
    setSearchText(searchText);
    if (searchText) {
      setData(columns.filter((col) => col.name?.includes(searchText)));
    } else {
      setData(columns);
    }
  };

  useEffect(() => {
    if (columnTests.length) {
      const colResult = columnTests.reduce((acc, curr) => {
        const fqn = curr.entityFQN || '';
        if (isUndefined(acc[fqn])) {
          acc[fqn] = { results: { ...INITIAL_TEST_RESULT_SUMMARY }, count: 0 };
        }
        updateTestResults(
          acc[fqn].results,
          curr.testCaseResult?.testCaseStatus || ''
        );
        acc[fqn].count += 1;

        return acc;
      }, {} as columnTestResultType);
      setData(
        columns.map((col) => ({
          ...col,
          key: col.name,
          testCount:
            colResult?.[getEncodedFqn(col.fullyQualifiedName || '', true)]
              ?.count,
        }))
      );
      setColumnTestSummary(colResult);
    } else {
      setData(columns);
    }
  }, [columnTests, columns]);

  return (
    <Row data-testid="column-profile-table-container" gutter={[16, 16]}>
      <Col span={24}>
        <Row>
          <Col span={10}>
            <PageHeader data={pageHeader} />
          </Col>
          <Col span={14}>
            <Space align="center" className="w-full justify-end">
              {!isEmpty(activeColumnFqn) && (
                <DatePickerMenu
                  showSelectedCustomRange
                  handleDateRangeChange={handleDateRangeChange}
                />
              )}

              {!isTableDeleted && (
                <>
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
                          {t('label.add')}
                          <DownOutlined />
                        </Space>
                      </Button>
                    </Dropdown>
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
                </>
              )}
            </Space>
          </Col>
        </Row>
      </Col>
      {!isLoading && !isProfilingEnabled && (
        <Col span={24}>
          <NoProfilerBanner />
        </Col>
      )}
      <Col span={24}>
        <Row gutter={[16, 16]}>
          {!isUndefined(selectedColumn) && (
            <Col span={10}>
              <ColumnSummary column={selectedColumn} />
            </Col>
          )}

          <Col span={selectedColumn ? 14 : 24}>
            <Row
              wrap
              className={classNames(
                activeColumnFqn ? 'justify-start' : 'justify-between'
              )}
              gutter={[16, 16]}>
              {overallSummary?.map((summery) => (
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
        </Row>
      </Col>
      {isEmpty(activeColumnFqn) ? (
        <Col span={24}>
          <div className="w-max-400">
            <Searchbar
              placeholder={t('message.find-in-table')}
              searchValue={searchText}
              typingInterval={500}
              onSearch={handleSearchAction}
            />
          </div>

          <Table
            bordered
            columns={tableColumn}
            dataSource={data}
            expandable={getTableExpandableConfig<Column>()}
            loading={isLoading}
            locale={{
              emptyText: <FilterTablePlaceHolder />,
            }}
            pagination={false}
            rowKey="name"
            scroll={{ x: true }}
            size="small"
          />
        </Col>
      ) : (
        <Col span={24}>
          <SingleColumnProfile
            activeColumnFqn={activeColumnFqn}
            dateRangeObject={dateRangeObject}
          />
        </Col>
      )}
    </Row>
  );
};

export default ColumnProfileTable;
