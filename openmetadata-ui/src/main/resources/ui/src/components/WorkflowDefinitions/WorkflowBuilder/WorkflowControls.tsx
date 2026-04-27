/*
 *  Copyright 2024 Collate.
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
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkflowModeContext } from '../../../contexts/WorkflowModeContext';
import { WorkflowControlsProps } from '../../../interface/workflow-builder-components.interface';

export const WorkflowControls: React.FC<WorkflowControlsProps> = ({
  onTestWorkflow,
  onSaveWorkflow,
  onCancelWorkflow,
  onRevertAndCancel,
  onRunWorkflow,
  onDeleteWorkflow,
  isRunLoading = false,
}) => {
  const { t } = useTranslation();
  const { showRunButton } = useWorkflowModeContext();
  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleCancelClick = () => {
    setShowCancelModal(true);
  };

  const handleProceedToCancel = () => {
    setShowCancelModal(false);
    if (onRevertAndCancel) {
      onRevertAndCancel();
    }
  };

  const handleSaveChanges = () => {
    setShowCancelModal(false);
    if (onSaveWorkflow) {
      onSaveWorkflow();
    }
  };

  return (
    <div className="tw:flex tw:gap-3">
      {onDeleteWorkflow && (
        <Button
          color="tertiary-destructive"
          data-testid="delete-workflow-button"
          size="sm"
          onPress={onDeleteWorkflow}>
          {t('label.delete-workflow')}
        </Button>
      )}
      {showRunButton && onRunWorkflow && (
        <Button
          color="secondary"
          data-testid="run-workflow-button"
          isDisabled={isRunLoading}
          size="sm"
          onPress={onRunWorkflow}>
          {isRunLoading ? t('label.running') : t('label.run-now')}
        </Button>
      )}
      {onCancelWorkflow && (
        <Button
          color="secondary"
          data-testid="cancel-workflow-button"
          size="sm"
          onPress={handleCancelClick}>
          {t('label.cancel')}
        </Button>
      )}
      {onTestWorkflow && (
        <Button
          color="secondary"
          data-testid="test-workflow-button"
          size="sm"
          onPress={onTestWorkflow}>
          {t('label.validate-workflow')}
        </Button>
      )}
      {onSaveWorkflow && (
        <Button
          color="primary"
          data-testid="save-workflow-button"
          size="sm"
          onPress={onSaveWorkflow}>
          {t('label.save-workflow')}
        </Button>
      )}

      <ModalOverlay isOpen={showCancelModal} onOpenChange={setShowCancelModal}>
        <Modal>
          <Dialog
            showCloseButton
            title={t('message.discard-your-changes')}
            width={480}
            onClose={() => setShowCancelModal(false)}>
            <Dialog.Content>
              <Typography
                as="p"
                className="tw:m-0 tw:text-secondary"
                size="text-sm">
                {t('message.unsaved-changes-warning')}
              </Typography>
            </Dialog.Content>
            <Dialog.Footer>
              <Button
                color="secondary"
                data-testid="save-workflow-cancel-modal-button"
                size="sm"
                onPress={handleSaveChanges}>
                {t('label.save-workflow')}
              </Button>
              <Button
                color="primary"
                data-testid="close-without-saving-button"
                size="sm"
                onPress={handleProceedToCancel}>
                {t('label.close-without-saving')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
};
