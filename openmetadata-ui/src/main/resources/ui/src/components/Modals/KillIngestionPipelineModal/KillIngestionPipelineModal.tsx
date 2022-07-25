/*
 *  Copyright 2021 Collate
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

import { Modal } from 'antd';
import { AxiosError } from 'axios';
import React, { FC, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { killIngestionPipelineById } from '../../../axiosAPIs/ingestionPipelineAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

interface KillIngestionModalProps {
  pipelineId: string;
  pipelinName: string;
  isModalOpen: boolean;
  onClose: () => void;
}

const KillIngestionModal: FC<KillIngestionModalProps> = ({
  pipelineId,
  pipelinName,
  isModalOpen,
  onClose,
}) => {
  const history = useHistory();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const response = await killIngestionPipelineById(pipelineId);
      const status = response.status;
      if (status === 200) {
        onClose();
        showSuccessToast(
          `Successfully killed running workflows for ${pipelinName}.`
        );
        // reload the page after successful api response
        history.go(0);
      }
    } catch (error) {
      // catch block error is unknown type so we have to cast it to respective type
      showErrorToast(error as AxiosError);
      onClose();
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
      title={`Kill ${pipelinName} ?`}
      visible={isModalOpen}
      onCancel={onClose}
      onOk={handleConfirm}>
      <span data-testid="kill-modal-body">
        Once you kill this Ingestion, all running and queued workflows will be
        stopped and marked as Failed.
      </span>
    </Modal>
  );
};

export default KillIngestionModal;
