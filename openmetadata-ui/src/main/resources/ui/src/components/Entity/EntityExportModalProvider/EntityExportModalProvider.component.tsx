/*
 *  Copyright 2023 Collate.
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
import { AxiosError } from 'axios';
import { isString } from 'lodash';
import {
  createContext,
  lazy,
  ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ExportTypes } from '../../../constants/Export.constants';
import {
  CsvAsyncJob,
  getCsvAsyncJob,
  getCsvAsyncJobResult,
  isPollableCsvAsyncJobId,
} from '../../../rest/csvAPI';
import { getCurrentISODate } from '../../../utils/date-time/DateTimeUtils';
import { isBulkEditRoute } from '../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import { downloadFile } from '../../../utils/Export/ExportUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  CSV_JOBS_REFRESH_EVENT,
  markCsvJobOwned,
} from '../../common/EntityImport/CsvJobsTray/CsvJobsTray.constants';
import {
  CSVExportJob,
  CSVExportWebsocketResponse,
  EntityExportModalContextProps,
  ExportData,
} from './EntityExportModalProvider.interface';

const EntityExportModalContext = createContext<EntityExportModalContextProps>(
  {} as EntityExportModalContextProps
);

const EntityExportModal = lazy(() =>
  import('./EntityExportModal.component').then(({ EntityExportModal }) => ({
    default: EntityExportModal,
  }))
);

const CSV_EXPORT_INITIAL_POLL_INTERVAL_MS = 1_000;
const CSV_EXPORT_MAX_POLL_INTERVAL_MS = 10_000;
const CSV_EXPORT_POLL_JITTER_RATIO = 0.2;
const CSV_EXPORT_WEBSOCKET_SILENCE_MS = 10_000;
const CSV_EXPORT_STATUS_REQUEST_TIMEOUT_MS = 5_000;
const CSV_EXPORT_MAX_CONSECUTIVE_POLL_FAILURES = 6;

const getJitteredPollInterval = (intervalMs: number) =>
  Math.round(
    intervalMs *
      (1 -
        CSV_EXPORT_POLL_JITTER_RATIO +
        Math.random() * 2 * CSV_EXPORT_POLL_JITTER_RATIO)
  );

interface CSVExportPollingState {
  abortController: AbortController;
  jobId: string;
  rejectRequest?: (reason: Error) => void;
  requestAbortController?: AbortController;
  requestTimer?: ReturnType<typeof setTimeout>;
  resolveDelay?: () => void;
  timer?: ReturnType<typeof setTimeout>;
}

const waitForNextPoll = (
  pollingState: CSVExportPollingState,
  intervalMs: number
) =>
  new Promise<void>((resolve) => {
    if (pollingState.abortController.signal.aborted) {
      resolve();

      return;
    }

    pollingState.resolveDelay = resolve;
    pollingState.timer = setTimeout(() => {
      pollingState.resolveDelay = undefined;
      pollingState.timer = undefined;
      resolve();
    }, intervalMs);
  });

const getPolledJob = async (
  pollingState: CSVExportPollingState,
  jobId: string
) => {
  const requestAbortController = new AbortController();
  pollingState.requestAbortController = requestAbortController;

  const requestTimeout = new Promise<never>((_, reject) => {
    pollingState.rejectRequest = reject;
    pollingState.requestTimer = setTimeout(() => {
      requestAbortController.abort();
      reject(new Error('CSV export status request timed out'));
    }, CSV_EXPORT_STATUS_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      getCsvAsyncJob(jobId, requestAbortController.signal),
      requestTimeout,
    ]);
  } finally {
    if (pollingState.requestTimer) {
      clearTimeout(pollingState.requestTimer);
    }
    pollingState.rejectRequest = undefined;
    pollingState.requestAbortController = undefined;
    pollingState.requestTimer = undefined;
  }
};

const waitForDoubleAnimationFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

export const EntityExportModalProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  const location = useLocation();

  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [selectedExportType, setSelectedExportType] = useState<ExportTypes>(
    ExportTypes.CSV
  );

  const csvExportJobRef = useRef<Partial<CSVExportJob>>();
  const pendingCSVExportResponsesRef = useRef<
    Map<string, Partial<CSVExportWebsocketResponse>>
  >(new Map());

  // Holds the in-flight export's onError so the async (websocket) failure
  // branches can notify the caller without a stale closure over exportData.
  const exportOnErrorRef = useRef<(() => void) | undefined>();
  const csvExportPollingRef = useRef<CSVExportPollingState>();
  const csvExportPollingStarterRef = useRef<(jobId: string) => void>();
  const csvExportPollingWatchdogRef = useRef<ReturnType<typeof setTimeout>>();
  const csvExportResultAbortControllerRef = useRef<AbortController>();
  const exportGenerationRef = useRef(0);
  const isMountedRef = useRef(true);

  const [csvExportJob, setCSVExportJob] = useState<Partial<CSVExportJob>>();

  const [csvExportData, setCSVExportData] = useState<string>();

  const [csvExportError, setCSVExportError] = useState<string>();

  const isBulkEdit = useMemo(
    () => isBulkEditRoute(location.pathname) || exportData?.hideExportModal,
    [location, exportData?.hideExportModal]
  );

  // A plain CSV export (no image/PDF type choice) skips the modal and runs
  // straight into the global CsvJobsTray, matching the metrics export UX.
  const isCsvOnly = useMemo(
    () =>
      !isBulkEdit &&
      exportData?.exportTypes?.length === 1 &&
      exportData.exportTypes[0] === ExportTypes.CSV,
    [exportData, isBulkEdit]
  );

  const stopCSVExportPolling = useCallback(() => {
    const pollingState = csvExportPollingRef.current;

    if (!pollingState) {
      return;
    }

    if (pollingState.timer) {
      clearTimeout(pollingState.timer);
    }
    if (pollingState.requestTimer) {
      clearTimeout(pollingState.requestTimer);
    }
    pollingState.abortController.abort();
    pollingState.requestAbortController?.abort();
    pollingState.rejectRequest?.(new Error('CSV export polling stopped'));
    pollingState.resolveDelay?.();
    csvExportPollingRef.current = undefined;
  }, []);

  const abortCSVExportResultRequest = useCallback(() => {
    csvExportResultAbortControllerRef.current?.abort();
    csvExportResultAbortControllerRef.current = undefined;
  }, []);

  const clearCSVExportPollingWatchdog = useCallback(() => {
    if (csvExportPollingWatchdogRef.current) {
      clearTimeout(csvExportPollingWatchdogRef.current);
      csvExportPollingWatchdogRef.current = undefined;
    }
  }, []);

  const scheduleCSVExportPolling = useCallback(
    (jobId: string) => {
      clearCSVExportPollingWatchdog();

      if (!isPollableCsvAsyncJobId(jobId)) {
        return;
      }

      csvExportPollingWatchdogRef.current = setTimeout(() => {
        csvExportPollingWatchdogRef.current = undefined;
        if (csvExportJobRef.current?.jobId === jobId) {
          csvExportPollingStarterRef.current?.(jobId);
        }
      }, CSV_EXPORT_WEBSOCKET_SILENCE_MS);
    },
    [clearCSVExportPollingWatchdog]
  );

  const handleCancel = useCallback(() => {
    exportGenerationRef.current++;
    clearCSVExportPollingWatchdog();
    stopCSVExportPolling();
    abortCSVExportResultRequest();
    setDownloading(false);
    setCSVExportJob(undefined);
    setExportData(null);
    csvExportJobRef.current = undefined;
    pendingCSVExportResponsesRef.current.clear();
    exportOnErrorRef.current = undefined;
  }, [
    abortCSVExportResultRequest,
    clearCSVExportPollingWatchdog,
    stopCSVExportPolling,
  ]);

  const showModal = useCallback((data: ExportData) => {
    setExportData(data);
  }, []);

  const triggerExportForBulkEdit = useCallback((data: ExportData) => {
    setExportData(data);
  }, []);

  const handleCSVExportSuccess = useCallback(
    (data: string, fileName?: string) => {
      if (isBulkEdit) {
        setCSVExportData(data);
      } else {
        const csvFileName =
          fileName ?? `${exportData?.name}_${getCurrentISODate()}`;
        downloadFile(data, `${csvFileName}.csv`);
      }
      handleCancel();
    },
    [exportData?.name, handleCancel, isBulkEdit]
  );

  const handleClearCSVExportData = useCallback(() => {
    handleCancel();
    setCSVExportData(undefined);
    setCSVExportError(undefined);
  }, [handleCancel]);

  const applyCSVExportJobUpdate = useCallback(
    (response: Partial<CSVExportWebsocketResponse>) => {
      const activeJob = csvExportJobRef.current;

      if (!activeJob?.jobId) {
        return;
      }

      const isTerminalFailure =
        response.status === 'FAILED' || response.status === 'CANCELLED';
      if (isTerminalFailure || response.status === 'COMPLETED') {
        clearCSVExportPollingWatchdog();
      }
      const updatedCSVExportJob: Partial<CSVExportJob> = {
        ...activeJob,
        ...response,
        error: isTerminalFailure
          ? t('server.unexpected-error')
          : response.error,
        jobId: activeJob.jobId,
        fileName: activeJob.fileName,
        statusUnavailable: false,
      };

      setCSVExportJob(updatedCSVExportJob);
      csvExportJobRef.current = updatedCSVExportJob;

      if (response.status === 'COMPLETED' && isString(response.data)) {
        handleCSVExportSuccess(response.data, activeJob.fileName);
      } else if (response.status === 'COMPLETED') {
        stopCSVExportPolling();
        abortCSVExportResultRequest();
        // Completion events no longer carry the CSV (it can be arbitrarily
        // large) — download it from the job result endpoint instead.
        const { jobId, fileName } = activeJob;
        const abortController = new AbortController();
        csvExportResultAbortControllerRef.current = abortController;
        getCsvAsyncJobResult(jobId, abortController.signal)
          .then((csvData) => {
            if (
              !abortController.signal.aborted &&
              csvExportJobRef.current?.jobId === jobId
            ) {
              handleCSVExportSuccess(csvData, fileName);
            }
          })
          .catch((error) => {
            if (abortController.signal.aborted) {
              return;
            }
            if (csvExportJobRef.current?.jobId !== jobId) {
              return;
            }
            showErrorToast(error as AxiosError);
            setDownloading(false);
            exportOnErrorRef.current?.();
            exportOnErrorRef.current = undefined;
            csvExportJobRef.current = undefined;
            pendingCSVExportResponsesRef.current.clear();
            if (isBulkEdit) {
              setCSVExportError(t('server.unexpected-error'));
            }
          })
          .finally(() => {
            if (csvExportResultAbortControllerRef.current === abortController) {
              csvExportResultAbortControllerRef.current = undefined;
            }
          });
      } else if (response.status === 'IN_PROGRESS') {
        // Keep downloading state true during progress
        setDownloading(true);
      } else {
        stopCSVExportPolling();
        abortCSVExportResultRequest();
        // FAILED / CANCELLED — notify the caller (mirrors the synchronous
        // catch), drop the job ref so a late message can't re-merge, and show a
        // generic error to the bulk-edit grid so it stops waiting on an export
        // that will never arrive. The raw backend error is not surfaced — it can
        // leak internal details (stack traces, SQL, entity internals).
        setDownloading(false);
        exportOnErrorRef.current?.();
        exportOnErrorRef.current = undefined;
        csvExportJobRef.current = undefined;
        pendingCSVExportResponsesRef.current.clear();
        if (isBulkEdit) {
          setCSVExportError(t('server.unexpected-error'));
        }
      }
    },
    [
      abortCSVExportResultRequest,
      clearCSVExportPollingWatchdog,
      isBulkEdit,
      handleCSVExportSuccess,
      stopCSVExportPolling,
      t,
    ]
  );

  const handleCSVExportJobUpdate = useCallback(
    (response: Partial<CSVExportWebsocketResponse>) => {
      const activeJob = csvExportJobRef.current;
      const responseJobId = response.jobId;

      if (!activeJob || !responseJobId) {
        return;
      }

      if (!activeJob.jobId) {
        const pendingResponse =
          pendingCSVExportResponsesRef.current.get(responseJobId);
        pendingCSVExportResponsesRef.current.set(responseJobId, {
          ...pendingResponse,
          ...response,
        });

        return;
      }

      if (responseJobId !== activeJob.jobId) {
        return;
      }

      clearCSVExportPollingWatchdog();
      if (response.status === 'IN_PROGRESS') {
        stopCSVExportPolling();
      }
      applyCSVExportJobUpdate(response);
      if (response.status === 'IN_PROGRESS') {
        scheduleCSVExportPolling(responseJobId);
      }
    },
    [
      applyCSVExportJobUpdate,
      clearCSVExportPollingWatchdog,
      scheduleCSVExportPolling,
      stopCSVExportPolling,
    ]
  );

  const markCSVExportStatusUnavailable = useCallback((jobId: string) => {
    const activeJob = csvExportJobRef.current;

    if (activeJob?.jobId !== jobId) {
      return;
    }

    const updatedCSVExportJob = {
      ...activeJob,
      statusUnavailable: true,
    };
    csvExportJobRef.current = updatedCSVExportJob;
    setCSVExportJob(updatedCSVExportJob);
  }, []);

  const startCSVExportPolling = useCallback(
    (jobId: string) => {
      stopCSVExportPolling();

      const pollingState: CSVExportPollingState = {
        abortController: new AbortController(),
        jobId,
      };
      csvExportPollingRef.current = pollingState;

      const applyPolledJob = (job: CsvAsyncJob) => {
        const status =
          job.status === 'COMPLETED' ||
          job.status === 'FAILED' ||
          job.status === 'CANCELLED'
            ? job.status
            : 'IN_PROGRESS';

        applyCSVExportJobUpdate({
          error: job.error ?? null,
          jobId: job.jobId,
          message: job.message,
          progress: job.progress,
          status,
          total: job.total,
        });

        return status !== 'IN_PROGRESS';
      };

      void (async () => {
        let consecutiveFailures = 0;

        for (let attempt = 0; ; attempt++) {
          if (attempt > 0) {
            const intervalMs = Math.min(
              CSV_EXPORT_INITIAL_POLL_INTERVAL_MS * 2 ** (attempt - 1),
              CSV_EXPORT_MAX_POLL_INTERVAL_MS
            );
            await waitForNextPoll(
              pollingState,
              getJitteredPollInterval(intervalMs)
            );
          }

          if (
            pollingState.abortController.signal.aborted ||
            csvExportPollingRef.current !== pollingState ||
            csvExportJobRef.current?.jobId !== jobId
          ) {
            return;
          }

          try {
            const job = await getPolledJob(pollingState, jobId);

            if (
              pollingState.abortController.signal.aborted ||
              csvExportPollingRef.current !== pollingState ||
              csvExportJobRef.current?.jobId !== jobId
            ) {
              return;
            }

            consecutiveFailures = 0;
            if (applyPolledJob(job)) {
              return;
            }
          } catch {
            if (pollingState.abortController.signal.aborted) {
              return;
            }

            consecutiveFailures++;
            if (
              consecutiveFailures === CSV_EXPORT_MAX_CONSECUTIVE_POLL_FAILURES
            ) {
              markCSVExportStatusUnavailable(jobId);
            }
          }
        }
      })();
    },
    [
      applyCSVExportJobUpdate,
      markCSVExportStatusUnavailable,
      stopCSVExportPolling,
    ]
  );

  csvExportPollingStarterRef.current = startCSVExportPolling;

  const handleExport = async ({
    fileName,
    exportType,
  }: {
    fileName: string;
    exportType: ExportTypes;
  }) => {
    if (exportData === null) {
      return;
    }
    const activeExportData = exportData;
    const exportGeneration = ++exportGenerationRef.current;
    setCSVExportError(undefined);
    exportOnErrorRef.current = activeExportData.onError;
    try {
      if (exportType !== ExportTypes.CSV) {
        // Flush the loading state, then wait for the browser to actually paint
        // it before the heavy toPng work starts — html-to-image does synchronous
        // DOM cloning that blocks the event loop, so without a paint the
        // disabled/loading button would only render once the export is already
        // done. Only needed for non-CSV (image) paths; CSV uses the async
        // websocket flow.
        flushSync(() => {
          setDownloading(true);
        });
        await waitForDoubleAnimationFrame();
        if (
          !isMountedRef.current ||
          exportGenerationRef.current !== exportGeneration
        ) {
          return;
        }

        const { default: exportUtilClassBase } = await import(
          '../../../utils/ExportUtilClassBase'
        );
        if (
          !isMountedRef.current ||
          exportGenerationRef.current !== exportGeneration
        ) {
          return;
        }
        await exportUtilClassBase.exportMethodBasedOnType({
          exportType,
          exportData: {
            ...activeExportData,
            name: fileName,
          },
        });
        if (
          !isMountedRef.current ||
          exportGenerationRef.current !== exportGeneration
        ) {
          return;
        }

        handleCancel();
        setDownloading(false);

        return;
      }

      setDownloading(true);
      stopCSVExportPolling();
      abortCSVExportResultRequest();
      pendingCSVExportResponsesRef.current.clear();
      csvExportJobRef.current = {
        fileName: fileName,
      };
      const data = await activeExportData.onExport(activeExportData.name, {
        recursive: !isBulkEdit,
      });
      if (
        !isMountedRef.current ||
        exportGenerationRef.current !== exportGeneration
      ) {
        return;
      }

      if (isString(data)) {
        // Bulk Edit loads its grid via a synchronous export that returns the CSV
        // directly — feed it to the wizard instead of downloading a file.
        if (isBulkEdit) {
          setCSVExportData(data);
        } else {
          downloadFile(data, `${fileName}.csv`);
        }
        handleCancel();
        setDownloading(false);
        csvExportJobRef.current = undefined;
        pendingCSVExportResponsesRef.current.clear();
        exportOnErrorRef.current = undefined;
      } else {
        const jobData = {
          jobId: data.jobId,
          fileName: fileName,
          message: data.message,
        };
        const pendingResponse = pendingCSVExportResponsesRef.current.get(
          data.jobId
        );

        setCSVExportJob(jobData);
        csvExportJobRef.current = jobData;
        pendingCSVExportResponsesRef.current.clear();
        scheduleCSVExportPolling(data.jobId);

        if (pendingResponse) {
          applyCSVExportJobUpdate(pendingResponse);
        }
      }
    } catch (error) {
      if (
        !isMountedRef.current ||
        exportGenerationRef.current !== exportGeneration
      ) {
        return;
      }
      showErrorToast(error as AxiosError);
      setDownloading(false);
      if (isBulkEdit) {
        setCSVExportError(t('server.unexpected-error'));
      }
      activeExportData.onError?.();
      exportOnErrorRef.current = undefined;
      csvExportJobRef.current = undefined;
      pendingCSVExportResponsesRef.current.clear();
      stopCSVExportPolling();
      abortCSVExportResultRequest();
    }
  };

  const runTrayExport = useCallback(async (data: ExportData) => {
    // CSV-only exports skip the modal and surface in the global CsvJobsTray
    // (the metrics export UX). Fire the async export, then nudge the tray to
    // pick up the new job.
    const exportGeneration = ++exportGenerationRef.current;
    setExportData(null);
    try {
      const result = await data.onExport(data.name, { recursive: true });
      if (
        !isMountedRef.current ||
        exportGenerationRef.current !== exportGeneration
      ) {
        return;
      }
      if (isString(result)) {
        downloadFile(result, `${data.name}_${getCurrentISODate()}.csv`);
      } else {
        // Claim the just-started job so the tray always surfaces it, even if it
        // finishes before the tray's first fetch.
        markCsvJobOwned((result as { jobId?: string })?.jobId);
        window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
      }
    } catch (error) {
      if (
        !isMountedRef.current ||
        exportGenerationRef.current !== exportGeneration
      ) {
        return;
      }
      showErrorToast(error as AxiosError);
      data.onError?.();
    }
  }, []);

  useEffect(() => {
    if (exportData) {
      if (isBulkEdit) {
        handleExport({
          fileName: 'bulk-edit',
          exportType: ExportTypes.CSV,
        });
      } else if (isCsvOnly) {
        runTrayExport(exportData);
      } else {
        setFileName(`${exportData.name}_${getCurrentISODate()}`);
        setSelectedExportType(exportData.exportTypes[0]);
      }
    }
  }, [isBulkEdit, isCsvOnly, exportData, runTrayExport]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      exportGenerationRef.current++;
      clearCSVExportPollingWatchdog();
      stopCSVExportPolling();
      abortCSVExportResultRequest();
      csvExportJobRef.current = undefined;
      pendingCSVExportResponsesRef.current.clear();
      exportOnErrorRef.current = undefined;
    };
  }, [
    abortCSVExportResultRequest,
    clearCSVExportPollingWatchdog,
    stopCSVExportPolling,
  ]);

  const providerValue = useMemo(
    () => ({
      csvExportData,
      csvExportError,
      clearCSVExportData: handleClearCSVExportData,
      showModal,
      triggerExportForBulkEdit,
      onUpdateCSVExportJob: handleCSVExportJobUpdate,
    }),
    [
      csvExportData,
      csvExportError,
      handleClearCSVExportData,
      showModal,
      triggerExportForBulkEdit,
      handleCSVExportJobUpdate,
    ]
  );

  return (
    <EntityExportModalContext.Provider value={providerValue}>
      <>
        {children}
        {exportData && !isBulkEdit && !isCsvOnly && (
          <Suspense fallback={null}>
            <EntityExportModal
              csvExportJob={csvExportJob}
              downloading={downloading}
              exportData={exportData}
              fileName={fileName}
              selectedExportType={selectedExportType}
              onCancel={handleCancel}
              onExport={handleExport}
              onFileNameChange={setFileName}
              onSelectedExportTypeChange={setSelectedExportType}
            />
          </Suspense>
        )}
      </>
    </EntityExportModalContext.Provider>
  );
};

export const useEntityExportModalProvider = () =>
  useContext<EntityExportModalContextProps>(EntityExportModalContext);
