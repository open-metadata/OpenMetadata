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
import { Badge, Form, Input, Modal } from 'antd';
import { Select } from '../../common/AntdCompat';;
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
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
  BETA_EXPORT_TYPES,
  ExportTypes,
} from '../../../constants/Export.constants';
import { getCurrentISODate } from '../../../utils/date-time/DateTimeUtils';
import { isBulkEditRoute } from '../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import exportUtilClassBase from '../../../utils/ExportUtilClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import Banner from '../../common/Banner/Banner';
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

  const showModal = (data: ExportData) => {
    setExportData(data);
  };

  /**
   * Creates a downloadable file from csv string and download it on users system
   * @param data - csv string
   */
  const handleDownload = (data: string, fileName: string) => {
    const element = document.createElement('a');

    const file = new Blob([data], { type: 'text/plain' });

    element.textContent = 'download-file';
    element.href = URL.createObjectURL(file);
    element.download = `${fileName}.csv`;
    document.body.appendChild(element);
    element.click();

    URL.revokeObjectURL(element.href);
    document.body.removeChild(element);
  };

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
      setDownloading(true);

      if (exportType !== ExportTypes.CSV) {
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
        handleDownload(data, fileName);
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
    }
  };

  const handleCSVExportSuccess = useCallback(
    (data: string, fileName?: string) => {
      if (isBulkEdit) {
        setCSVExportData(data);
      } else {
        handleDownload(
          data,
          fileName ?? `${exportData?.name}_${getCurrentISODate()}`
        );
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
      } else {
        setDownloading(false);
      }
    },
    [isBulkEdit, handleCSVExportSuccess]
  );

  useEffect(() => {
    if (exportData) {
      if (isBulkEdit) {
        handleExport({
          fileName: 'bulk-edit',
          exportType: ExportTypes.CSV,
        });
      } else {
        form.setFieldsValue({
          fileName: `${exportData.name}_${getCurrentISODate()}`,
          exportType: exportData.exportTypes[0],
        });
      }
    }
  }, [isBulkEdit, exportData]);

  const providerValue = useMemo(
    () => ({
      csvExportData,
      clearCSVExportData: handleClearCSVExportData,
      showModal,
      triggerExportForBulkEdit: (exportData: ExportData) => {
        setExportData(exportData);
      },
      onUpdateCSVExportJob: handleCSVExportJobUpdate,
    }),
    [isBulkEdit, csvExportData, handleCSVExportJobUpdate]
  );

  return (
    <EntityExportModalContext.Provider value={providerValue}>
      <>
        {children}
        {exportData && !isBulkEdit && (
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
              <Banner
                className="border-radius"
                isLoading={downloading}
                message={csvExportJob.error ?? csvExportJob.message ?? ''}
                type={csvExportJob.error ? 'error' : 'success'}
              />
            )}
          </Modal>
        )}
      </>
    </EntityExportModalContext.Provider>
  );
};

export const useEntityExportModalProvider = () =>
  useContext<EntityExportModalContextProps>(EntityExportModalContext);
