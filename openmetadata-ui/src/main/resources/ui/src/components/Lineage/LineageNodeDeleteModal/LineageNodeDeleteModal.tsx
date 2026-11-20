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
  FeaturedIcon,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@openmetadata/ui-core-components/icons';
import { useId } from 'react';
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
  const titleId = useId();

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
        <Dialog
          aria-labelledby={titleId}
          data-testid="delete-node-confirmation-modal"
          dividers="scroll"
          width={400}>
          <Dialog.Header className="tw:flex tw:flex-col tw:items-start tw:gap-4">
            <FeaturedIcon
              color="error"
              icon={Trash01}
              size="lg"
              theme="light"
            />
            <Typography id={titleId} size="text-md" weight="semibold">
              {t('label.delete-entity', { entity: nodeName })}
            </Typography>
          </Dialog.Header>
          <Dialog.Content>
            <Typography color="secondary" size="text-sm">
              {t('message.remove-lineage-node', { entity: nodeName })}
            </Typography>
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="cancel-button"
              isDisabled={isDeleting}
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary-destructive"
              data-testid="confirm-button"
              isDisabled={isDeleting}
              isLoading={isDeleting}
              onPress={onConfirm}>
              {t('label.delete')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default LineageNodeDeleteModal;
