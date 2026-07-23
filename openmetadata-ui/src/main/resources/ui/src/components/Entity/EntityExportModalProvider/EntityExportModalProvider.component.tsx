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
import {
  Alert,
  Badge,
  Button,
  Dialog,
  InputBase,
  InputGroup,
  Modal,
  ModalOverlay,
  ProgressBarBase,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { Loading01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isString, lowerCase } from 'lodash';
import {
  createContext,
  FC,
  ReactNode,
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
import {
  BETA_EXPORT_TYPES,
  ExportTypes,
} from '../../../constants/Export.constants';
import {
  CsvAsyncJob,
  getCsvAsyncJob,
  getCsvAsyncJobResult,
} from '../../../rest/csvAPI';
import { getCurrentISODate } from '../../../utils/date-time/DateTimeUtils';
import { isBulkEditRoute } from '../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import { downloadFile } from '../../../utils/Export/ExportUtils';
import exportUtilClassBase from '../../../utils/ExportUtilClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import { CSV_JOBS_REFRESH_EVENT } from '../../common/EntityImport/CsvJobsTray/CsvJobsTray.constants';
import {
  CSVExportJob,
  CSVExportWebsocketResponse,
  EntityExportModalContextProps,
  ExportData,
} from './EntityExportModalProvider.interface';

const EntityExportModalContext = createContext<EntityExportModalContextProps>(
  {} as EntityExportModalContextProps
);

const AlertSpinnerIcon: FC<{ className?: string }> = () => (
  <Loading01 className="tw:size-5 tw:animate-spin" />
);

const CSV_EXPORT_INITIAL_POLL_INTERVAL_MS = 1_000;
const CSV_EXPORT_MAX_POLL_INTERVAL_MS = 10_000;
const CSV_EXPORT_STATUS_REQUEST_TIMEOUT_MS = 5_000;
const CSV_EXPORT_MAX_CONSECUTIVE_POLL_FAILURES = 6;

interface CSVExportPollingState {
  abortController: AbortController;
  jobId: string;
  rejectRequest?: (reason: Error) => void;
  requestAbortController?: AbortController;
  requestTimer?: ReturnType<typeof setTimeout>;
  resolveDelay?: () => void;
  timer?: ReturnType<typeof setTimeout>;
}

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
  const csvExportResultAbortControllerRef = useRef<AbortController>();

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

  const exportTypeItems = useMemo(
    () =>
      exportUtilClassBase
        .getExportTypeOptions()
        .filter((option) =>
          exportData?.exportTypes.includes(option.value as ExportTypes)
        )
        .map((option) => ({ id: option.value, label: option.label })),
    [exportData]
  );

  const handleCancel = () => {
    setExportData(null);
  };

  const showModal = useCallback((data: ExportData) => {
    setExportData(data);
  }, []);

  const triggerExportForBulkEdit = useCallback((data: ExportData) => {
    setExportData(data);
  }, []);

  const handleCSVExportSuccess = useCallback(
    (data: string, fileName?: string) => {
      stopCSVExportPolling();
      abortCSVExportResultRequest();
      if (isBulkEdit) {
        setCSVExportData(data);
      } else {
        const csvFileName =
          fileName ?? `${exportData?.name}_${getCurrentISODate()}`;
        downloadFile(data, `${csvFileName}.csv`);
      }
      setDownloading(false);
      handleCancel();
      setCSVExportJob(undefined);
      csvExportJobRef.current = undefined;
      pendingCSVExportResponsesRef.current.clear();
      exportOnErrorRef.current = undefined;
    },
    [abortCSVExportResultRequest, isBulkEdit, stopCSVExportPolling]
  );

  const handleClearCSVExportData = useCallback(() => {
    stopCSVExportPolling();
    abortCSVExportResultRequest();
    setCSVExportData(undefined);
    setCSVExportError(undefined);
    setCSVExportJob(undefined);
    setExportData(null);
    csvExportJobRef.current = undefined;
    pendingCSVExportResponsesRef.current.clear();
    exportOnErrorRef.current = undefined;
  }, [abortCSVExportResultRequest, stopCSVExportPolling]);

  const applyCSVExportJobUpdate = useCallback(
    (response: Partial<CSVExportWebsocketResponse>) => {
      const activeJob = csvExportJobRef.current;

      if (!activeJob?.jobId) {
        return;
      }

      const isTerminalFailure =
        response.status === 'FAILED' || response.status === 'CANCELLED';
      const updatedCSVExportJob: Partial<CSVExportJob> = {
        ...activeJob,
        ...response,
        error: isTerminalFailure
          ? t('message.unexpected-error')
          : response.error,
        jobId: activeJob.jobId,
        fileName: activeJob.fileName,
      };

      setCSVExportJob(updatedCSVExportJob);
      csvExportJobRef.current = updatedCSVExportJob;

      if (response.status === 'COMPLETED' && response.data !== undefined) {
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
              setCSVExportError(t('message.unexpected-error'));
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
          setCSVExportError(t('message.unexpected-error'));
        }
      }
    },
    [
      abortCSVExportResultRequest,
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

      applyCSVExportJobUpdate(response);
    },
    [applyCSVExportJobUpdate]
  );

  const startCSVExportPolling = useCallback(
    (jobId: string) => {
      stopCSVExportPolling();

      const pollingState: CSVExportPollingState = {
        abortController: new AbortController(),
        jobId,
      };
      csvExportPollingRef.current = pollingState;

      const waitForNextPoll = (intervalMs: number) =>
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

      const getPolledJob = async () => {
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

      void (async () => {
        let consecutiveFailures = 0;

        for (let attempt = 0; ; attempt++) {
          if (attempt > 0) {
            const intervalMs = Math.min(
              CSV_EXPORT_INITIAL_POLL_INTERVAL_MS * 2 ** (attempt - 1),
              CSV_EXPORT_MAX_POLL_INTERVAL_MS
            );
            await waitForNextPoll(intervalMs);
          }

          if (
            pollingState.abortController.signal.aborted ||
            csvExportPollingRef.current !== pollingState ||
            csvExportJobRef.current?.jobId !== jobId
          ) {
            return;
          }

          try {
            const job = await getPolledJob();

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
              consecutiveFailures >= CSV_EXPORT_MAX_CONSECUTIVE_POLL_FAILURES
            ) {
              break;
            }
          }
        }

        if (
          csvExportPollingRef.current === pollingState &&
          csvExportJobRef.current?.jobId === jobId
        ) {
          applyCSVExportJobUpdate({
            error: null,
            jobId,
            status: 'FAILED',
          });
        }
      })();
    },
    [applyCSVExportJobUpdate, stopCSVExportPolling]
  );

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
    setCSVExportError(undefined);
    exportOnErrorRef.current = exportData.onError;
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
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );

        await exportUtilClassBase.exportMethodBasedOnType({
          exportType,
          exportData: {
            ...exportData,
            name: fileName,
          },
        });

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
      const data = await exportData.onExport(exportData.name, {
        recursive: !isBulkEdit,
      });

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
        startCSVExportPolling(data.jobId);

        if (pendingResponse) {
          applyCSVExportJobUpdate(pendingResponse);
        }
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
      setDownloading(false);
      if (isBulkEdit) {
        setCSVExportError(t('message.unexpected-error'));
      }
      exportData.onError?.();
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
    setExportData(null);
    try {
      const result = await data.onExport(data.name, { recursive: true });
      if (isString(result)) {
        downloadFile(result, `${data.name}_${getCurrentISODate()}.csv`);
      } else {
        window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
      }
    } catch (error) {
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

  useEffect(
    () => () => {
      stopCSVExportPolling();
      abortCSVExportResultRequest();
    },
    [abortCSVExportResultRequest, stopCSVExportPolling]
  );

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

  const isExportInProgress = csvExportJob?.status === 'IN_PROGRESS';

  return (
    <EntityExportModalContext.Provider value={providerValue}>
      <>
        {children}
        {exportData && !isBulkEdit && !isCsvOnly && (
          <ModalOverlay isOpen>
            <Modal>
              <Dialog
                data-testid="export-entity-modal"
                width={480}
                onClose={handleCancel}>
                <Dialog.Header>
                  <Typography
                    as="h3"
                    className="tw:text-primary"
                    size="text-lg"
                    weight="semibold">
                    {exportData.title ?? t('label.export')}
                  </Typography>
                </Dialog.Header>
                <Dialog.Content>
                  <Select
                    data-testid="export-type-select"
                    isDisabled={exportData.exportTypes.length === 1}
                    items={exportTypeItems}
                    label={`${t('label.export-type')}:`}
                    selectedKey={selectedExportType}
                    onSelectionChange={(key) =>
                      key && setSelectedExportType(key as ExportTypes)
                    }>
                    {(item) => (
                      <Select.Item id={item.id} textValue={item.label}>
                        <div className="tw:flex tw:items-center tw:gap-2">
                          {item.label}
                          {BETA_EXPORT_TYPES.includes(
                            item.id as ExportTypes
                          ) && (
                            <Badge color="gray" size="sm">
                              {t('label.beta')}
                            </Badge>
                          )}
                        </div>
                      </Select.Item>
                    )}
                  </Select>

                  <InputGroup
                    label={`${t('label.entity-name', {
                      entity: t('label.file'),
                    })}:`}
                    trailingAddon={
                      <InputGroup.Prefix position="trailing">
                        {`.${lowerCase(selectedExportType)}`}
                      </InputGroup.Prefix>
                    }
                    value={fileName}
                    onChange={setFileName}>
                    <InputBase inputDataTestId="file-name-input" />
                  </InputGroup>

                  {csvExportJob?.jobId && (
                    <>
                      {isExportInProgress &&
                        csvExportJob.progress !== undefined &&
                        csvExportJob.total !== undefined && (
                          <div className="tw:flex tw:flex-col tw:gap-2">
                            <ProgressBarBase
                              max={csvExportJob.total}
                              value={csvExportJob.progress}
                            />
                            <Typography
                              as="span"
                              className="tw:text-tertiary"
                              size="text-xs">
                              {csvExportJob.message}
                            </Typography>
                          </div>
                        )}
                      {!isExportInProgress && (
                        <Alert
                          icon={
                            !csvExportJob.error && downloading
                              ? AlertSpinnerIcon
                              : undefined
                          }
                          title={
                            csvExportJob.error ?? csvExportJob.message ?? ''
                          }
                          variant={
                            csvExportJob.error
                              ? 'error'
                              : downloading
                              ? 'brand'
                              : 'success'
                          }
                        />
                      )}
                    </>
                  )}
                </Dialog.Content>
                <Dialog.Footer>
                  <Button color="secondary" size="lg" onClick={handleCancel}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    color="primary"
                    data-testid="submit-button"
                    isDisabled={downloading}
                    isLoading={downloading}
                    size="lg"
                    onClick={() =>
                      handleExport({ fileName, exportType: selectedExportType })
                    }>
                    {t('label.export')}
                  </Button>
                </Dialog.Footer>
              </Dialog>
            </Modal>
          </ModalOverlay>
        )}
      </>
    </EntityExportModalContext.Provider>
  );
};

export const useEntityExportModalProvider = () =>
  useContext<EntityExportModalContextProps>(EntityExportModalContext);
