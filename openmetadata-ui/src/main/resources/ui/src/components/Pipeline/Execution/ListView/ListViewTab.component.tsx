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

import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ExternalLinkIcon } from '../../../../assets/svg/external-links.svg';
import {
  PipelineStatus,
  StatusType,
} from '../../../../generated/entity/data/pipeline';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import {
  getTableViewData,
  StatusIndicator,
} from '../../../../utils/executionUtils';
import { formatNumberWithComma } from '../../../../utils/NumberUtils';
import NoSearchResultsPlaceholder from '../../../common/EmptyPlaceholder/NoSearchResultsPlaceholder';
import Table from '../../../common/Table/TableV2';

interface ListViewProps {
  executions: Array<PipelineStatus> | undefined;
  status: string;
  loading: boolean;
  searchString: string | undefined;
  handleSearch: (value: string) => void;
}

const renderCount = (value?: number) =>
  isUndefined(value) ? '--' : formatNumberWithComma(value);

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
    [searchString, handleSearch]
  );

  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
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
      },
      {
        title: t('label.start-entity', { entity: t('label.time') }),
        dataIndex: 'startTime',
        key: 'startTime',
        render: (startTime: number) =>
          startTime ? formatDateTime(startTime) : '--',
      },
      {
        title: t('label.end-entity', { entity: t('label.time') }),
        dataIndex: 'endTime',
        key: 'endTime',
        render: (endTime: number) => (endTime ? formatDateTime(endTime) : '--'),
      },
      {
        title: t('label.duration'),
        dataIndex: 'duration',
        key: 'duration',
        render: (duration: string, record: { name: string }) => (
          <span data-testid={`duration-${record.name}`}>{duration}</span>
        ),
      },
      {
        title: t('label.rows-read'),
        dataIndex: 'rowsRead',
        key: 'rowsRead',
        render: renderCount,
      },
      {
        title: t('label.rows-written'),
        dataIndex: 'rowsWritten',
        key: 'rowsWritten',
        render: renderCount,
      },
      {
        title: t('label.rows-filtered'),
        dataIndex: 'rowsFiltered',
        key: 'rowsFiltered',
        render: renderCount,
      },
      {
        title: t('label.execution-time'),
        dataIndex: 'executionTime',
        key: 'executionTime',
        render: (executionTime?: string) => executionTime ?? '--',
      },
      {
        title: t('label.log'),
        dataIndex: 'logLink',
        key: 'logLink',
        render: (logLink: string | undefined, record: { name: string }) =>
          logLink ? (
            <a
              className="flex items-center gap-2"
              data-testid={`log-link-${record.name}`}
              href={logLink}
              rel="noopener noreferrer"
              target="_blank">
              {t('label.view-entity', { entity: t('label.log') })}
              <ExternalLinkIcon className="tw:ml-2 tw:shrink-0 tw:size-3.5" />
            </a>
          ) : (
            '--'
          ),
      },
    ],
    []
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
      searchProps={searchProps}
    />
  );
};

export default ListView;
