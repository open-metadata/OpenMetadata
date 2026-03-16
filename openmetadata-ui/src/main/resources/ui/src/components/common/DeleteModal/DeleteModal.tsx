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
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import Loader from '../Loader/Loader';
import { DeleteModalProps } from './DeleteModal.interface';

export const DeleteModal = ({
  open,
  entityTitle,
  message,
  isDeleting = false,
  onCancel,
  onDelete,
}: DeleteModalProps) => {
  const { t } = useTranslation();

  return (
    <ModalOverlay
      isDismissable={!isDeleting}
      isOpen={open}
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
            <div className="tw:z-10 tw:flex tw:flex-col tw:gap-0.5 tw:mt-4">
              <Typography as="span" className="tw:text-md tw:font-semibold">
                {t('label.delete')} {entityTitle}
              </Typography>
              <Typography as="p" className="tw:text-sm tw:text-tertiary">
                {message}
              </Typography>
            </div>
          </Dialog.Header>
          <div className="tw:z-10 tw:flex tw:flex-1 tw:flex-col-reverse tw:gap-3 tw:p-4 tw:pt-6 tw:*:grow tw:sm:grid tw:sm:grid-cols-2 tw:sm:px-6 tw:sm:pt-8 tw:sm:pb-6">
            <Button
              color="secondary"
              data-testid="cancel-button"
              isDisabled={isDeleting}
              size="lg"
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary-destructive"
              data-testid="confirm-button"
              isDisabled={isDeleting}
              size="lg"
              onPress={onDelete}>
              {isDeleting ? (
                <Loader size="small" type="white" />
              ) : (
                t('label.delete')
              )}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default DeleteModal;
