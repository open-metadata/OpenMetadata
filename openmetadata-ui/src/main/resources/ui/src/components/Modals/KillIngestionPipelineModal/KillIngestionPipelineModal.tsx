/*
 *  Copyright 2022 Collate.
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

import { Modal, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { postKillIngestionPipelineById } from 'rest/ingestionPipelineAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

interface KillIngestionModalProps {
  pipelineId: string;
  pipelinName: string;
  isModalOpen: boolean;
  onClose: () => void;
  onIngestionWorkflowsUpdate: () => void;
}

const KillIngestionModal: FC<KillIngestionModalProps> = ({
  pipelineId,
  pipelinName,
  isModalOpen,
  onClose,
  onIngestionWorkflowsUpdate,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const response = await postKillIngestionPipelineById(pipelineId);
      const status = response.status;
      if (status === 200) {
        onClose();
        showSuccessToast(` ${t('message.kill-successfully')}  ${pipelinName}.`);
        onIngestionWorkflowsUpdate();
      }
    } catch (error) {
      // catch block error is unknown type so we have to cast it to respective type
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      destroyOnClose
      closable={false}
      confirmLoading={isLoading}
      data-testid="kill-modal"
      okText="Confirm"
      title={`${t('label.kill')} ${pipelinName} ?`}
      visible={isModalOpen}
      onCancel={onClose}
      onOk={handleConfirm}>
      <Typography.Text data-testid="kill-modal-body">
        {t('message.kill-ingestion-warning')}
      </Typography.Text>
    </Modal>
  );
};

export default KillIngestionModal;
