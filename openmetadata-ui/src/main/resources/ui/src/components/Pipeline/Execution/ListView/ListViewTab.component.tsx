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

import { ButtonUtility } from '@openmetadata/ui-core-components';
import { LinkExternal01 } from '@openmetadata/ui-core-components/icons';
import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PipelineStatus,
  StatusType,
} from '../../../../generated/entity/data/pipeline';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import {
  getTableViewData,
  StatusIndicator,
  ViewDataInterface,
} from '../../../../utils/executionUtils';
import { formatNumberWithComma } from '../../../../utils/NumberUtils';
import NoSearchResultsPlaceholder from '../../../common/EmptyPlaceholder/NoSearchResultsPlaceholder';
import Table from '../../../common/Table/TableV2';
import {
  LIST_VIEW_SCROLL,
  OPTIONAL_COLUMN_KEYS,
} from './ListViewTab.constants';

interface ListViewProps {
  executions: Array<PipelineStatus> | undefined;
  status: string;
  loading: boolean;
  searchString: string | undefined;
  handleSearch: (value: string) => void;
}

const renderCount = (value?: number) => (
  <span className="tw:tabular-nums">
    {isUndefined(value) ? '--' : formatNumberWithComma(value)}
  </span>
);

const renderNoWrap = (value?: string) => (
  <span className="tw:whitespace-nowrap">{value ?? '--'}</span>
);

const ListView = ({
  executions,
  status,
  loading,
  searchString,
  handleSearch,
}: ListViewProps) => {
  const { t } = useTranslation();

  const tableData = useMemo(
    () => getTableViewData(executions, status, searchString),
    [executions, status, searchString]
  );

  const searchProps = useMemo(
    () => ({
      removeMargin: true,
      placeholder: t('message.filter-task-name-description'),
      searchValue: searchString,
      typingInterval: 500,
      onSearch: handleSearch,
    }),
    [t, searchString, handleSearch]
  );

  const reportedColumnKeys = useMemo(
    () =>
      new Set(
        OPTIONAL_COLUMN_KEYS.filter((key) =>
          tableData?.some((row) => !isUndefined(row[key]))
        )
      ),
    [tableData]
  );

  const columns = useMemo(
    () =>
      [
        {
          title: t('label.name'),
          dataIndex: 'name',
          key: 'name',
          render: renderNoWrap,
        },
        {
          title: t('label.status'),
          dataIndex: 'status',
          key: 'status',
          render: (status: StatusType) => <StatusIndicator status={status} />,
        },
        {
          title: t('label.date-and-time'),
          dataIndex: 'timestamp',
          key: 'timestamp',
          render: renderNoWrap,
        },
        {
          title: t('label.start-entity', { entity: t('label.time') }),
          dataIndex: 'startTime',
          key: 'startTime',
          render: (startTime: number) =>
            renderNoWrap(startTime ? formatDateTime(startTime) : undefined),
        },
        {
          title: t('label.end-entity', { entity: t('label.time') }),
          dataIndex: 'endTime',
          key: 'endTime',
          render: (endTime: number) =>
            renderNoWrap(endTime ? formatDateTime(endTime) : undefined),
        },
        {
          title: t('label.duration'),
          dataIndex: 'duration',
          key: 'duration',
          render: (duration: string, record: { name: string }) => (
            <span
              className="tw:whitespace-nowrap"
              data-testid={`duration-${record.name}`}>
              {duration}
            </span>
          ),
        },
        {
          title: t('label.rows-read'),
          dataIndex: 'rowsRead',
          key: 'rowsRead',
          align: 'right' as const,
          render: renderCount,
        },
        {
          title: t('label.rows-written'),
          dataIndex: 'rowsWritten',
          key: 'rowsWritten',
          align: 'right' as const,
          render: renderCount,
        },
        {
          title: t('label.log'),
          dataIndex: 'logLink',
          key: 'logLink',
          align: 'center' as const,
          render: (logLink: string | undefined, record: { name: string }) =>
            logLink ? (
              <ButtonUtility
                color="tertiary"
                data-testid={`log-link-${record.name}`}
                href={logLink}
                icon={LinkExternal01}
                rel="noopener noreferrer"
                size="xs"
                target="_blank"
                tooltip={t('label.view-entity', { entity: t('label.log') })}
              />
            ) : (
              '--'
            ),
        },
      ].filter(
        (column) =>
          !OPTIONAL_COLUMN_KEYS.includes(
            column.key as keyof ViewDataInterface
          ) || reportedColumnKeys.has(column.key as keyof ViewDataInterface)
      ),
    [t, reportedColumnKeys]
  );

  return (
    <Table
      className="h-full"
      columns={columns}
      data-testid="list-view-table"
      dataSource={tableData}
      loading={loading}
      locale={{
        emptyText: (
          <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
            <NoSearchResultsPlaceholder data-testid="search-error-placeholder" />
          </div>
        ),
      }}
      pagination={false}
      rowKey={(record) => `${record.name}-${record.status}-${record.key}`}
      scroll={LIST_VIEW_SCROLL}
      searchProps={searchProps}
    />
  );
};

export default ListView;
