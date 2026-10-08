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
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmationModalProps } from './ConfirmationModal.interface';

const ConfirmationModal = ({
  isLoading,
  cancelText,
  confirmText,
  header,
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  confirmButtonCss = '',
  cancelButtonCss = '',
  onConfirm,
  onCancel,
  bodyText,
  className,
  visible,
}: ConfirmationModalProps) => {
  const { t } = useTranslation();
  const headerId = useId();

  return (
    <ModalOverlay
      isDismissable={false}
      isOpen={visible}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        {/* `header` may be a node, so the dialog is named by reference
            rather than through Dialog's string `title`. */}
        <Dialog
          aria-labelledby={headerId}
          className={className}
          data-testid="confirmation-modal"
          width={520}>
          <Dialog.Header>
            <Typography
              className={headerClassName}
              data-testid="modal-header"
              id={headerId}
              size="text-md"
              weight="semibold">
              {header}
            </Typography>
          </Dialog.Header>
          <Dialog.Content className={bodyClassName}>
            <Typography data-testid="body-text">{bodyText}</Typography>
          </Dialog.Content>
          <Dialog.Footer className={footerClassName}>
            <Button
              className={cancelButtonCss}
              color="tertiary"
              data-testid="cancel"
              onPress={onCancel}>
              {cancelText}
            </Button>
            <Button
              className={confirmButtonCss}
              color={
                confirmText === t('label.delete')
                  ? 'primary-destructive'
                  : 'primary'
              }
              data-testid={isLoading ? 'loading-button' : 'save-button'}
              isLoading={isLoading}
              onPress={onConfirm}>
              {confirmText}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ConfirmationModal;
