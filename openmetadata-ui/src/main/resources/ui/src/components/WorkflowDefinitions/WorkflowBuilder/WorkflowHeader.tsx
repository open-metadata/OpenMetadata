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
  Badge,
  Button,
  ButtonUtility,
  Card,
  Dialog,
  Dropdown,
  FeaturedIcon,
  Input,
  Modal,
  ModalOverlay,
  PageLayout,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { DotsVertical } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as WorkflowIcon } from '../../../assets/svg/workflow.svg';
import { useWorkflowModeContext } from '../../../contexts/WorkflowModeContext';
import { WorkflowHeaderProps } from '../../../interface/workflow-builder-components.interface';
import { showErrorToast } from '../../../utils/ToastUtils';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import { WorkflowControls } from './WorkflowControls';

const getInitialDisplayName = (title?: string) => title ?? '';

type WorkflowManageMenuProps = Pick<
  WorkflowHeaderProps,
  'handleDeleteWorkflow' | 'handleToggleSuspend' | 'isSuspended'
>;

const WorkflowManageMenu: React.FC<WorkflowManageMenuProps> = ({
  handleDeleteWorkflow,
  handleToggleSuspend,
  isSuspended = false,
}) => {
  const { t } = useTranslation();
  const { showDeleteButton, showEditButton } = useWorkflowModeContext();
  // Suspending is allowed wherever the workflow can be edited; deleting is a separate capability.
  const onToggleSuspend = showEditButton ? handleToggleSuspend : undefined;
  const onDelete = showDeleteButton ? handleDeleteWorkflow : undefined;

  if (!onToggleSuspend && !onDelete) {
    return null;
  }

  return (
    <Dropdown.Root>
      <ButtonUtility
        color="tertiary"
        data-testid="workflow-manage-button"
        icon={DotsVertical}
        size="sm"
        tooltip={t('label.more-action-plural')}
      />
      <Dropdown.Popover className="tw:w-min">
        <Dropdown.Menu
          aria-label={t('label.more-action-plural')}
          selectionMode="none">
          {onToggleSuspend && (
            <Dropdown.Item
              data-testid={
                isSuspended
                  ? 'resume-workflow-button'
                  : 'suspend-workflow-button'
              }
              id="suspend"
              label={isSuspended ? t('label.resume') : t('label.suspend')}
              onAction={onToggleSuspend}
            />
          )}
          {onDelete && (
            <Dropdown.Item
              data-testid="delete-workflow-button"
              id="delete"
              textValue={t('label.delete')}
              onAction={onDelete}>
              <span className="tw:text-error-primary">{t('label.delete')}</span>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({
  breadcrumb,
  editorLink,
  isAiMode = false,
  title,
  workflowName,
  handleTestWorkflow,
  handleSaveWorkflow,
  handleDeleteWorkflow,
  handleToggleSuspend,
  isSuspended,
  handleRevertAndCancel,
  handleRunWorkflow,
  isRunLoading = false,
  onUpdateDisplayName,
  variant = 'page',
}) => {
  const { t } = useTranslation();
  const {
    showEditButton,
    showSaveButton,
    showCancelButton,
    showTestButton,
    enterEditMode,
    enterViewMode,
    isViewMode,
    isNoOp,
  } = useWorkflowModeContext();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(
    getInitialDisplayName(title)
  );

  useEffect(() => {
    if (isEditModalOpen) {
      setDisplayNameInput(title ?? '');
    }
  }, [isEditModalOpen, title]);

  const handleSaveAndEnterViewMode = useCallback(async () => {
    try {
      await handleSaveWorkflow();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [handleSaveWorkflow]);

  const handleOpenEditModal = useCallback(() => {
    setIsEditModalOpen(true);
  }, []);

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
  };

  const handleSaveDisplayName = () => {
    if (onUpdateDisplayName && displayNameInput.trim()) {
      onUpdateDisplayName(displayNameInput.trim());
    }
    setIsEditModalOpen(false);
  };

  const manageMenu = (
    <WorkflowManageMenu
      handleDeleteWorkflow={handleDeleteWorkflow}
      handleToggleSuspend={handleToggleSuspend}
      isSuspended={isSuspended}
    />
  );

  const workflowControls = useMemo(
    () => (
      <WorkflowControls
        isRunLoading={isRunLoading}
        onCancelWorkflow={showCancelButton ? enterViewMode : undefined}
        onRevertAndCancel={showCancelButton ? handleRevertAndCancel : undefined}
        onRunWorkflow={handleRunWorkflow}
        onSaveWorkflow={showSaveButton ? handleSaveAndEnterViewMode : undefined}
        onTestWorkflow={showTestButton ? handleTestWorkflow : undefined}
      />
    ),
    [
      isRunLoading,
      showCancelButton,
      enterViewMode,
      handleRevertAndCancel,
      handleRunWorkflow,
      showSaveButton,
      handleSaveAndEnterViewMode,
      showTestButton,
      handleTestWorkflow,
    ]
  );

  const editWorkflowButton = useMemo(
    () =>
      showEditButton && (
        <>
          {editorLink && (
            <Button
              color="secondary"
              data-testid="workflow-editor-link"
              href={editorLink.path}
              size="sm">
              {t(editorLink.labelKey)}
            </Button>
          )}
          <Button
            color="primary"
            data-testid="edit-workflow-button"
            size="sm"
            onPress={enterEditMode}>
            {t('label.edit-workflow')}
          </Button>
        </>
      ),
    [showEditButton, enterEditMode, editorLink, t]
  );

  const suspendedBadge = isSuspended && (
    <Badge
      color="warning"
      data-testid="workflow-suspended-badge"
      size="sm"
      type="color">
      {t('label.suspended')}
    </Badge>
  );

  const systemBadge = useMemo(
    () =>
      isNoOp && (
        <Tooltip
          placement="top"
          title={t('message.system-workflow-edit-restriction')}>
          <TooltipTrigger>
            <Badge
              color="gray"
              data-testid="system-workflow-badge"
              size="sm"
              type="color">
              {t('label.system')}
            </Badge>
          </TooltipTrigger>
        </Tooltip>
      ),
    [isNoOp, t]
  );

  const editTitleButton = useMemo(
    () =>
      !isViewMode &&
      !isNoOp && (
        <EditIconButton
          newLook
          data-testid="edit-workflow-title-button"
          size="small"
          title={t('label.edit-entity', { entity: t('label.workflow') })}
          onClick={handleOpenEditModal}
        />
      ),
    [isViewMode, isNoOp, handleOpenEditModal, t]
  );

  const workflowIcon = (
    <FeaturedIcon color="brand" icon={WorkflowIcon} size="sm" theme="dark" />
  );

  // The host page shows the title, so only the controls that act on the workflow remain.
  if (variant === 'actions') {
    return (
      <div
        className="tw:flex tw:gap-3 tw:items-center"
        data-testid="workflow-header-actions">
        {workflowControls}
        {editWorkflowButton}
      </div>
    );
  }

  return (
    <>
      {isAiMode ? (
        <PageLayout.PageHeader
          actions={
            <>
              {workflowControls}
              {editWorkflowButton}
              {manageMenu}
            </>
          }
          badge={
            <>
              {suspendedBadge}
              {systemBadge}
              {editTitleButton}
            </>
          }
          breadcrumb={breadcrumb}
          data-testid="workflow-header"
          density="compact"
          icon={workflowIcon}
          subtitle={
            workflowName ? (
              <Typography
                ellipsis
                as="p"
                className="tw:m-0 tw:text-secondary tw:max-w-150"
                data-testid="workflow-description"
                size="text-sm">
                {workflowName}
              </Typography>
            ) : undefined
          }
          title={
            <Typography
              as="h3"
              className="tw:m-0 tw:text-primary"
              data-testid="workflow-title"
              ellipsis={{ tooltip: true }}
              size="text-xl"
              weight="semibold">
              {title}
            </Typography>
          }
          variant="gradient"
        />
      ) : (
        <Card className="tw:px-6 tw:py-4" data-testid="workflow-header">
          <div className="tw:flex tw:items-center tw:justify-between tw:gap-4">
            <div className="tw:flex tw:items-center tw:gap-3 tw:min-w-0">
              {workflowIcon}
              <div className="tw:min-w-0" data-testid="workflow-title-section">
                <div className="tw:flex tw:items-center tw:gap-2">
                  <Typography
                    as="p"
                    className="tw:m-0 tw:mb-1 tw:text-primary"
                    data-testid="workflow-title"
                    ellipsis={{ tooltip: true }}
                    size="text-md"
                    weight="semibold">
                    {title}
                  </Typography>
                  {suspendedBadge}
                  {systemBadge}
                  {editTitleButton}
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

            <div className="tw:flex tw:shrink-0 tw:gap-3 tw:items-center">
              {workflowControls}
              {editWorkflowButton}
              {manageMenu}
            </div>
          </div>
        </Card>
      )}

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
    </>
  );
};
