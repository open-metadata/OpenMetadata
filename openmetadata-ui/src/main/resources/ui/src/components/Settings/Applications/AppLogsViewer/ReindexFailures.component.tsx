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

import {
  Box,
  Button,
  Select,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { RDF_INDEX_APP_NAME } from '../../../../constants/Applications.constant';
import { getRdfReindexFailures } from '../../../../rest/rdfAPI';
import { getReindexFailures } from '../../../../rest/searchAPI';
import { formatDateTimeWithTimezone } from '../../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import CopyToClipboardButton from '../../../common/CopyToClipboardButton/CopyToClipboardButton';
import { ColumnsType } from '../../../common/Table/Table.interface';
import Table from '../../../common/Table/TableV2';
import {
  ReindexFailureRecord,
  ReindexFailuresProps,
} from './ReindexFailures.interface';

const PAGE_SIZE = 20;
const ALL_ENTITY_TYPES_KEY = '__all__';

const ErrorMessage = ({ text }: { text: string }) => {
  const { t } = useTranslation();
  const textRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);

  useLayoutEffect(() => {
    const clampEl = textRef.current?.querySelector('p');
    if (clampEl && !isExpanded) {
      setIsClamped(clampEl.scrollHeight > clampEl.clientHeight);
    }
  }, [text, isExpanded]);

  return (
    <Box align="start" direction="row" gap={1}>
      <Box className="tw:min-w-0 tw:flex-1" direction="col" ref={textRef}>
        <Typography as="p" ellipsis={isExpanded ? false : { rows: 2 }}>
          {text}
        </Typography>
        {(isClamped || isExpanded) && (
          <Button
            noTextPadding
            color="link-color"
            data-testid="error-message-toggle"
            size="sm"
            onClick={() => setIsExpanded((expanded) => !expanded)}>
            {t(isExpanded ? 'label.less-lowercase' : 'label.more-lowercase')}
          </Button>
        )}
      </Box>
      <CopyToClipboardButton copyText={text} />
    </Box>
  );
};

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
          <Typography className="tw:text-primary" weight="medium">
            {text}
          </Typography>
        ),
      },
      {
        title: t('label.entity-id', { entity: t('label.entity') }),
        dataIndex: 'entityId',
        key: 'entityId',
        width: 150,
        ellipsis: true,
        render: (text: string) => (
          <Box inline align="center" direction="row" gap={1}>
            <Typography className="tw:text-primary">{text || '-'}</Typography>
            {text && <CopyToClipboardButton copyText={text} />}
          </Box>
        ),
      },
      {
        title: t('label.stage'),
        dataIndex: 'failureStage',
        key: 'failureStage',
        width: 100,
        render: (text: string) => (
          <Typography className="tw:text-primary">{text || '-'}</Typography>
        ),
      },
      {
        title: t('label.error'),
        dataIndex: 'errorMessage',
        key: 'errorMessage',
        width: 400,
        render: (text: string) => (text ? <ErrorMessage text={text} /> : '-'),
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

  const entityTypeItems = useMemo(
    () => [
      { id: ALL_ENTITY_TYPES_KEY, label: t('label.all') },
      ...entityTypes.map((type) => ({ id: type, label: type })),
    ],
    [entityTypes, t]
  );

  return (
    <SlideoutMenu
      isDismissable
      data-testid="reindex-failures-drawer"
      isOpen={visible}
      width={900}
      onOpenChange={(isOpen) => !isOpen && onClose()}>
      {({ close }) => (
        <>
          <SlideoutMenu.Header onClose={close}>
            <Typography size="text-lg" weight="semibold">
              {t('label.reindex-failure-plural')}
            </Typography>
          </SlideoutMenu.Header>
          <SlideoutMenu.Content>
            <Box className="tw:mb-4" direction="col" gap={2}>
              <Box align="center" direction="row" gap={2}>
                <Typography>{t('label.filter-by-entity-type')}:</Typography>
                <Select
                  aria-label={t('label.filter-by-entity-type')}
                  className="tw:w-50"
                  items={entityTypeItems}
                  selectedKey={entityTypeFilter ?? ALL_ENTITY_TYPES_KEY}
                  onSelectionChange={(key) =>
                    handleEntityTypeChange(
                      key && key !== ALL_ENTITY_TYPES_KEY
                        ? String(key)
                        : undefined
                    )
                  }>
                  {(item) => (
                    <Select.Item id={item.id} key={item.id}>
                      {item.label}
                    </Select.Item>
                  )}
                </Select>
              </Box>
              {total > 0 && (
                <Typography className="tw:text-tertiary">
                  {t('label.showing-total-failure-plural', { total })}
                </Typography>
              )}
            </Box>

            <Table
              columns={columns}
              dataSource={data}
              loading={loading}
              pagination={{
                current: currentPage,
                pageSize: PAGE_SIZE,
                showSizeChanger: false,
                total,
              }}
              rowKey="id"
              // Columns are fixed widths summing 950px (120+150+100+400+180) — wider
              // than the 900px drawer, so the table scrolls sideways.
              scroll={{ x: 950 }}
              size="small"
              onChange={({ current }) => handlePageChange(current ?? 1)}
            />
          </SlideoutMenu.Content>
        </>
      )}
    </SlideoutMenu>
  );
};

export default ReindexFailures;
