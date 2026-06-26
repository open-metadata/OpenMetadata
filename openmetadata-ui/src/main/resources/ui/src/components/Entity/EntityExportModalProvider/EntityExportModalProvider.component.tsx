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
import { Badge, Form, Input, Modal, Progress, Select, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isString, lowerCase } from 'lodash';
import {
  createContext,
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
import Banner from '../../common/Banner/Banner';
import { CSV_JOBS_REFRESH_EVENT } from '../../common/EntityImport/CsvJobsTray/CsvJobsTray.component';
import {
  CSVExportJob,
  CSVExportWebsocketResponse,
  EntityExportModalContextProps,
  ExportData,
} from './EntityExportModalProvider.interface';

const EntityExportModalContext = createContext<EntityExportModalContextProps>(
  {} as EntityExportModalContextProps
);

export const EntityExportModalProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [form] = Form.useForm();
  const { t } = useTranslation();
  const location = useLocation();

  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);

  const csvExportJobRef = useRef<Partial<CSVExportJob>>();

  const [csvExportJob, setCSVExportJob] = useState<Partial<CSVExportJob>>();

  const [csvExportData, setCSVExportData] = useState<string>();

  const selectedExportType =
    Form.useWatch<ExportTypes>(['exportType'], form) ?? ExportTypes.CSV;

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

  const exportTypesOptions = useMemo(
    () =>
      exportUtilClassBase
        .getExportTypeOptions()
        .filter((option) =>
          exportData?.exportTypes.includes(option.value as ExportTypes)
        ),
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
    try {
      if (exportType !== ExportTypes.CSV) {
        // Force React to flush the loading state to the DOM before the heavy
        // toPng work starts — html-to-image does synchronous DOM cloning that
        // blocks the event loop and would otherwise delay the spinner. Only
        // needed for non-CSV (image) paths; CSV uses async websocket flow.
        flushSync(() => {
          setDownloading(true);
        });

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
      exportData.onError?.();
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
    },
    [isBulkEdit]
  );

  const handleClearCSVExportData = useCallback(() => {
    setCSVExportData(undefined);
    setCSVExportJob(undefined);
    setExportData(null);
    csvExportJobRef.current = undefined;
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
            });
        } else {
          setDownloading(false);
        }
      } else if (response.status === 'IN_PROGRESS') {
        // Keep downloading state true during progress
        setDownloading(true);
      } else {
        setDownloading(false);
      }
    },
    [isBulkEdit, handleCSVExportSuccess]
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
        form.setFieldsValue({
          fileName: `${exportData.name}_${getCurrentISODate()}`,
          exportType: exportData.exportTypes[0],
        });
      }
    }
  }, [isBulkEdit, isCsvOnly, exportData, runTrayExport]);

  const providerValue = useMemo(
    () => ({
      csvExportData,
      clearCSVExportData: handleClearCSVExportData,
      showModal,
      triggerExportForBulkEdit,
      onUpdateCSVExportJob: handleCSVExportJobUpdate,
    }),
    [
      csvExportData,
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
          <Modal
            centered
            open
            cancelText={t('label.cancel')}
            closable={false}
            data-testid="export-entity-modal"
            maskClosable={false}
            okButtonProps={{
              form: 'export-form',
              htmlType: 'submit',
              id: 'submit-button',
              disabled: downloading,
              loading: selectedExportType !== ExportTypes.CSV && downloading,
            }}
            okText={t('label.export')}
            title={exportData.title ?? t('label.export')}
            onCancel={handleCancel}>
            <Form
              form={form}
              id="export-form"
              layout="vertical"
              onFinish={handleExport}>
              <Form.Item label={`${t('label.export-type')}:`} name="exportType">
                <Select
                  data-testid="export-type-select"
                  disabled={exportData.exportTypes.length === 1}>
                  {exportTypesOptions.map((type) => (
                    <Select.Option
                      key={type.value}
                      title={type.value}
                      value={type.value}>
                      <div className="d-flex items-center">
                        {type.label}
                        {BETA_EXPORT_TYPES.includes(type.value) && (
                          <Badge
                            className="m-l-xs service-beta-tag"
                            count={t('label.beta')}
                            size="small"
                          />
                        )}
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                className={classNames({ 'mb-0': !csvExportJob?.jobId })}
                label={`${t('label.entity-name', {
                  entity: t('label.file'),
                })}:`}
                name="fileName">
                <Input
                  addonAfter={`.${lowerCase(selectedExportType)}`}
                  data-testid="file-name-input"
                />
              </Form.Item>
            </Form>

            {csvExportJob?.jobId && (
              <>
                {csvExportJob.status === 'IN_PROGRESS' &&
                  csvExportJob.progress !== undefined &&
                  csvExportJob.total !== undefined && (
                    <div className="m-b-md">
                      <Progress
                        percent={Math.round(
                          (csvExportJob.progress / csvExportJob.total) * 100
                        )}
                        status="active"
                      />
                      <Typography.Text className="text-grey-muted text-xs">
                        {csvExportJob.message}
                      </Typography.Text>
                    </div>
                  )}
                {csvExportJob.status !== 'IN_PROGRESS' && (
                  <Banner
                    className="border-radius"
                    isLoading={downloading}
                    message={csvExportJob.error ?? csvExportJob.message ?? ''}
                    type={csvExportJob.error ? 'error' : 'success'}
                  />
                )}
              </>
            )}
          </Modal>
        )}
      </>
    </EntityExportModalContext.Provider>
  );
};

export const useEntityExportModalProvider = () =>
  useContext<EntityExportModalContextProps>(EntityExportModalContext);
