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

import {
  Box,
  Button as MuiButton,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { defaultColors } from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import { Button, Modal, Progress, Space } from 'antd';
import { AxiosError } from 'axios';
import dayjs from 'dayjs';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ExportIcon } from '../../assets/svg/ic-download.svg';
import { AuditLogFilters, AuditLogList } from '../../components/AuditLog';
import '../../components/common/atoms/filters/FilterSelection.less';
import { useBreadcrumbs } from '../../components/common/atoms/navigation/useBreadcrumbs';
import { useSearch } from '../../components/common/atoms/navigation/useSearch';
import Banner from '../../components/common/Banner/Banner';
import DatePicker from '../../components/common/DatePicker/DatePicker';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import { CSVExportWebsocketResponse } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
  SOCKET_EVENTS,
} from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
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
import { buildParamsFromFilters } from '../../utils/AuditLogUtils';
import { getSettingPath } from '../../utils/RouterUtils';
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
  const theme = useTheme();
  const { socket } = useWebSocketConnector();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [paging, setPaging] = useState<Paging>(INITIAL_PAGING);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const searchTermRef = useRef('');
  const [activeFilters, setActiveFilters] = useState<AuditLogActiveFilter[]>(
    []
  );
  const [filterParams, setFilterParams] = useState<Partial<AuditLogListParams>>(
    {}
  );
  const filterParamsRef = useRef<Partial<AuditLogListParams>>({});
  const [pageSize, setPageSize] = useState(PAGE_SIZE_MEDIUM);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<
    [DateTime, DateTime] | null
  >(null);
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
          limit: pageSize,
          after: cursorParams?.after,
          before: cursorParams?.before,
          q: searchTermRef.current || undefined,
          ...(explicitFilterParams ?? filterParamsRef.current),
        };

        const response: AuditLogListResponse = await getAuditLogs(queryParams);
        setLogs(response.data);
        setPaging(response.paging ?? INITIAL_PAGING);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize]
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

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const handleFiltersChange = useCallback(
    (filters: AuditLogActiveFilter[], params: Partial<AuditLogListParams>) => {
      setActiveFilters(filters);
      setFilterParams(params);
      filterParamsRef.current = params;
      setCurrentPage(1);
      fetchAuditLogs({ after: undefined, before: undefined }, params);
    },
    [fetchAuditLogs]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchTerm(query);
      searchTermRef.current = query;
      setCurrentPage(1);
      fetchAuditLogs({ after: undefined, before: undefined });
    },
    [fetchAuditLogs]
  );

  const { search: searchComponent, clearSearch } = useSearch({
    searchPlaceholder: t('label.search-audit-logs'),
    onSearchChange: handleSearchChange,
    testId: 'audit-log-search',
  });

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
    setFilterParams({});
    filterParamsRef.current = {};
    setSearchTerm('');
    searchTermRef.current = '';
    setCurrentPage(1);
    clearSearch();
    fetchAuditLogs({ after: undefined, before: undefined }, {});
  }, [fetchAuditLogs, clearSearch]);

  const handleRemoveFilter = useCallback(
    (category: string) => {
      const remaining = activeFilters.filter((f) => f.category !== category);
      const params = buildParamsFromFilters(remaining);
      setActiveFilters(remaining);
      setFilterParams(params);
      filterParamsRef.current = params;
      setCurrentPage(1);
      fetchAuditLogs({ after: undefined, before: undefined }, params);
    },
    [activeFilters, fetchAuditLogs]
  );

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

  const { breadcrumbs } = useBreadcrumbs({
    home: { show: false },
    items: [
      { name: t('label.setting-plural'), url: getSettingPath() },
      {
        name: t('label.access-control'),
        url: getSettingPath(GlobalSettingsMenuCategory.ACCESS),
      },
      { name: t('label.audit-log-plural'), isActive: true },
    ],
  });

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
    <PageLayoutV1
      fullHeight
      mainContainerClassName="audit-logs-page-layout"
      pageTitle={t('label.audit-log-plural')}>
      <Box
        data-testid="audit-logs-page"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}>
        <Box sx={{ flexShrink: 0, marginBottom: theme.spacing(2) }}>
          {breadcrumbs}
        </Box>
        {/* Header */}
        <Box
          data-testid="audit-logs-page-header"
          sx={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: theme.spacing(1),
            padding: theme.spacing(6),
            mb: 2,
            bgcolor: 'background.paper',
            boxShadow: 1,

            borderRadius: 1,
            border: `1px solid ${defaultColors.blueGray[100]}`,
          }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing(2 / 3),
            }}>
            <Typography
              sx={{
                color: theme.palette.grey[900],
                fontSize: theme.typography.body1.fontSize,
                fontWeight: 600,
                lineHeight: theme.typography.body1.lineHeight,
              }}>
              {t(PAGE_HEADERS.AUDIT_LOGS.header)}
            </Typography>
            <Typography
              sx={{
                color: theme.palette.grey[600],
                fontSize: theme.typography.body2.fontSize,
                fontWeight: 400,
                lineHeight: theme.typography.body2.lineHeight,
              }}>
              {t(PAGE_HEADERS.AUDIT_LOGS.subHeader)}
            </Typography>
          </Box>
          <Button
            data-testid="export-audit-logs-button"
            icon={<ExportIcon height={16} width={16} />}
            style={{
              alignItems: 'center',
              display: 'flex',
              gap: theme.spacing(2),
            }}
            type="primary"
            onClick={() => setIsExportModalOpen(true)}>
            {t('label.export')}
          </Button>
        </Box>

        {/* Content Paper */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '12px',
            border: `1px solid ${defaultColors.blueGray[100]}`,
          }}>
          {/* Filters */}
          <Box sx={{ flexShrink: 0, p: 3 }}>
            <Stack alignItems="center" direction="row" spacing={2}>
              <Box
                data-testid="audit-log-search-container"
                sx={{ flexShrink: 0 }}>
                {searchComponent}
              </Box>
              <AuditLogFilters
                activeFilters={activeFilters}
                onFiltersChange={handleFiltersChange}
              />
              <Box flexGrow={1} />
            </Stack>
            {hasActiveFilters && (
              <Box
                className="filter-selection-container"
                data-testid="filter-selection-container"
                sx={{
                  mt: 2,
                }}>
                <Box className="filter-selection-chips-wrapper">
                  {activeFilters.map((filter) => (
                    <Box
                      className="filter-selection-chip"
                      data-testid={`filter-chip-${filter.category}`}
                      key={filter.category}>
                      <Box
                        className="filter-selection-chip-content"
                        component="span">
                        <span className="filter-selection-label">
                          {filter.categoryLabel}:{' '}
                        </span>
                        <span
                          className="filter-selection-value"
                          title={filter.value.label}>
                          {filter.category === 'time' &&
                          filter.value.key === 'customRange'
                            ? t('label.custom-range')
                            : filter.value.label}
                        </span>
                      </Box>
                      <Box
                        aria-label="Remove filter"
                        className="filter-selection-remove-btn"
                        component="button"
                        data-testid={`remove-filter-${filter.category}`}
                        onClick={() => handleRemoveFilter(filter.category)}>
                        <XClose size={14} />
                      </Box>
                    </Box>
                  ))}
                </Box>
                <MuiButton
                  className="filter-selection-clear-all"
                  data-testid="clear-filters"
                  variant="text"
                  onClick={handleClearFilters}>
                  {t('label.clear-entity', {
                    entity: t('label.all-lowercase'),
                  })}
                </MuiButton>
              </Box>
            )}
          </Box>

          {/* List */}
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <AuditLogList isLoading={isLoading} logs={logs} />
          </Box>

          {/* Pagination */}
          {logs.length > 0 && (
            <Box
              sx={{
                flexShrink: 0,
                p: 2,
                display: 'flex',
                justifyContent: 'center',
                boxShadow:
                  '0 -13px 16px -4px rgba(10, 13, 18, 0.04), 0 -4px 6px -2px rgba(10, 13, 18, 0.03)',
              }}>
              <NextPrevious
                currentPage={currentPage}
                isLoading={isLoading}
                pageSize={pageSize}
                pageSizeOptions={[
                  PAGE_SIZE_BASE,
                  PAGE_SIZE_MEDIUM,
                  PAGE_SIZE_LARGE,
                ]}
                paging={paging}
                pagingHandler={handlePaging}
                onShowSizeChange={handlePageSizeChange}
              />
            </Box>
          )}
        </Paper>
      </Box>

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
          <Typography color="text.secondary">
            {t('message.export-audit-logs-description')}
          </Typography>
          <div>
            <Typography component="span" sx={{ display: 'block', mb: 1 }}>
              {t('label.date-range')}{' '}
              <Box component="span" sx={{ color: 'error.main' }}>
                *
              </Box>
            </Typography>
            <DatePicker.RangePicker
              allowClear
              className="w-full"
              data-testid="export-date-range-picker"
              disabled={isExporting}
              disabledDate={(current) => current > DateTime.now().endOf('day')}
              value={exportDateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setExportDateRange([dates[0], dates[1]]);
                } else {
                  setExportDateRange(null);
                }
              }}
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
              <Typography
                color="text.secondary"
                sx={{ display: 'block', mt: 1 }}>
                {exportJob.message ?? t('message.exporting')}
              </Typography>
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
