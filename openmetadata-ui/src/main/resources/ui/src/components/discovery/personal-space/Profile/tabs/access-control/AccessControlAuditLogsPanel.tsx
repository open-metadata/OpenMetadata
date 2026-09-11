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
  Badge,
  Box,
  Button,
  ButtonUtility,
  Card,
  DateRangePicker,
  Dialog,
  EmptyPlaceholder,
  Input,
  Modal,
  ModalOverlay,
  PaginationCardWithControls,
  ProgressBarBase,
  Typography,
} from '@openmetadata/ui-core-components';
import { getLocalTimeZone, today } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';
import { SearchLg, XClose } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { debounce, isString } from 'lodash';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ExportIcon } from '../../../../../../assets/svg/ic-download.svg';
import AccessControlAuditLogFilters from './AccessControlAuditLogFilters';
import AuditLogList from '../../../../../../components/AuditLog/AuditLogList.component';
import '../../../../../../components/common/atoms/filters/FilterSelection.less';
import Banner from '../../../../../../components/common/Banner/Banner';
import { CSVExportWebsocketResponse } from '../../../../../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
  SOCKET_EVENTS,
} from '../../../../../../constants/constants';
import { useWebSocketConnector } from '../../../../../../context/WebSocketProvider/WebSocketProvider';
import { Paging } from '../../../../../../generated/type/paging';
import {
  exportAuditLogs,
  getAuditLogExportJob,
  getAuditLogExportResult,
  getAuditLogs,
} from '../../../../../../rest/auditLogAPI';
import {
  AuditLogActiveFilter,
  AuditLogEntry,
  AuditLogListParams,
  AuditLogListResponse,
} from '../../../../../../types/auditLogs.interface';
import { buildParamsFromFilters } from '../../../../../../utils/AuditLogUtils';
import { CUSTOM_DATE_RANGE_KEY } from '../../../../../../utils/DatePickerMenuUtils';
import { showErrorToast, showSuccessToast } from '../../../../../../utils/ToastUtils';

const EXPORT_POLL_INTERVAL_MS = 5000;

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

interface AccessControlAuditLogsPanelProps {
  /** Callback to inject action buttons into the page header. */
  onSetHeaderActions?: (actions: React.ReactNode) => void;
}

