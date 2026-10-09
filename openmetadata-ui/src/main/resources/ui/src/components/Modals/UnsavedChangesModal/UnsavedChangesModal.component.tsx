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
    Box,
    Button,
    Dialog,
    FeaturedIcon,
    Modal,
    ModalOverlay,
    Typography
} from '@openmetadata/ui-core-components';
import { SaveOutlined } from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { UnsavedChangesModalProps } from './UnsavedChangesModal.interface';

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  open,
  onDiscard,
  onSave,
  onCancel,
  title,
  description,
  discardText,
  saveText,
  loading = false,
}) => {
  const { t } = useTranslation();

  return (
    <ModalOverlay
      isDismissable
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && onCancel?.()}>
      <Modal>
        <Dialog
          showCloseButton
          aria-label={title || t('message.unsaved-changes')}
          data-testid="unsaved-changes-modal"
          dividers="scroll"
          width={400}
          onClose={onCancel}>
          <Box className="tw:p-6" direction="col" gap={4}>
            <FeaturedIcon color="warning" icon={SaveOutlined} size="md" />
            <Box direction="col" gap={1}>
              <Typography
                as="h5"
                className="tw:m-0 tw:text-primary"
                data-testid="unsaved-changes-modal-title"
                size="text-md"
                weight="semibold">
                {title || t('message.unsaved-changes')}
              </Typography>
              <Typography
                className="tw:text-tertiary"
                data-testid="unsaved-changes-modal-description"
                size="text-sm">
                {description || t('message.unsaved-changes-description')}
              </Typography>
            </Box>
            <Box className="tw:mt-4" direction="row" gap={3}>
              <Button
                className="tw:flex-1"
                color="secondary"
                data-testid="unsaved-changes-modal-discard"
                onPress={onDiscard}>
                {discardText || t('message.unsaved-changes-discard')}
              </Button>
              <Button
                className="tw:flex-1"
                color="primary"
                data-testid="unsaved-changes-modal-save"
                isLoading={loading}
                onPress={onSave}>
                {saveText || t('message.unsaved-changes-save')}
              </Button>
            </Box>
          </Box>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
