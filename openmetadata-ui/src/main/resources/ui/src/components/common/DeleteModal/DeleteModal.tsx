/*
 *  Copyright 2025 Collate.
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
  Button,
  Dialog,
  FeaturedIcon,
  Grid,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { DeleteModalProps } from './DeleteModal.interface';

// antd's @zindex-modal / @zindex-modal-mask are both 1000; this only needs
// to beat that when a consumer opts in via `elevated` (see DeleteModalProps).
const BASE_Z_INDEX = 999;
const ELEVATED_Z_INDEX = 1001;

export const DeleteModal = ({
  open,
  entityTitle,
  message,
  isDeleting = false,
  elevated = false,
  onCancel,
  onDelete,
}: DeleteModalProps) => {
  const { t } = useTranslation();

  return (
    <ModalOverlay
      data-testid="delete-modal"
      isDismissable={!isDeleting}
      isOpen={open}
      style={{ zIndex: elevated ? ELEVATED_Z_INDEX : BASE_Z_INDEX }}
      onOpenChange={(isOpen) => !isOpen && !isDeleting && onCancel()}>
      <Modal>
        <Dialog width={400} onClose={onCancel}>
          <Dialog.Header className="tw:flex-col">
            <FeaturedIcon
              color="error"
              icon={Trash01}
              size="lg"
              theme="light"
            />
            <div
              className="tw:flex tw:flex-col tw:gap-0.5 tw:mt-4 tw:min-w-0 tw:w-full"
              data-testid="modal-header">
              <Typography ellipsis size="text-md" weight="semibold">
                {t('label.delete')} {entityTitle}
              </Typography>
              <Typography as="p" className="tw:text-tertiary tw:break-words">
                {message}
              </Typography>
            </div>
          </Dialog.Header>
          <Grid
            className="tw:p-4 tw:pt-6 tw:sm:px-6 tw:sm:pt-8 tw:sm:pb-6"
            colGap="3"
            data-testid="modal-footer">
            <Grid.Item span={12}>
              <Button
                className="tw:w-full"
                color="secondary"
                data-testid="cancel-button"
                isDisabled={isDeleting}
                size="lg"
                onPress={onCancel}>
                {t('label.cancel')}
              </Button>
            </Grid.Item>
            <Grid.Item span={12}>
              <Button
                className="tw:w-full"
                color="primary-destructive"
                data-testid="confirm-button"
                isDisabled={isDeleting}
                isLoading={isDeleting}
                size="lg"
                onPress={onDelete}>
                {t('label.delete')}
              </Button>
            </Grid.Item>
          </Grid>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default DeleteModal;
