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
import React, { ChangeEvent, FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportGlossaryInCSVFormat } from 'rest/glossaryAPI';
import { getCurrentLocaleDate } from 'utils/TimeUtils';
import { showErrorToast } from 'utils/ToastUtils';

interface Props {
  isModalOpen: boolean;
  glossaryName: string;
  onCancel: () => void;
  onOk: () => void;
}

const ExportGlossaryModal: FC<Props> = ({
  isModalOpen,
  onCancel,
  onOk,
  glossaryName,
}) => {
  const { t } = useTranslation();
  const [fileName, setFileName] = useState<string>(
    `${glossaryName}_${getCurrentLocaleDate()}`
  );

  const handleOnFileNameChange = (e: ChangeEvent<HTMLInputElement>) =>
    setFileName(e.target.value);

  /**
   * Creates a downloadable file from csv string and download it on users system
   * @param data - csv string
   */
  const handleDownload = (data: string) => {
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

  const handleExport = async () => {
    try {
      const data = await exportGlossaryInCSVFormat(glossaryName);

      handleDownload(data);
      onOk();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  return (
    <Modal
      centered
      cancelText={t('label.cancel')}
      closable={false}
      data-testid="export-glossary-modal"
      maskClosable={false}
      okText={t('label.export')}
      open={isModalOpen}
      title={t('label.export-glossary-terms')}
      onCancel={onCancel}
      onOk={handleExport}>
      <Form layout="vertical">
        <Form.Item label="File Name:">
          <Input
            addonAfter=".csv"
            data-testid="file-name-input"
            value={fileName}
            onChange={handleOnFileNameChange}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ExportGlossaryModal;
