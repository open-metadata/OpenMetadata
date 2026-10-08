/*
 *  Copyright 2026 Collate.
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
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  isLoading?: boolean;
  isDestructive?: boolean;
  testId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmLabel,
  isLoading,
  isDestructive,
  testId,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const { t } = useTranslation();

  // The confirmed action can't be cancelled mid-flight, so nothing may close the dialog.
  const close = () => !isLoading && onCancel();

  return (
    <ModalOverlay
      isDismissable={!isLoading}
      isKeyboardDismissDisabled={isLoading}
      isOpen={isOpen}
      onOpenChange={(open) => !open && close()}>
      <Modal>
        <Dialog
          data-testid={testId}
          dividers="scroll"
          showCloseButton={!isLoading}
          title={title}
          width={480}
          onClose={close}>
          <Dialog.Content>
            <Typography className="tw:text-tertiary" size="text-sm">
              {message}
            </Typography>
          </Dialog.Content>
          <Dialog.Footer>
            <div className="tw:col-span-2 tw:flex tw:justify-end tw:gap-3">
              <Button
                color="tertiary"
                data-testid={`${testId}-cancel`}
                isDisabled={isLoading}
                size="sm"
                onPress={onCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                color={isDestructive ? 'primary-destructive' : 'primary'}
                data-testid={`${testId}-confirm`}
                isLoading={isLoading}
                size="sm"
                onPress={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ConfirmDialog;
