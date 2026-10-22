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
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

export type LineageNodeDeleteModalProps = {
  isOpen: boolean;
  isDeleting: boolean;
  nodeName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

const LineageNodeDeleteModal = ({
  isOpen,
  isDeleting,
  nodeName,
  onCancel,
  onConfirm,
}: LineageNodeDeleteModalProps) => {
  const { t } = useTranslation();

  if (!isOpen) {
    return null;
  }

  return (
    <ModalOverlay
      isDismissable={!isDeleting}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}>
      <Modal>
        <Dialog data-testid="delete-node-confirmation-modal" width={400}>
          <Dialog.Header title={t('label.delete')} />
          <Dialog.Content>
            {t('message.remove-lineage-node', { entity: nodeName })}
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="tertiary"
              data-testid="cancel-button"
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="confirm-button"
              isDisabled={isDeleting}
              isLoading={isDeleting}
              onPress={onConfirm}>
              {t('label.confirm')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default LineageNodeDeleteModal;
