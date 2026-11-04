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

import { Button, Dropdown } from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ClipboardCheck,
  NoSearch,
  Plus as PlusIcon,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { toLower } from 'lodash';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_SORT_ORDER,
  TEST_CASE_STATUS_LABELS,
} from '../../../constants/profiler.constant';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { TestCaseType } from '../../../enums/TestSuite.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { Table as TableType } from '../../../generated/entity/data/table';
import { TestCase, TestCaseResult } from '../../../generated/tests/testCase';
import { EntityReference } from '../../../generated/type/entityReference';
import { Include } from '../../../generated/type/include';
import { usePaging } from '../../../hooks/paging/usePaging';
import {
  getListTestCaseBySearch,
  ListTestCaseParamsBySearch,
} from '../../../rest/testAPI';
import { ContractTestTypeLabelMap } from '../../../utils/DataContract/DataContractUtils';
import { generateEntityLink } from '../../../utils/TablePureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import NoFilteredResultsPlaceholder from '../../common/EmptyPlaceholder/NoFilteredResultsPlaceholder';
import NoSearchResultsPlaceholder from '../../common/EmptyPlaceholder/NoSearchResultsPlaceholder';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import { ColumnsType } from '../../common/Table/Table.interface';
import Table from '../../common/Table/TableV2';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { TestLevel } from '../../DataQuality/AddDataQualityTest/components/TestCaseFormV1.interface';
import { ContractFormStep } from '../ContractFormStep/ContractFormStep';

const TestCaseFormDrawer = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../DataQuality/AddDataQualityTest/components/TestCaseFormDrawer'
      )
  )
);

export const ContractQualityFormTab: React.FC<{
  selectedQuality: string[];
  onChange: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  onNext: () => void;
  initialValues?: Partial<DataContract>;
  buttonProps: {
    nextLabel?: string;
    prevLabel?: string;
    isNextVisible?: boolean;
  };
}> = ({
  selectedQuality,
  onChange,
  onNext,
  onPrev,
  initialValues,
  buttonProps,
}) => {
  const [testType, setTestType] = useState<TestCaseType>(TestCaseType.all);
  const [searchValue, setSearchValue] = useState('');
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const { data: table } = useGenericContext<TableType>();
  const [isTestsLoading, setIsTestsLoading] = useState<boolean>(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    selectedQuality ?? []
  );

  // Stored quality-expectation references keyed by id, seeded from the saved
  // contract. The test-case list is server-paged and filterable, so a seeded
  // expectation whose test case lives on a later page (or is excluded by the
  // testType filter, or was deleted) is never in `allTestCases`. Without this
  // fallback, rebuilding `qualityExpectations` from `allTestCases` alone would
  // silently drop those off-page selections whenever the user toggles any row.
  const storedRefsById = useMemo(
    () =>
      new Map(
        (initialValues?.qualityExpectations ?? []).map((q) => [q.id ?? '', q])
      ),
    [initialValues?.qualityExpectations]
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
              label={TEST_CASE_STATUS_LABELS[result.testCaseStatus]}
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

  const isFiltered = Boolean(searchValue) || testType !== TestCaseType.all;
  const EmptyStatePlaceholder = searchValue
    ? NoSearchResultsPlaceholder
    : NoFilteredResultsPlaceholder;
  // Nothing to narrow down until the table has at least one test.
  const hasNoTests = !isFiltered && allTestCases.length === 0;

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

      // When the test case is in the currently fetched (paged/filtered) list,
      // resolve the full reference from it. Otherwise fall back to the stored
      // reference seeded from the saved contract so off-page, filtered-out, or
      // deleted test cases are preserved rather than silently dropped.
      return testCase
        ? {
            description: testCase.description,
            name: testCase.name,
            id: testCase.id,
            type: EntityType.TEST_CASE,
          }
        : storedRefsById.get(id) ?? {
            id,
            type: EntityType.TEST_CASE,
          };
    }) as EntityReference[];

    onChange({
      qualityExpectations,
    });
  };

  useEffect(() => {
    fetchAllTests();
  }, [testType]);

  return (
    <ContractFormStep
      description={t('message.quality-contract-description')}
      extra={
        <Button
          color="secondary"
          data-testid="add-test-button"
          iconLeading={PlusIcon}
          onPress={handleOpenTestCaseDrawer}>
          {t('label.add-entity', { entity: t('label.test') })}
        </Button>
      }
      isNextVisible={buttonProps.isNextVisible}
      nextLabel={buttonProps.nextLabel}
      prevLabel={buttonProps.prevLabel}
      title={t('label.quality')}
      onNext={onNext}
      onPrev={onPrev}>
      <div className="contract-form-content-container">
        <Table
          columns={columns}
          customPaginationProps={paginationProps}
          dataSource={allTestCases}
          extraTableFilters={
            <Dropdown.Root>
              <Button
                color="secondary"
                data-testid="quality-filter-button"
                iconTrailing={ChevronDown}
                isDisabled={hasNoTests}
                size="sm">
                {t('label.filter-plural')}
              </Button>
              <Dropdown.Popover className="tw:w-auto">
                <Dropdown.Menu
                  aria-label={t('label.filter-plural')}
                  selectedKeys={[testType]}
                  onAction={(key) => setTestType(key as TestCaseType)}>
                  {Object.entries(ContractTestTypeLabelMap).map(
                    ([key, label]) => (
                      <Dropdown.Item id={key} key={key} label={label} />
                    )
                  )}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          }
          loading={isTestsLoading}
          locale={{
            emptyText: isFiltered ? (
              <EmptyStatePlaceholder
                description={t('message.check-spelling-or-try-shorter-term')}
                icon={<NoSearch className="tw:text-secondary" />}
                title={t('label.no-matching-result-plural')}
              />
            ) : (
              <NoDataPlaceholder
                icon={<ClipboardCheck className="tw:text-fg-quaternary" />}
                title={t('label.no-entity-available', {
                  entity: t('label.test-case-plural'),
                })}
              />
            ),
          }}
          pagination={false}
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (selectedRowKeys) => {
              setSelectedKeys(selectedRowKeys as string[]);
              handleSelection(selectedRowKeys as string[]);
            },
            preserveSelectedRowKeys: true, // Preserve selections across page changes
          }}
          searchProps={{
            placeholder: t('label.search-by-type', {
              type: t('label.name'),
            }),
            onSearch: (value) => {
              setSearchValue(value);
              fetchAllTests({
                offset: 0,
                limit: pageSize,
                q: value,
              });
            },
          }}
        />
      </div>

      <TestCaseFormDrawer
        open={isTestCaseDrawerOpen}
        table={table}
        testLevel={TestLevel.TABLE}
        onClose={handleCloseTestCaseDrawer}
        onFormSubmit={handleTestCaseSubmit}
      />
    </ContractFormStep>
  );
};
