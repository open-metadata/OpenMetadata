/*
 *  Copyright 2024 Collate.
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

import { Drawer, Select, Space, Table, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RDF_INDEX_APP_NAME } from '../../../../constants/Applications.constant';
import { getRdfReindexFailures } from '../../../../rest/rdfAPI';
import { getReindexFailures } from '../../../../rest/searchAPI';
import { formatDateTimeWithTimezone } from '../../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { ColumnsType } from '../../../common/Table/Table.interface';
import {
  ReindexFailureRecord,
  ReindexFailuresProps,
} from './ReindexFailures.interface';

const PAGE_SIZE = 20;

const ReindexFailures = ({
  visible,
  onClose,
  appName,
}: ReindexFailuresProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReindexFailureRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>(
    undefined
  );
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const requestSequence = useRef(0);
  const invalidatePendingRequest = useCallback(() => {
    requestSequence.current++;
  }, []);

  const fetchFailures = useCallback(
    async (page: number, entityType?: string) => {
      const requestId = ++requestSequence.current;
      setLoading(true);
      try {
        const fetcher =
          appName === RDF_INDEX_APP_NAME
            ? getRdfReindexFailures
            : getReindexFailures;
        const response = await fetcher({
          offset: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
          entityType,
        });
        if (requestId !== requestSequence.current) {
          return;
        }
        setData(response.data);
        setTotal(response.total);

        if (page === 1 && !entityType && response.data.length > 0) {
          const types = [...new Set(response.data.map((f) => f.entityType))];
          setEntityTypes(types);
        }
      } catch (error) {
        if (requestId === requestSequence.current) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (requestId === requestSequence.current) {
          setLoading(false);
        }
      }
    },
    [appName]
  );

  useEffect(() => {
    if (visible) {
      setCurrentPage(1);
      setEntityTypeFilter(undefined);
      setEntityTypes([]);
      setData([]);
      setTotal(0);
      fetchFailures(1);
    }

    return invalidatePendingRequest;
  }, [fetchFailures, invalidatePendingRequest, visible]);

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      fetchFailures(page, entityTypeFilter);
    },
    [entityTypeFilter, fetchFailures]
  );

  const handleEntityTypeChange = useCallback(
    (value: string | undefined) => {
      setEntityTypeFilter(value);
      setCurrentPage(1);
      fetchFailures(1, value);
    },
    [fetchFailures]
  );

  const columns: ColumnsType<ReindexFailureRecord> = useMemo(
    () => [
      {
        title: t('label.entity-type'),
        dataIndex: 'entityType',
        key: 'entityType',
        width: 120,
        render: (text: string) => (
          <Typography.Text className="font-medium">{text}</Typography.Text>
        ),
      },
      {
        title: t('label.entity-id', { entity: t('label.entity') }),
        dataIndex: 'entityId',
        key: 'entityId',
        width: 150,
        ellipsis: true,
        render: (text: string) => (
          <Typography.Text copyable={Boolean(text)}>
            {text || '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('label.stage'),
        dataIndex: 'failureStage',
        key: 'failureStage',
        width: 100,
        render: (text: string) => (
          <Typography.Text>{text || '-'}</Typography.Text>
        ),
      },
      {
        title: t('label.error'),
        dataIndex: 'errorMessage',
        key: 'errorMessage',
        width: 400,
        render: (text: string) =>
          text ? (
            <Tooltip
              overlayStyle={{ maxWidth: 500 }}
              placement="topLeft"
              title={<pre className="m-0 whitespace-pre-wrap">{text}</pre>}>
              <Typography.Paragraph
                copyable
                className="m-b-0"
                ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}>
                {text}
              </Typography.Paragraph>
            </Tooltip>
          ) : (
            '-'
          ),
      },
      {
        title: t('label.timestamp'),
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 180,
        render: (timestamp: number) => formatDateTimeWithTimezone(timestamp),
      },
    ],
    [t]
  );

  return (
    <Drawer
      destroyOnClose
      open={visible}
      placement="right"
      title={t('label.reindex-failure-plural')}
      width={900}
      onClose={onClose}>
      <Space className="w-full m-b-md" direction="vertical" size="small">
        <Space>
          <Typography.Text>{t('label.filter-by-entity-type')}:</Typography.Text>
          <Select
            allowClear
            placeholder={t('label.all')}
            style={{ width: 200 }}
            value={entityTypeFilter}
            onChange={handleEntityTypeChange}>
            {entityTypes.map((type) => (
              <Select.Option key={type} value={type}>
                {type}
              </Select.Option>
            ))}
          </Select>
        </Space>
      </Space>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: (total) =>
            t('label.showing-total-failure-plural', { total }),
          onChange: handlePageChange,
        }}
        rowKey="id"
        scroll={{ y: 'calc(100vh - 280px)' }}
        size="small"
      />
    </Drawer>
  );
};

export default ReindexFailures;
