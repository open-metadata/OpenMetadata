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

import { getLocalTimeZone, today } from '@internationalized/date';
import {
  Badge,
  Box,
  Button,
  ButtonUtility,
  Card,
  DateRangePicker,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  PaginationCardWithControls,
  ProgressBarBase,
  Typography,
} from '@openmetadata/ui-core-components';
import { SearchLg, XClose } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { debounce, isString } from 'lodash';
import { DateTime } from 'luxon';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { DateValue } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ExportIcon } from '../../../../../../assets/svg/ic-download.svg';
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
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import { EXPORT_POLL_INTERVAL_MS } from './AccessControl.constants';
import type { ExportJob } from './AccessControl.types';
import AccessControlAuditLogFilters from './AccessControlAuditLogFilters';

const INITIAL_PAGING: Paging = {
  total: 0,
};

const MAX_PAGE_CURSORS = 100;

function trimCursorCache(cache: Record<number, string>) {
  const pages = Object.keys(cache).map(Number);

  if (pages.length > MAX_PAGE_CURSORS) {
    pages
      .toSorted((a, b) => a - b)
      .slice(0, pages.length - MAX_PAGE_CURSORS)
      .forEach((p) => delete cache[p]);
  }
}

async function walkToPageCursor(
  startCursor: string | undefined,
  startPage: number,
  targetPage: number,
  pageSize: number,
  searchTerm: string,
  filterParams: Partial<AuditLogListParams>
): Promise<{
  cursor: string | undefined;
  discoveredCursors: Record<number, string>;
}> {
  let p = startPage;
  let cursor: string | undefined = startCursor;
  const discoveredCursors: Record<number, string> = {};

  while (p < targetPage - 1) {
    // eslint-disable-next-line openmetadata-imports/no-api-calls-in-iteration -- sequential page walk
    const response: AuditLogListResponse = await getAuditLogs({
      limit: pageSize,
      after: cursor,
      q: searchTerm || undefined,
      ...filterParams,
    });
    p++;
    cursor = response.paging?.after;
    if (cursor) {
      discoveredCursors[p] = cursor;
    } else {
      break;
    }
  }

  return { cursor, discoveredCursors };
}

interface AccessControlAuditLogsPanelProps {
  /** Callback to inject action buttons into the page header. */
  onSetHeaderActions?: (actions: React.ReactNode) => void;
}

const AccessControlAuditLogsPanel: React.FC<
  AccessControlAuditLogsPanelProps
