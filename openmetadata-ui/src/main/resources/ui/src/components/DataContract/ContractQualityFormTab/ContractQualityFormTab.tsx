/*
 *  Copyright 2025 Collate.
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

import Icon, { DownOutlined } from '@ant-design/icons';
import { Button, Card, Dropdown, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { toLower } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LeftOutlined } from '../../../assets/svg/left-arrow.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/x-colored.svg';
import { DEFAULT_SORT_ORDER } from '../../../constants/profiler.constant';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { Table as TableType } from '../../../generated/entity/data/table';
import { TestCase, TestCaseResult } from '../../../generated/tests/testCase';
import { EntityReference } from '../../../generated/type/entityReference';
import { Include } from '../../../generated/type/include';
import { usePaging } from '../../../hooks/paging/usePaging';
import {
  getListTestCaseBySearch,
  ListTestCaseParamsBySearch,
  TestCaseType,
} from '../../../rest/testAPI';
import { TEST_LEVEL_OPTIONS } from '../../../utils/DataQuality/DataQualityUtils';
import i18n from '../../../utils/i18next/LocalUtil';
import { generateEntityLink } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import SelectionCardGroup from '../../common/SelectionCardGroup/SelectionCardGroup';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import Table from '../../common/Table/Table';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import TestCaseFormV1 from '../../DataQuality/AddDataQualityTest/components/TestCaseFormV1';
import { TestLevel } from '../../DataQuality/AddDataQualityTest/components/TestCaseFormV1.interface';
import './contract-quality-form-tab.less';

export const TestTypeLabelMap = {
  [TestCaseType.all]: i18n.t('label.all'),
  [TestCaseType.table]: i18n.t('label.table'),
  [TestCaseType.column]: i18n.t('label.column'),
};

export const ContractQualityFormTab: React.FC<{
  selectedQuality: string[];
  onChange: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  prevLabel?: string;
}> = ({ selectedQuality, onChange, onPrev, prevLabel }) => {
  const [testType, setTestType] = useState<TestCaseType>(TestCaseType.table);
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const { data: table } = useGenericContext<TableType>();
  const [isTestsLoading, setIsTestsLoading] = useState<boolean>(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    selectedQuality ?? []
  );
  const [isTestCaseDrawerOpen, setIsTestCaseDrawerOpen] =
    useState<boolean>(false);
  const {
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
    paging,
    handlePagingChange,
  } = usePaging();
  const { t } = useTranslation();

  const fetchAllTests = async (params?: ListTestCaseParamsBySearch) => {
    if (!table?.fullyQualifiedName) {
      return;
    }
    setIsTestsLoading(true);
    try {
      const { data, paging } = await getListTestCaseBySearch({
        ...DEFAULT_SORT_ORDER,
        ...params,
        testCaseType: testType,
        fields: [TabSpecificField.TEST_CASE_RESULT],
        entityLink: generateEntityLink(table.fullyQualifiedName ?? ''),
        includeAllTests: true,
        limit: pageSize,
        include: Include.NonDeleted,
      });

      setAllTestCases(data);
      handlePagingChange(paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTestsLoading(false);
    }
  };

  const handleTestPageChange = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      fetchAllTests({
        offset: (currentPage - 1) * pageSize,
      });

      handlePageChange(currentPage);
    },
    [pageSize, fetchAllTests, handlePageChange]
  );

  const handleOpenTestCaseDrawer = useCallback(() => {
    setIsTestCaseDrawerOpen(true);
  }, []);

  const handleCloseTestCaseDrawer = useCallback(() => {
    setIsTestCaseDrawerOpen(false);
  }, []);

  const handleTestCaseSubmit = useCallback(() => {
    handleCloseTestCaseDrawer();
    fetchAllTests();
  }, [handleCloseTestCaseDrawer, fetchAllTests]);

  const columns: ColumnsType<TestCase> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
      },
      {
        title: t('label.status'),
        dataIndex: 'testCaseResult',
        key: 'testCaseResult',
        render: (result: TestCaseResult, record) => {
          return result?.testCaseStatus ? (
            <StatusBadge
              dataTestId={`status-badge-${record.name}`}
              label={result.testCaseStatus}
              status={toLower(result.testCaseStatus) as StatusType}
            />
          ) : (
            '--'
          );
        },
      },
    ],
    []
  );

  const paginationProps = useMemo(
    () => ({
      currentPage,
      showPagination,
      isLoading: isTestsLoading,
      isNumberBased: false,
      pageSize,
      paging,
      pagingHandler: handleTestPageChange,
      onShowSizeChange: handlePageSizeChange,
    }),
    [
      currentPage,
      showPagination,
      isTestsLoading,
      pageSize,
      paging,
      handleTestPageChange,
      handlePageSizeChange,
    ]
  );

  const handleSelection = (selectedRowKeys: string[]) => {
    const qualityExpectations = selectedRowKeys.map((id) => {
      const testCase = allTestCases.find((test) => test.id === id);

      return {
        description: testCase?.description,
        name: testCase?.name,
        id: testCase?.id,
        type: EntityType.TEST_CASE,
      } as EntityReference;
    });

    onChange({
      qualityExpectations,
    });
  };

  useEffect(() => {
    fetchAllTests();
  }, [testType]);

  return (
    <Card className="contract-quality-form-tab-container container bg-grey p-box">
      <div className="d-flex justify-between">
        <div>
          <Typography.Text className="contract-detail-form-tab-title">
            {t('label.quality')}
          </Typography.Text>
          <Typography.Text className="contract-detail-form-tab-description">
            {t('message.quality-contract-description')}
          </Typography.Text>
        </div>

        <Button
          className="contract-export-button"
          data-testid="add-test-button"
          icon={<Icon className="anticon" component={PlusIcon} />}
          onClick={handleOpenTestCaseDrawer}>
          {t('label.add-entity', {
            entity: t('label.test'),
          })}
        </Button>
      </div>

      <div className="contract-form-content-container ">
        <SelectionCardGroup
          options={TEST_LEVEL_OPTIONS}
          value={testType}
          onChange={(value) => setTestType(value as TestCaseType)}
        />
        <Table
          columns={columns}
          customPaginationProps={paginationProps}
          dataSource={allTestCases}
          extraTableFilters={
            <Dropdown
              menu={{
                items: Object.entries(TestTypeLabelMap).map(([key]) => ({
                  key,
                  label: TestTypeLabelMap[key as TestCaseType],
                })),
              }}>
              <Button
                icon={<DownOutlined />}
                type="default"
                onClick={() => setTestType(TestCaseType.table)}>
                {t('label.filter-plural')}
              </Button>
            </Dropdown>
          }
          loading={isTestsLoading}
          pagination={false}
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (selectedRowKeys) => {
              setSelectedKeys(selectedRowKeys as string[]);
              handleSelection(selectedRowKeys as string[]);
            },
          }}
          searchProps={{
            placeholder: t('label.search-by-name'),
            onSearch: (value) => {
              fetchAllTests({
                offset: 0,
                limit: pageSize,
                q: value,
              });
            },
          }}
        />
      </div>

      <div className="d-flex justify-between m-t-md">
        <Button
          className="contract-prev-button"
          icon={<LeftOutlined height={22} width={20} />}
          type="default"
          onClick={onPrev}>
          {prevLabel ?? t('label.previous')}
        </Button>
      </div>

      {isTestCaseDrawerOpen && (
        <TestCaseFormV1
          drawerProps={{
            open: isTestCaseDrawerOpen,
          }}
          table={table}
          testLevel={TestLevel.TABLE}
          onCancel={handleCloseTestCaseDrawer}
          onFormSubmit={handleTestCaseSubmit}
        />
      )}
    </Card>
  );
};
