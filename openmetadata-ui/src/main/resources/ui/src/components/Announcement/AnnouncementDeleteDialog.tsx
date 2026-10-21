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

interface AnnouncementDeleteDialogProps {
  isOpen: boolean;
  isDeleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * A core Dialog rather than the shared antd ConfirmationModal: it renders
 * inside react-aria overlays (the announcement drawer, the settings modal), and
 * two scroll-lock implementations on `document.body` fight each other every
 * frame, so the antd confirm never settles and its buttons stay unclickable.
 */
const AnnouncementDeleteDialog = ({
  isOpen,
  isDeleting = false,
  onCancel,
  onConfirm,
}: AnnouncementDeleteDialogProps) => {
  const { t } = useTranslation();

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <Modal>
        <Dialog
          data-testid="announcement-delete-confirm"
          width={480}
          onClose={onCancel}>
          <Dialog.Header title={t('message.delete-message-question-mark')} />
          <Dialog.Content>
            <Typography as="p" className="tw:text-secondary">
              {t('message.confirm-delete-message')}
            </Typography>
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" data-testid="cancel" onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary-destructive"
              data-testid="save-button"
              isLoading={isDeleting}
              onClick={onConfirm}>
              {t('label.delete')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default AnnouncementDeleteDialog;