> = ({ onSetHeaderActions }) => {
  const { t } = useTranslation();
  const { socket } = useWebSocketConnector();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [paging, setPaging] = useState<Paging>(INITIAL_PAGING);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // pageCursorsRef[N] = 'after' cursor returned when page N was fetched.
  // pageCursorsRef[N] is used as the 'after' param to fetch page N+1.
  const pageCursorsRef = useRef<Record<number, string>>({});
  const fetchRequestIdRef = useRef(0);

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
  const [exportDateRange, setExportDateRange] = useState<{
    start: DateValue;
    end: DateValue;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const exportJobRef = useRef<ExportJob | null>(null);

  const fetchAuditLogs = useCallback(
    async (
      cursorParams?: { after?: string; before?: string },
      explicitFilterParams?: Partial<AuditLogListParams>,
      forPage?: number
    ) => {
      const requestId = ++fetchRequestIdRef.current;
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

        if (requestId !== fetchRequestIdRef.current) {
          return;
        }

        setLogs(response.data);
        setPaging(response.paging ?? INITIAL_PAGING);

        if (forPage !== undefined && response.paging?.after) {
          pageCursorsRef.current[forPage] = response.paging.after;
          trimCursorCache(pageCursorsRef.current);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        if (requestId === fetchRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [pageSize]
  );

  useEffect(() => {
    pageCursorsRef.current = {};
    setCurrentPage(1);
    fetchAuditLogs({ after: undefined, before: undefined }, undefined, 1);
  }, [fetchAuditLogs]);

  const handlePageSizeChange = useCallback((size: number) => {
    pageCursorsRef.current = {};
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const handleFiltersChange = useCallback(
    (filters: AuditLogActiveFilter[], params: Partial<AuditLogListParams>) => {
      pageCursorsRef.current = {};
      setActiveFilters(filters);
      setFilterParams(params);
      filterParamsRef.current = params;
      setCurrentPage(1);
      fetchAuditLogs({ after: undefined, before: undefined }, params, 1);
    },
    [fetchAuditLogs]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      pageCursorsRef.current = {};
      setSearchTerm(query);
      searchTermRef.current = query;
      setCurrentPage(1);
      fetchAuditLogs({ after: undefined, before: undefined }, undefined, 1);
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
    pageCursorsRef.current = {};
    debouncedSearch.cancel();
    setActiveFilters([]);
    setFilterParams({});
    filterParamsRef.current = {};
    setSearchTerm('');
    searchTermRef.current = '';
    setCurrentPage(1);
    setSearchInputValue('');
    fetchAuditLogs({ after: undefined, before: undefined }, {}, 1);
  }, [debouncedSearch, fetchAuditLogs]);

  const handleRemoveFilter = useCallback(
    (category: string) => {
      pageCursorsRef.current = {};
      const remaining = activeFilters.filter((f) => f.category !== category);
      const params = buildParamsFromFilters(remaining);
      setActiveFilters(remaining);
      setFilterParams(params);
      filterParamsRef.current = params;
      setCurrentPage(1);
      fetchAuditLogs({ after: undefined, before: undefined }, params, 1);
    },
    [activeFilters, fetchAuditLogs]
  );

  const walkToPage = useCallback(
    async (
      startCursor: string | undefined,
      startPage: number,
      newPage: number
    ) => {
      const requestId = ++fetchRequestIdRef.current;
      setIsLoading(true);
      try {
        const { cursor, discoveredCursors } = await walkToPageCursor(
          startCursor,
          startPage,
          newPage,
          pageSize,
          searchTermRef.current,
          filterParamsRef.current
        );

        if (requestId !== fetchRequestIdRef.current) {
          return;
        }

        Object.assign(pageCursorsRef.current, discoveredCursors);
        trimCursorCache(pageCursorsRef.current);

        if (cursor) {
          const response: AuditLogListResponse = await getAuditLogs({
            limit: pageSize,
            after: cursor,
            q: searchTermRef.current || undefined,
            ...filterParamsRef.current,
          });

          if (requestId !== fetchRequestIdRef.current) {
            return;
          }

          setLogs(response.data);
          setPaging(response.paging ?? INITIAL_PAGING);
          setCurrentPage(newPage);

          if (response.paging?.after) {
            pageCursorsRef.current[newPage] = response.paging.after;
            trimCursorCache(pageCursorsRef.current);
          }
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        if (requestId === fetchRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [pageSize]
  );

  const handlePageChange = useCallback(
    async (newPage: number) => {
      if (newPage === currentPage) {
        return;
      }

      if (newPage === 1) {
        pageCursorsRef.current = {};
        setCurrentPage(1);
        fetchAuditLogs({ after: undefined, before: undefined }, undefined, 1);

        return;
      }

      // Direct jump: we already have the cursor for page newPage-1
      const cachedCursor = pageCursorsRef.current[newPage - 1];
      if (cachedCursor) {
        setCurrentPage(newPage);
        fetchAuditLogs({ after: cachedCursor }, undefined, newPage);

        return;
      }

      // Sequential walk: find the furthest page we know about, then walk forward.
      // Fall back to page 0 (undefined cursor = from the beginning) if the cache
      // was trimmed and no entry below newPage remains — avoids fetching the wrong
      // page when currentPage > newPage - 1 after eviction.
      const knownPages = Object.keys(pageCursorsRef.current)
        .map(Number)
        .sort((a, b) => a - b)
        .filter((p) => p < newPage);

      const startPage =
        knownPages.length > 0 ? knownPages[knownPages.length - 1] : 0;
      const startCursor =
        knownPages.length > 0 ? pageCursorsRef.current[startPage] : undefined;

      if (knownPages.length > 0 && !startCursor) {
        return;
      }

      walkToPage(startCursor, startPage, newPage);
    },
    [currentPage, fetchAuditLogs, walkToPage]
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

    return () => {
      onSetHeaderActions(undefined);
    };
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
      setExportDateRange(null);
      setExportJob(null);
      exportJobRef.current = null;
    }
  }, [isExporting]);

  const hasActiveSearch = Boolean(searchTerm.trim());
  const hasActiveFiltersOnly = activeFilters.length > 0;
  const hasActiveFilters = hasActiveFiltersOnly || hasActiveSearch;

  const exportProgress =
    exportJob?.total && exportJob.total > 0
      ? Math.round(((exportJob.progress ?? 0) / exportJob.total) * 100)
      : 0;

  const renderExportProgress = () =>
    exportJob?.status === 'IN_PROGRESS' ? (
      <Box direction="col" gap={2}>
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
      className="tw:flex-1 tw:min-h-0 tw:overflow-hidden tw:px-6"
      data-testid="audit-logs-page"
      direction="col">
      {/* Card wrapping filters + log list */}
      <Card className="tw:flex-1 tw:min-h-0 tw:flex tw:flex-col tw:overflow-hidden tw:mb-3">
        {/* Filters row inside card */}
        <Box
          className="tw:shrink-0 tw:p-4 tw:border-b tw:border-secondary"
          direction="col">
          <Box align="center" direction="row" gap={4}>
            <Box
              className="tw:shrink-0"
              data-testid="audit-log-search-container">
              <Input
                className="tw:max-w-86"
                icon={SearchLg as React.FC}
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
              align="center"
              className="tw:w-full tw:mt-2"
              data-testid="filter-selection-container"
              direction="row">
              <Box className="tw:flex-1" direction="row" gap={2} wrap="wrap">
                {activeFilters.map((filter) => (
                  <Badge
                    className="tw:outline-0 tw:gap-1"
                    color="brand"
                    key={filter.category}
                    size="lg"
                    type="color">
                    <Box
                      align="center"
                      data-testid={`filter-chip-${filter.category}`}
                      direction="row"
                      gap={1}>
                      <Typography className="tw:text-tertiary" weight="medium">
                        {filter.categoryLabel}:{' '}
                      </Typography>
                      <Box className="tw:max-w-80">
                        <Typography
                          ellipsis
                          as="p"
                          className="tw:text-brand-600"
                          title={filter.value.label}
                          weight="medium">
                          {filter.value.label}
                        </Typography>
                      </Box>
                    </Box>
                    <ButtonUtility
                      aria-label={t('label.remove-filter')}
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
        <Box className="tw:flex-1 tw:min-h-0 tw:overflow-auto tw:relative">
          <AuditLogList
            hasActiveFilters={hasActiveFiltersOnly}
            hasActiveSearch={hasActiveSearch}
            isLoading={isLoading}
            logs={logs}
            onClearFilters={handleClearFilters}
          />
        </Box>

        {/* Pagination inside card */}
        {(paging.total ?? 0) > pageSize && (
          <Box className="tw:shrink-0 tw:border-t tw:border-secondary">
            <PaginationCardWithControls
              page={currentPage}
              pageSize={pageSize}
              pageSizeOptions={[
                PAGE_SIZE_BASE,
                PAGE_SIZE_MEDIUM,
                PAGE_SIZE_LARGE,
              ]}
              total={Math.max(1, Math.ceil((paging.total ?? 0) / pageSize))}
              onPageChange={handlePageChange}
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
              <Box direction="col" gap={2}>
                <Typography as="p" className="tw:text-tertiary" size="text-md">
                  {`${t('label.date-range')} *`}
                </Typography>
                {/*
                 * @internationalized/date is externalized in ui-core-components but resolves to a
                 * different patch version (3.12.0) than the one openmetadata-ui locks to (3.12.1).
                 * TypeScript therefore treats CalendarDate / DateValue from each copy as distinct
                 * nominal types even though they are structurally identical. Cast until both
                 * packages resolve the same version.
                 */}
                <DateRangePicker
                  data-testid="export-date-range-picker"
                  isDisabled={isExporting}
                  maxValue={
                    today(getLocalTimeZone()) as unknown as Parameters<
                      typeof DateRangePicker
                    >[0]['maxValue']
                  }
                  value={
                    exportDateRange as unknown as Parameters<
                      typeof DateRangePicker
                    >[0]['value']
                  }
                  onChange={(range) =>
                    setExportDateRange(
                      range
                        ? {
                            start: range.start as unknown as DateValue,
                            end: range.end as unknown as DateValue,
                          }
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
