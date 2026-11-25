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

import {
  Box,
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
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
  runId,
  onClose,
  onStopWorkflowsUpdate,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const { status } = await stopApp(appName, runId);
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
    <ModalOverlay isDismissable={false} isOpen={isModalOpen}>
      <Modal>
        <Dialog
          data-testid="stop-modal"
          dividers="scroll"
          showCloseButton={false}
          title={`${t('label.stop')} ${displayName} ?`}
          width={480}
          onClose={onClose}>
          <Dialog.Content>
            <Typography
              className="tw:text-tertiary"
              data-testid="stop-modal-body"
              size="text-sm">
              {t('message.are-you-sure-action-property', {
                action: t('label.stop'),
                propertyName: displayName,
              })}
            </Typography>
          </Dialog.Content>
          <Dialog.Footer>
            <Box
              className="tw:col-span-2"
              direction="row"
              gap={3}
              justify="end">
              <Button
                color="tertiary"
                isDisabled={isLoading}
                size="sm"
                onPress={onClose}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary-destructive"
                data-testid="stop-modal-confirm"
                isLoading={isLoading}
                size="sm"
                onPress={handleConfirm}>
                {t('label.confirm')}
              </Button>
            </Box>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default StopScheduleModal;
