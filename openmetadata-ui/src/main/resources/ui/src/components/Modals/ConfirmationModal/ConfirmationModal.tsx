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
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { ConfirmationModalProps } from './ConfirmationModal.interface';

/**
 * Modal to show confirmation on varios page
 * @param param0
 * @returns
 */
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

  return (
    // `maskClosable={false}` -> `isDismissable={false}`: a confirmation is
    // often destructive, so a stray backdrop click must not answer it.
    <ModalOverlay
      isDismissable={false}
      isOpen={visible}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        <Dialog
          className={className}
          data-testid="confirmation-modal"
          onClose={onCancel}>
          {/* Dialog's own `title` prop takes a string; this header is a node
              carrying a test id, so it goes through Dialog.Header instead. */}
          <Dialog.Header>
            <Typography
              className={headerClassName}
              data-testid="modal-header"
              weight="bold">
              {header}
            </Typography>
          </Dialog.Header>
          <Dialog.Content>
            <div className={classNames('h-20', bodyClassName)}>
              <Typography data-testid="body-text">{bodyText}</Typography>
            </div>
          </Dialog.Content>
          <Dialog.Footer className={classNames('justify-end', footerClassName)}>
            <Button
              className={classNames('mr-2', cancelButtonCss)}
              color="tertiary"
              data-testid="cancel"
              onClick={onCancel}>
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
              onClick={onConfirm}>
              {confirmText}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ConfirmationModal;
