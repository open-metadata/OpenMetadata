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
import { Form, Input, Modal } from 'antd';
import { AxiosError } from 'axios';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentISODate } from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  EntityExportModalContextProps,
  ExportData,
} from './EntityExportModalProvider.interface';

const EntityExportModalContext =
  React.createContext<EntityExportModalContextProps>(
    {} as EntityExportModalContextProps
  );

export const EntityExportModalProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [form] = Form.useForm();
  const { t } = useTranslation();
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
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

  const handleExport = async ({ fileName }: { fileName: string }) => {
    if (exportData === null) {
      return;
    }
    try {
      setDownloading(true);
      const data = await exportData.onExport(exportData.name);

      handleDownload(data, fileName);
      handleCancel();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (exportData) {
      form.setFieldValue(
        'fileName',
        `${exportData.name}_${getCurrentISODate()}`
      );
    }
  }, [exportData]);

  const providerValue = useMemo(() => ({ showModal }), []);

  return (
    <EntityExportModalContext.Provider value={providerValue}>
      <>
        {children}
        {exportData && (
          <Modal
            centered
            open
            cancelText={t('label.cancel')}
            closable={false}
            confirmLoading={downloading}
            data-testid="export-entity-modal"
            maskClosable={false}
            okButtonProps={{
              form: 'export-form',
              htmlType: 'submit',
              id: 'submit-button',
            }}
            okText={t('label.export')}
            title={exportData.title ?? t('label.export')}
            onCancel={handleCancel}>
            <Form
              form={form}
              id="export-form"
              layout="vertical"
              onFinish={handleExport}>
              <Form.Item
                label={`${t('label.entity-name', {
                  entity: t('label.file'),
                })}:`}
                name="fileName">
                <Input addonAfter=".csv" data-testid="file-name-input" />
              </Form.Item>
            </Form>
          </Modal>
        )}
      </>
    </EntityExportModalContext.Provider>
  );
};

export const useEntityExportModalProvider = () =>
  React.useContext<EntityExportModalContextProps>(EntityExportModalContext);