const AccessControlAuditLogsPanel: React.FC<AccessControlAuditLogsPanelProps> = ({
  onSetHeaderActions,
}) => {
  const { t } = useTranslation();
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
  const [exportDateRange, setExportDateRange] = useState<{ start: DateValue; end: DateValue } | null>(null);
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

  const [searchInputValue, setSearchInputValue] = useState('');

  const debouncedSearch = useMemo(
    () => debounce(handleSearchChange, 300),
    [handleSearchChange]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleClearFilters = useCallback(() => {
    debouncedSearch.cancel();
    setActiveFilters([]);
    setFilterParams({});
    filterParamsRef.current = {};
    setSearchTerm('');
    searchTermRef.current = '';
    setCurrentPage(1);
    setSearchInputValue('');
    fetchAuditLogs({ after: undefined, before: undefined }, {});
  }, [debouncedSearch, fetchAuditLogs]);

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

    const now = DateTime.now();
    const fileName = `audit_logs_${now.toFormat('yyyyMMdd_HHmmss')}.json`;

    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();

    URL.revokeObjectURL(element.href);
    element.remove();
  }, []);

  const completeExport = useCallback(
    (data: string) => {
      handleExportDownload(data);
      showSuccessToast(t('message.export-successful'));
      setIsExporting(false);
      setIsExportModalOpen(false);
      setExportJob(null);
      exportJobRef.current = null;
    },
    [handleExportDownload, t]
  );

  const downloadExportResult = useCallback(
    (jobId: string) => {
      getAuditLogExportResult(jobId)
        .then(completeExport)
        .catch((error) => {
          showErrorToast(error as AxiosError);
          setIsExporting(false);
        });
    },
    [completeExport]
  );

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

      if (response.status === 'COMPLETED') {
        if (isString(response.data)) {
          completeExport(response.data);
        } else {
          downloadExportResult(response.jobId);
        }
      } else if (response.status === 'FAILED') {
        setIsExporting(false);
      }
    },
    [completeExport, downloadExportResult]
  );

  useEffect(() => {
    if (!isExporting || !exportJob?.jobId) {
      return;
    }

    const jobId = exportJob.jobId;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const pollOnce = async () => {
      try {
        const job = await getAuditLogExportJob(jobId);

        if (cancelled || exportJobRef.current?.jobId !== jobId) {
          return;
        }

        if (job.status === 'COMPLETED') {
          downloadExportResult(jobId);

          return;
        }

        if (job.status === 'FAILED' || job.status === 'CANCELLED') {
          setExportJob({ ...job, jobId });
          exportJobRef.current = { ...job, jobId };
          setIsExporting(false);

          return;
        }
      } catch {
        // A transient failure must not end the export; the next tick retries.
      }

      if (!cancelled) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- mutually recursive with pollOnce
        scheduleNextPoll();
      }
    };

    const scheduleNextPoll = () => {
      timeoutId = setTimeout(pollOnce, EXPORT_POLL_INTERVAL_MS);
    };

    scheduleNextPoll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isExporting, exportJob?.jobId, downloadExportResult]);

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

  // Inject the Export button into the page header.
  useEffect(() => {
    if (!onSetHeaderActions) {
      return;
    }

    onSetHeaderActions(
      <Button
        color="primary"
        data-testid="export-audit-logs-button"
        iconLeading={<ExportIcon height={16} width={16} />}
        onPress={() => setIsExportModalOpen(true)}>
        {t('label.export')}
      </Button>
    );
  }, [onSetHeaderActions, t]);

  const handleExport = useCallback(async () => {
    if (!exportDateRange) {
      return;
    }

    setIsExporting(true);
    try {
      const tz = getLocalTimeZone();
      const startTs = exportDateRange.start.toDate(tz).setHours(0, 0, 0, 0);
      const endTs = exportDateRange.end.toDate(tz).setHours(23, 59, 59, 999);
      const response = await exportAuditLogs({
        startTs,
        endTs,
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
      setExportDateRange(null as null);
      setExportJob(null);
      exportJobRef.current = null;
    }
  }, [isExporting]);

  const hasActiveFilters =
    activeFilters.length > 0 || Boolean(searchTerm.trim());

  const exportProgress =
    exportJob?.total && exportJob.total > 0
      ? Math.round(((exportJob.progress ?? 0) / exportJob.total) * 100)
      : 0;

  const renderExportProgress = () =>
    exportJob?.status === 'IN_PROGRESS' ? (
      <Box className="tw:flex tw:flex-col tw:gap-2">
        <ProgressBarBase value={exportProgress} />
        <Typography as="p" className="tw:mt-2" size="text-md">
          {exportJob.message ?? t('message.exporting')}
        </Typography>
      </Box>
    ) : null;

  const renderExportResult = () =>
    exportJob && exportJob.status !== 'IN_PROGRESS' ? (
      <Banner
        className="border-radius"
        isLoading={isExporting && !exportJob.error}
        message={exportJob.error ?? exportJob.message ?? ''}
        type={exportJob.error ? 'error' : 'success'}
      />
    ) : null;

  return (
    <Box
      className="tw:flex tw:flex-col tw:flex-1 tw:min-h-0 tw:overflow-hidden tw:px-6"
      data-testid="audit-logs-page">

      {/* Card wrapping filters + log list */}
      <Card className="tw:flex tw:flex-col tw:flex-1 tw:min-h-0 tw:overflow-hidden tw:mb-3">
        {/* Filters row inside card */}
        <Box
          className="tw:shrink-0 tw:p-4 tw:border-b tw:border-secondary"
          direction="col">
          <Box className="tw:flex tw:items-center tw:gap-4" direction="row">
            <Box
              className="tw:shrink-0"
              data-testid="audit-log-search-container">
              <Input
                className="tw:max-w-86"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                icon={SearchLg as any}
                inputDataTestId="audit-log-search"
                placeholder={t('label.search-audit-logs')}
                value={searchInputValue}
                onChange={(value) => {
                  setSearchInputValue(value);
                  debouncedSearch(value);
                }}
              />
            </Box>
            <AccessControlAuditLogFilters
              activeFilters={activeFilters}
              onFiltersChange={handleFiltersChange}
            />
          </Box>

          {hasActiveFilters && (
            <Box
              className="tw:flex tw:items-center tw:w-full tw:mt-2"
              data-testid="filter-selection-container"
              direction="row">
              <Box className="tw:flex tw:gap-2 tw:flex-wrap tw:flex-1" direction="row">
                {activeFilters.map((filter) => (
                  <Badge
                    className="tw:outline-0 tw:gap-1"
                    color="brand"
                    key={filter.category}
                    size="lg"
                    type="color">
                    <Box
                      className="tw:flex tw:items-center tw:gap-1"
                      data-testid={`filter-chip-${filter.category}`}
                      direction="row">
                      <Typography
                        className="tw:text-tertiary"
                        weight="medium">
                        {filter.categoryLabel}:{' '}
                      </Typography>
                      <Box className="tw:max-w-80">
                        <Typography
                          ellipsis
                          as="p"
                          className="tw:text-brand-600"
                          title={filter.value.label}
                          weight="medium">
                          {filter.category === 'time' &&
                          filter.value.key === CUSTOM_DATE_RANGE_KEY
                            ? t('label.custom-range')
                            : filter.value.label}
                        </Typography>
                      </Box>
                    </Box>
                    <ButtonUtility
                      aria-label="Remove filter"
                      color="tertiary"
                      data-testid={`remove-filter-${filter.category}`}
                      icon={<XClose size={14} />}
                      onClick={() => handleRemoveFilter(filter.category)}
                    />
                  </Badge>
                ))}
              </Box>
              <Button
                color="link-color"
                data-testid="clear-filters"
                onPress={handleClearFilters}>
                {t('label.clear-entity', {
                  entity: t('label.all-lowercase'),
                })}
              </Button>
            </Box>
          )}
        </Box>

        {/* Log list inside card */}
        <Box className="tw:flex-1 tw:min-h-0 tw:overflow-auto">
          {!isLoading && logs.length === 0 ? (
            <Box className="tw:flex tw:items-center tw:justify-center tw:h-full tw:py-12">
              <EmptyPlaceholder
                title={t('label.no-entity-found', {
                  entity: t('label.audit-log-plural'),
                })}
              />
            </Box>
          ) : (
            <AuditLogList isLoading={isLoading} logs={logs} />
          )}
        </Box>

        {/* Pagination inside card */}
        {(paging.total ?? 0) > pageSize && (
          <Box className="tw:shrink-0 tw:border-t tw:border-secondary">
            <PaginationCardWithControls
              page={currentPage}
              pageSize={pageSize}
              pageSizeOptions={[PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE]}
              total={Math.max(1, Math.ceil((paging.total ?? 0) / pageSize))}
              onPageChange={(newPage) => {
                if (newPage > currentPage && paging.after) {
                  setCurrentPage(newPage);
                  fetchAuditLogs({ after: paging.after });
                } else if (newPage < currentPage && paging.before) {
                  setCurrentPage(newPage);
                  fetchAuditLogs({ before: paging.before });
                }
              }}
              onPageSizeChange={handlePageSizeChange}
            />
          </Box>
        )}
      </Card>

      {/* Export modal */}
      <ModalOverlay
        isDismissable={!isExporting}
        isOpen={isExportModalOpen}
        onOpenChange={(open) => !open && handleExportModalClose()}>
        <Modal>
          <Dialog
            data-testid="export-audit-logs-modal"
            showCloseButton={!isExporting}
            title={t('label.export-entity', {
              entity: t('label.audit-log-plural'),
            })}
            onClose={handleExportModalClose}>
            <Dialog.Content>
              <Typography as="p" size="text-md">
                {t('message.export-audit-logs-description')}
              </Typography>
              <Box className="tw:flex tw:flex-col tw:gap-2">
                <Typography
                  as="p"
                  className="tw:text-gray-400"
                  size="text-md">
                  {`${t('label.date-range')} *`}
                </Typography>
                <DateRangePicker
                  data-testid="export-date-range-picker"
                  isDisabled={isExporting}
                  maxValue={today(getLocalTimeZone()) as any} // eslint-disable-line @typescript-eslint/no-explicit-any
                  value={exportDateRange as any} // eslint-disable-line @typescript-eslint/no-explicit-any
                  onChange={(range: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
                    setExportDateRange(
                      range
                        ? { start: range.start as DateValue, end: range.end as DateValue }
                        : null
                    )
                  }
                />
              </Box>
              {renderExportProgress()}
              {renderExportResult()}
            </Dialog.Content>
            <Dialog.Footer>
              <Button
                color="tertiary"
                isDisabled={isExporting}
                onPress={handleExportModalClose}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                isDisabled={isExporting || !exportDateRange}
                isLoading={isExporting}
                onPress={handleExport}>
                {t('label.export')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </Box>
  );
};

export default AccessControlAuditLogsPanel;
