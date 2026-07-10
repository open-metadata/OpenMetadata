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
import { getCsvAsyncJobResult } from '../../../rest/csvAPI';
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

  // Holds the in-flight export's onError so the async (websocket) failure
  // branches can notify the caller without a stale closure over exportData.
  const exportOnErrorRef = useRef<(() => void) | undefined>();

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

      // assigning the job data to ref here, as exportData.onExport may take time to return the data
      // and websocket connection may be respond before that, so we need to keep the job data in ref
      // to handle the download
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
      } else {
        const jobData = {
          jobId: data.jobId,
          fileName: fileName,
          message: data.message,
        };

        setCSVExportJob(jobData);
        csvExportJobRef.current = jobData;
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
    }
  };

  const handleCSVExportSuccess = useCallback(
    (data: string, fileName?: string) => {
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
      exportOnErrorRef.current = undefined;
    },
    [isBulkEdit]
  );

  const handleClearCSVExportData = useCallback(() => {
    setCSVExportData(undefined);
    setCSVExportError(undefined);
    setCSVExportJob(undefined);
    setExportData(null);
    csvExportJobRef.current = undefined;
    exportOnErrorRef.current = undefined;
  }, []);

  const handleCSVExportJobUpdate = useCallback(
    (response: Partial<CSVExportWebsocketResponse>) => {
      // If multiple tab is open, then we need to check if the tab has active job or not before initiating the download
      if (!csvExportJobRef.current) {
        return;
      }
      const updatedCSVExportJob: Partial<CSVExportJob> = {
        ...response,
        ...csvExportJobRef.current,
      };

      setCSVExportJob(updatedCSVExportJob);

      csvExportJobRef.current = updatedCSVExportJob;

      if (response.status === 'COMPLETED' && response.data) {
        handleCSVExportSuccess(
          response.data ?? '',
          csvExportJobRef.current?.fileName
        );
      } else if (response.status === 'COMPLETED') {
        // Completion events no longer carry the CSV (it can be arbitrarily
        // large) — download it from the job result endpoint instead.
        const jobId = response.jobId ?? csvExportJobRef.current?.jobId;
        if (jobId) {
          getCsvAsyncJobResult(jobId)
            .then((csvData) =>
              handleCSVExportSuccess(csvData, csvExportJobRef.current?.fileName)
            )
            .catch((error) => {
              showErrorToast(error as AxiosError);
              setDownloading(false);
              exportOnErrorRef.current?.();
              exportOnErrorRef.current = undefined;
              csvExportJobRef.current = undefined;
              if (isBulkEdit) {
                setCSVExportError(t('message.unexpected-error'));
              }
            });
        } else {
          setDownloading(false);
        }
      } else if (response.status === 'IN_PROGRESS') {
        // Keep downloading state true during progress
        setDownloading(true);
      } else {
        // FAILED / CANCELLED — notify the caller (mirrors the synchronous
        // catch), drop the job ref so a late message can't re-merge, and show a
        // generic error to the bulk-edit grid so it stops waiting on an export
        // that will never arrive. The raw backend error is not surfaced — it can
        // leak internal details (stack traces, SQL, entity internals).
        setDownloading(false);
        exportOnErrorRef.current?.();
        exportOnErrorRef.current = undefined;
        csvExportJobRef.current = undefined;
        if (isBulkEdit) {
          setCSVExportError(t('message.unexpected-error'));
        }
      }
    },
    [isBulkEdit, handleCSVExportSuccess, t]
  );

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
