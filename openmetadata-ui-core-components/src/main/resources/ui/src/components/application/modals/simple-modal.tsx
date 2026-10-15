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
import type { ReactNode } from 'react';
import { Button } from '@/components/base/buttons/button';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { Dialog, Modal, ModalOverlay } from './modal';

export interface SimpleModalProps {
  isOpen: boolean;
  title?: string;
  children?: ReactNode;
  onOk?: () => void;
  /** Called by the Cancel button, the close button, Escape, and (when dismissable) an overlay click. */
  onCancel: () => void;
  okText?: ReactNode;
  cancelText?: ReactNode;
  isOkLoading?: boolean;
  isOkDisabled?: boolean;
  /** @default 'primary' */
  okButtonColor?: 'primary' | 'primary-destructive';
  /** Replaces the default Cancel/OK footer; `null` hides the footer entirely. */
  footer?: ReactNode | null;
  width?: number;
  /** Whether clicking the overlay closes the modal. @default true */
  isDismissable?: boolean;
  'data-testid'?: string;
}

export const SimpleModal = ({
  isOpen,
  title,
  children,
  onOk,
  onCancel,
  okText,
  cancelText,
  isOkLoading,
  isOkDisabled,
  okButtonColor = 'primary',
  footer,
  width,
  isDismissable = true,
  'data-testid': dataTestId,
}: SimpleModalProps) => {
  const { t } = useCoreTranslation();

  return (
    <ModalOverlay
      isDismissable={isDismissable}
      isOpen={isOpen}
      onOpenChange={(open) => !open && onCancel()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid={dataTestId}
          title={title}
          width={width}
          onClose={onCancel}>
          <Dialog.Content>{children}</Dialog.Content>
          {footer !== null && (
            <Dialog.Footer>
              {footer ?? (
                <>
                  <Button color="secondary" onPress={onCancel}>
                    {cancelText ?? t('label.cancel')}
                  </Button>
                  <Button
                    color={okButtonColor}
                    isDisabled={isOkDisabled}
                    isLoading={isOkLoading}
                    onPress={onOk}>
                    {okText ?? t('label.ok')}
                  </Button>
                </>
              )}
            </Dialog.Footer>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
