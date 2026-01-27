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

import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  DatePicker,
  Input,
  Modal,
  Progress,
  Row,
  Space,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuditLogFilters, AuditLogList } from '../../components/AuditLog';
import Banner from '../../components/common/Banner/Banner';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import { CSVExportWebsocketResponse } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { PAGE_SIZE_MEDIUM, SOCKET_EVENTS } from '../../constants/constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { useWebSocketConnector } from '../../context/WebSocketProvider/WebSocketProvider';
import { CursorType } from '../../enums/pagination.enum';
import { Paging } from '../../generated/type/paging';
import { exportAuditLogs, getAuditLogs } from '../../rest/auditLogAPI';
import {
  AuditLogActiveFilter,
  AuditLogEntry,
  AuditLogListParams,
  AuditLogListResponse,
} from '../../types/auditLogs.interface';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './AuditLogsPage.less';

const INITIAL_PAGING: Paging = {
  total: 0,
};

interface ExportJob {
  jobId: string;
  message?: string;
  error?: string;
  status?: string;
  progress?: number;
  total?: number;
}

const AuditLogsPage = () => {
  const { t } = useTranslation();
  const { socket } = useWebSocketConnector();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [paging, setPaging] = useState<Paging>(INITIAL_PAGING);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<AuditLogActiveFilter[]>(
    []
  );
  const [filterParams, setFilterParams] = useState<Partial<AuditLogListParams>>(
    {}
  );

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<[Dayjs, Dayjs] | null>(
    null
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const exportJobRef = useRef<ExportJob | null>(null);

  const fetchAuditLogs = useCallback(
    async (
      cursorParams?: { after?: string; before?: string },
      explicitFilterParams?: Partial<AuditLogListParams>
    ) => {
      setIsLoading(true);
      try {
        const queryParams: AuditLogListParams = {
          limit: PAGE_SIZE_MEDIUM,
          after: cursorParams?.after,
          before: cursorParams?.before,
          q: searchTerm || undefined,
          ...(explicitFilterParams ?? filterParams),
        };

        const response: AuditLogListResponse = await getAuditLogs(queryParams);
        setLogs(response.data);
        setPaging(response.paging ?? INITIAL_PAGING);
      } catch (error) {
        showErrorToast(error as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, filterParams]
  );

  useEffect(() => {
    setCurrentPage(1);
    fetchAuditLogs({ after: undefined, before: undefined });
  }, [fetchAuditLogs]);

  const handlePaging = useCallback(
    ({ cursorType, currentPage: requestedPage }: PagingHandlerParams) => {
      if (cursorType === CursorType.AFTER && paging?.after) {
        setCurrentPage(requestedPage);
        fetchAuditLogs({ after: paging.after });
      }

      if (cursorType === CursorType.BEFORE && paging?.before) {
        setCurrentPage(requestedPage);
        fetchAuditLogs({ before: paging.before });
      }
    },
    [fetchAuditLogs, paging]
  );

  const handleFiltersChange = useCallback(
    (filters: AuditLogActiveFilter[], params: Partial<AuditLogListParams>) => {
      setActiveFilters(filters);
      setFilterParams(params);
      setCurrentPage(1);
      fetchAuditLogs({ after: undefined, before: undefined }, params);
    },
    [fetchAuditLogs]
  );

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
    setFilterParams({});
    setSearchTerm('');
    setCurrentPage(1);
    fetchAuditLogs({ after: undefined, before: undefined }, {});
  }, [fetchAuditLogs]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
    },
    []
  );

  const handleSearchPressEnter = useCallback(() => {
    setCurrentPage(1);
    fetchAuditLogs({ after: undefined, before: undefined });
  }, [fetchAuditLogs]);

  const handleExportDownload = useCallback((data: string) => {
    const element = document.createElement('a');
    const file = new Blob([data], { type: 'application/json' });

    const now = dayjs();
    const fileName = `audit_logs_${now.format('YYYYMMDD_HHmmss')}.json`;

    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();

    URL.revokeObjectURL(element.href);
    document.body.removeChild(element);
  }, []);

  const handleExportWebSocketMessage = useCallback(
    (response: CSVExportWebsocketResponse) => {
      if (!exportJobRef.current) {
        return;
      }

      const updatedJob: ExportJob = {
        ...exportJobRef.current,
        status: response.status,
        error: response.error ?? undefined,
        message: response.message,
        progress: response.progress,
        total: response.total,
      };

      setExportJob(updatedJob);
      exportJobRef.current = updatedJob;

      if (response.status === 'COMPLETED' && response.data) {
        handleExportDownload(response.data);
        showSuccessToast(t('message.export-successful'));
        setIsExporting(false);
        setIsExportModalOpen(false);
        setExportJob(null);
        exportJobRef.current = null;
      } else if (response.status === 'FAILED') {
        setIsExporting(false);
      }
      // IN_PROGRESS status just updates the progress display
    },
    [handleExportDownload, t]
  );

  useEffect(() => {
    if (socket) {
      const handleExport = (exportResponse: string) => {
        if (exportResponse) {
          const exportResponseData = JSON.parse(
            exportResponse
          ) as CSVExportWebsocketResponse;

          handleExportWebSocketMessage(exportResponseData);
        }
      };

      socket.on(SOCKET_EVENTS.CSV_EXPORT_CHANNEL, handleExport);

      return () => {
        socket.off(SOCKET_EVENTS.CSV_EXPORT_CHANNEL, handleExport);
      };
    }

    return undefined;
  }, [socket, handleExportWebSocketMessage]);

  const handleExport = useCallback(async () => {
    if (!exportDateRange) {
      return;
    }

    setIsExporting(true);
    try {
      const response = await exportAuditLogs({
        startTs: exportDateRange[0].startOf('day').valueOf(),
        endTs: exportDateRange[1].endOf('day').valueOf(),
        q: searchTerm || undefined,
        ...filterParams,
      });

      const job: ExportJob = {
        jobId: response.jobId,
        message: response.message,
      };

      setExportJob(job);
      exportJobRef.current = job;
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsExporting(false);
    }
  }, [exportDateRange, searchTerm, filterParams]);

  const handleExportModalClose = useCallback(() => {
    if (!isExporting) {
      setIsExportModalOpen(false);
      setExportDateRange(null);
      setExportJob(null);
      exportJobRef.current = null;
    }
  }, [isExporting]);

  const hasActiveFilters =
    activeFilters.length > 0 || Boolean(searchTerm.trim());

  return (
    <PageLayoutV1 pageTitle={t('label.audit-log-plural')}>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <PageHeader
            data={{
              header: t(PAGE_HEADERS.AUDIT_LOGS.header),
              subHeader: t(PAGE_HEADERS.AUDIT_LOGS.subHeader),
            }}
          />
        </Col>

        <Col span={24}>
          <Row align="middle" gutter={[16, 16]} justify="space-between">
            <Col flex="auto">
              <Space wrap className="audit-log-filters" size={8}>
                <AuditLogFilters
                  activeFilters={activeFilters}
                  onFiltersChange={handleFiltersChange}
                />
                <Input
                  allowClear
                  className="audit-log-search-input"
                  data-testid="audit-log-search"
                  placeholder={t('label.search-audit-logs')}
                  prefix={<SearchOutlined className="text-grey-muted" />}
                  style={{ width: 300 }}
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onPressEnter={handleSearchPressEnter}
                />
                {hasActiveFilters && (
                  <Button
                    data-testid="clear-filters"
                    type="link"
                    onClick={handleClearFilters}>
                    {t('label.clear')}
                  </Button>
                )}
              </Space>
            </Col>
            <Col>
              <Button
                data-testid="export-audit-logs-button"
                icon={<DownloadOutlined />}
                type="primary"
                onClick={() => setIsExportModalOpen(true)}>
                {t('label.export')}
              </Button>
            </Col>
          </Row>
        </Col>

        <Col span={24}>
          <AuditLogList isLoading={isLoading} logs={logs} />
        </Col>

        {logs.length > 0 && (
          <Col span={24}>
            <NextPrevious
              currentPage={currentPage}
              isLoading={isLoading}
              pageSize={PAGE_SIZE_MEDIUM}
              paging={paging}
              pagingHandler={handlePaging}
            />
          </Col>
        )}
      </Row>

      <Modal
        centered
        cancelButtonProps={{ disabled: isExporting }}
        cancelText={t('label.cancel')}
        closable={!isExporting}
        data-testid="export-audit-logs-modal"
        maskClosable={!isExporting}
        okButtonProps={{
          disabled: isExporting || !exportDateRange,
          loading: isExporting,
        }}
        okText={t('label.export')}
        open={isExportModalOpen}
        title={t('label.export-entity', {
          entity: t('label.audit-log-plural'),
        })}
        onCancel={handleExportModalClose}
        onOk={handleExport}>
        <Space className="w-full" direction="vertical" size={16}>
          <Typography.Text type="secondary">
            {t('message.export-audit-logs-description')}
          </Typography.Text>
          <div>
            <Typography.Text className="m-b-xs d-block">
              {t('label.date-range')} <span className="text-red-500">*</span>
            </Typography.Text>
            <DatePicker.RangePicker
              allowClear
              className="w-full"
              data-testid="export-date-range-picker"
              disabled={isExporting}
              disabledDate={(current) =>
                current && current > dayjs().endOf('day')
              }
              value={exportDateRange}
              onChange={(dates) =>
                setExportDateRange(dates as [Dayjs, Dayjs] | null)
              }
            />
          </div>
          {exportJob && exportJob.status === 'IN_PROGRESS' && (
            <div className="export-progress-container">
              <Progress
                percent={
                  exportJob.total && exportJob.total > 0
                    ? Math.round(
                        ((exportJob.progress ?? 0) / exportJob.total) * 100
                      )
                    : 0
                }
                size="small"
                status="active"
              />
              <Typography.Text className="m-t-xs d-block" type="secondary">
                {exportJob.message ?? t('message.exporting')}
              </Typography.Text>
            </div>
          )}
          {exportJob && exportJob.status !== 'IN_PROGRESS' && (
            <Banner
              className="border-radius"
              isLoading={isExporting && !exportJob.error}
              message={exportJob.error ?? exportJob.message ?? ''}
              type={exportJob.error ? 'error' : 'success'}
            />
          )}
        </Space>
      </Modal>
    </PageLayoutV1>
  );
};

export default AuditLogsPage;
