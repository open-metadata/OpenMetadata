/*
 *  Copyright 2026 Collate.
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
  EmptyPlaceholder,
  EmptyPlaceholderAction,
  Table,
} from '@openmetadata/ui-core-components';
import { Typography } from 'antd';
import { useMemo } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as EmptyTableSuiteIcon } from '../../../../assets/svg/ic-empty-table-suite.svg';
import { DQ_CHART_SUCCESS_COLOR } from '../../../../constants/Color.constants';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { TestSuite, TestSummary } from '../../../../generated/tests/testCase';
import { Paging } from '../../../../generated/type/paging';
import { DataQualitySubTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import NextPrevious from '../../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import { ProfilerTabPath } from '../../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import ProfilerProgressWidget from '../../../Database/Profiler/TableProfiler/ProfilerProgressWidget/ProfilerProgressWidget';

// Fixed widths for the compact columns so the name column flexes to fill the
// remaining (and largest) share of the table width.
const COLUMN_WIDTH: Record<string, number> = {
  tests: 100,
  success: 220,
  owners: 180,
};

export interface TestSuitesTableProps {
  columnList: { id: string; name: string; allowsSorting?: boolean }[];
  data: TestSuite[];
  isLoading: boolean;
  subTab: DataQualitySubTabs;
  hasActiveFilters: boolean;
  sortDescriptor?: SortDescriptor;
  onSortChange: (sortDescriptor: SortDescriptor) => void;
  currentPage: number;
  pageSize: number;
  paging: Paging;
  showPagination: boolean;
  pagingHandler: (params: PagingHandlerParams) => void;
  onShowSizeChange: (size: number) => void;
  emptyStateAction?: EmptyPlaceholderAction;
}

/**
 * Shared Test Suites table (columns, rows, empty state, pagination) used by both
 * the OSS and AI renderers. Data comes from {@link useTestSuitesListPage}; only
 * the surrounding filter chrome differs per mode.
 */
export const TestSuitesTable = ({
  columnList,
  data,
  isLoading,
  subTab,
  hasActiveFilters,
  sortDescriptor,
  onSortChange,
  currentPage,
  pageSize,
  paging,
  showPagination,
  pagingHandler,
  onShowSizeChange,
  emptyStateAction,
}: TestSuitesTableProps) => {
  const { t } = useTranslation();

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
        strokeColor={DQ_CHART_SUCCESS_COLOR}
        value={percent}
      />
    );
  };

  const renderRow = (record: TestSuite) => (
    <Table.Row id={record.id ?? record.name} key={record.id ?? record.name}>
      <Table.Cell>{renderNameCell(record)}</Table.Cell>
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
    let title = t('message.no-table-suites-yet');
    let description = t('message.no-table-suites-yet-description');

    if (hasActiveFilters) {
      title = t('message.no-matching-test-suites');
      description = t('message.no-matching-test-suites-description');
    } else if (subTab === DataQualitySubTabs.BUNDLE_SUITES) {
      title = t('message.no-bundle-suites-yet');
      description = t('message.no-bundle-suites-yet-description');
    }

    return (
      <Box className="tw:relative tw:min-h-80 tw:w-full">
        <EmptyPlaceholder
          actions={
            !hasActiveFilters && emptyStateAction
              ? [emptyStateAction]
              : undefined
          }
          description={description}
          icon={<EmptyTableSuiteIcon className="tw:text-fg-brand-primary" />}
          title={title}
          variant="blank"
        />
      </Box>
    );
  }, [hasActiveFilters, subTab, t, emptyStateAction]);

  return (
    <>
      <Table
        aria-label={t('label.test-suite-plural')}
        data-testid="test-suite-table"
        sortDescriptor={sortDescriptor}
        onSortChange={onSortChange}>
        <Table.Header columns={columnList}>
          {(col) => (
            <Table.Head
              allowsSorting={col.allowsSorting}
              id={col.id}
              isRowHeader={col.id === 'name'}
              key={col.id}
              label={col.name}
              style={{ width: COLUMN_WIDTH[col.id] }}
            />
          )}
        </Table.Header>
        <Table.Body
          items={isLoading ? [] : data}
          renderEmptyState={() => (isLoading ? <></> : noDataPlaceholder)}>
          {(record) => renderRow(record)}
        </Table.Body>
      </Table>

      {showPagination && (
        <NextPrevious
          isNumberBased
          currentPage={currentPage}
          isLoading={isLoading}
          pageSize={pageSize}
          paging={paging}
          pagingHandler={pagingHandler}
          onShowSizeChange={onShowSizeChange}
        />
      )}
    </>
  );
};

export default TestSuitesTable;
