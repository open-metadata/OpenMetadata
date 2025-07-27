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
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { stopApp } from '../../../rest/applicationAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { StopScheduleRunModalProps } from './StopScheduleRunModal.interface';

const StopScheduleModal: FC<StopScheduleRunModalProps> = ({
  appName,
  isModalOpen,
  displayName,
  onClose,
  onStopWorkflowsUpdate,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const { status } = await stopApp(appName);
      if (status === 200) {
        showSuccessToast(
          t('message.application-stop', {
            pipelineName: displayName,
          })
        );
        onStopWorkflowsUpdate?.();
      }
    } catch (error) {
      // catch block error is unknown type so we have to cast it to respective type
      showErrorToast(error as AxiosError);
    } finally {
      onClose();
      setIsLoading(false);
    }
  };

  return (
    <Modal
      destroyOnClose
      cancelText={t('label.cancel')}
      closable={false}
      confirmLoading={isLoading}
      data-testid="stop-modal"
      maskClosable={false}
      okText={t('label.confirm')}
      open={isModalOpen}
      title={`${t('label.stop')} ${displayName} ?`}
      onCancel={onClose}
      onOk={handleConfirm}>
      <Typography.Text data-testid="stop-modal-body">
        {t('message.are-you-sure-action-property', {
          action: 'Stop',
          propertyName: displayName,
        })}
      </Typography.Text>
    </Modal>
  );
};

export default StopScheduleModal;
