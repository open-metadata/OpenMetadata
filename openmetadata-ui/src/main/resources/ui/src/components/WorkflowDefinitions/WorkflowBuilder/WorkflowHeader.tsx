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
  Card,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as WorkflowIcon } from '../../../assets/svg/workflow.svg';
import { useWorkflowModeContext } from '../../../contexts/WorkflowModeContext';
import { WorkflowHeaderProps } from '../../../interface/workflow-builder-components.interface';
import { showErrorToast } from '../../../utils/ToastUtils';
import { WorkflowControls } from './WorkflowControls';

export const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({
  title,
  workflowName,
  handleTestWorkflow,
  handleSaveWorkflow,
  handleDeleteWorkflow,
  handleRevertAndCancel,
  handleRunWorkflow,
  isRunLoading = false,
  onUpdateDisplayName,
}) => {
  const { t } = useTranslation();
  const {
    showEditButton,
    showSaveButton,
    showCancelButton,
    showTestButton,
    showDeleteButton,
    enterEditMode,
    enterViewMode,
    isViewMode,
  } = useWorkflowModeContext();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(title ?? '');

  useEffect(() => {
    if (isEditModalOpen) {
      setDisplayNameInput(title ?? '');
    }
  }, [isEditModalOpen, title]);

  const handleSaveAndEnterViewMode = async () => {
    try {
      await handleSaveWorkflow();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleOpenEditModal = () => {
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
  };

  const handleSaveDisplayName = () => {
    if (onUpdateDisplayName && displayNameInput.trim()) {
      onUpdateDisplayName(displayNameInput.trim());
    }
    setIsEditModalOpen(false);
  };

  return (
    <Card className="tw:px-6 tw:py-4" data-testid="workflow-header">
      <div className="tw:flex tw:items-center tw:justify-between">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:flex tw:items-center tw:justify-center tw:size-8 tw:rounded-md tw:bg-brand-solid">
            <WorkflowIcon className="tw:size-4 tw:text-white" />
          </div>

          <div data-testid="workflow-title-section">
            <div className="tw:flex tw:items-center tw:gap-2">
              <Typography
                ellipsis
                as="p"
                className="tw:m-0 tw:mb-1 tw:text-primary"
                data-testid="workflow-title"
                size="text-md"
                weight="semibold">
                {title}
              </Typography>
              {!isViewMode && (
                <Button
                  color="tertiary"
                  data-testid="edit-workflow-title-button"
                  iconLeading={EditIcon}
                  size="sm"
                  onPress={handleOpenEditModal}
                />
              )}
            </div>
            {workflowName && (
              <Typography
                ellipsis
                as="p"
                className="tw:m-0 tw:text-secondary tw:max-w-150"
                data-testid="workflow-description"
                size="text-sm">
                {workflowName}
              </Typography>
            )}
          </div>
        </div>

        <div className="tw:flex tw:gap-3 tw:items-center">
          <WorkflowControls
            isRunLoading={isRunLoading}
            onCancelWorkflow={showCancelButton ? enterViewMode : undefined}
            onDeleteWorkflow={
              showDeleteButton ? handleDeleteWorkflow : undefined
            }
            onRevertAndCancel={
              showCancelButton ? handleRevertAndCancel : undefined
            }
            onRunWorkflow={handleRunWorkflow}
            onSaveWorkflow={
              showSaveButton ? handleSaveAndEnterViewMode : undefined
            }
            onTestWorkflow={showTestButton ? handleTestWorkflow : undefined}
          />
          {showEditButton && (
            <Button
              color="primary"
              data-testid="edit-workflow-button"
              size="sm"
              onPress={enterEditMode}>
              {t('label.edit-workflow')}
            </Button>
          )}
        </div>
      </div>

      <ModalOverlay isOpen={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <Modal>
          <Dialog
            showCloseButton
            title={t('label.edit-entity', {
              entity: t('label.display-name'),
            })}
            width={480}
            onClose={handleCloseEditModal}>
            <Dialog.Content>
              <Input isDisabled label={t('label.name')} value={workflowName} />
              <Input
                label={t('label.display-name')}
                placeholder={t('message.enter-display-name')}
                value={displayNameInput}
                onChange={setDisplayNameInput}
              />
            </Dialog.Content>
            <Dialog.Footer>
              <Button
                color="secondary"
                data-testid="cancel-button"
                size="md"
                onPress={handleCloseEditModal}>
                {t('label.cancel')}
              </Button>
              <Button
                data-testid="save-button"
                size="md"
                onPress={handleSaveDisplayName}>
                {t('label.save')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </Card>
  );
};
