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
  Select,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../../../../generated/entity/type';
import { TestCaseFailureReasonType } from '../../../../../generated/tests/testCaseResolutionStatus';
import TaskAssigneeSelect from './TaskAssigneeSelect';

type TFunc = ReturnType<typeof useTranslation>['t'];

export interface TaskActionValues {
  comment: string;
  rootCause?: string;
  assignee?: EntityReference;
}

export interface TaskActionCommentModalProps {
  open: boolean;
  title: string;
  actionLabel: string;
  // Rendered under the title, e.g. "#TASK-19610 · Data Access request".
  subtitle?: React.ReactNode;
  // When set, the comment is mandatory and this message is the field hint.
  requiredMessage?: string;
  // Label for the comment field; defaults to a plain "Comment".
  commentLabel?: string;
  showComment?: boolean;
  // Adds a required Root Cause select, persisted as testCaseFailureReason.
  showRootCause?: boolean;
  // Adds a required assignee picker, sent as payload.assignees.
  showAssignee?: boolean;
  isLoading?: boolean;
  onConfirm: (values: TaskActionValues) => void | Promise<void>;
  onCancel: () => void;
}

// Ordered to match the incident-manager resolve modal, not the enum.
const ROOT_CAUSE_OPTIONS = [
  TestCaseFailureReasonType.FalsePositive,
  TestCaseFailureReasonType.MissingData,
  TestCaseFailureReasonType.Duplicates,
  TestCaseFailureReasonType.OutOfBounds,
  TestCaseFailureReasonType.Other,
].map((reason) => ({ id: reason, label: reason }));

interface TaskAssigneeFieldProps {
  show: boolean;
  isLoading: boolean;
  touched: boolean;
  isMissing: boolean;
  selected?: EntityReference;
  t: TFunc;
  onChange: (next?: EntityReference) => void;
}

// Each field owns its show/hint/isInvalid branching so those decisions don't
// add to the parent modal's cyclomatic complexity.
const TaskAssigneeField = ({
  show,
  isLoading,
  touched,
  isMissing,
  selected,
  t,
  onChange,
}: TaskAssigneeFieldProps) => {
  if (!show) {
    return null;
  }

  const isInvalid = touched && isMissing;
  const hint = isInvalid
    ? t('message.field-text-is-required', { fieldText: t('label.assign-to') })
    : undefined;

  return (
    <TaskAssigneeSelect
      hint={hint}
      isDisabled={isLoading}
      isInvalid={isInvalid}
      selected={selected}
      onChange={onChange}
    />
  );
};

interface TaskRootCauseFieldProps {
  show: boolean;
  isLoading: boolean;
  touched: boolean;
  isMissing: boolean;
  rootCause?: string;
  t: TFunc;
  onChange: (key?: string) => void;
}

const TaskRootCauseField = ({
  show,
  isLoading,
  touched,
  isMissing,
  rootCause,
  t,
  onChange,
}: TaskRootCauseFieldProps) => {
  if (!show) {
    return null;
  }

  const isInvalid = touched && isMissing;
  const hint = isInvalid
    ? t('message.field-text-is-required', { fieldText: t('label.reason') })
    : undefined;

  return (
    <Select
      isRequired
      data-testid="task-action-root-cause"
      hint={hint}
      isDisabled={isLoading}
      isInvalid={isInvalid}
      items={ROOT_CAUSE_OPTIONS}
      label={t('label.reason')}
      placeholder={t('label.please-select-entity', {
        entity: t('label.reason'),
      })}
      selectedKey={rootCause ?? null}
      onSelectionChange={(key) => onChange(key ? String(key) : undefined)}>
      {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
    </Select>
  );
};

interface TaskCommentFieldProps {
  show: boolean;
  isLoading: boolean;
  touched: boolean;
  isMissing: boolean;
  requiredMessage?: string;
  commentLabel?: string;
  comment: string;
  t: TFunc;
  onChange: (next: string) => void;
}

const TaskCommentField = ({
  show,
  isLoading,
  touched,
  isMissing,
  requiredMessage,
  commentLabel,
  comment,
  t,
  onChange,
}: TaskCommentFieldProps) => {
  if (!show) {
    return null;
  }

  const isInvalid = touched && isMissing;
  const hint = isInvalid ? requiredMessage : undefined;
  const resolvedLabel = commentLabel ?? t('label.comment');

  return (
    <TextArea
      data-testid="task-action-comment"
      hint={hint}
      isDisabled={isLoading}
      isInvalid={isInvalid}
      isRequired={Boolean(requiredMessage)}
      label={resolvedLabel}
      placeholder={t('label.enter-entity', { entity: resolvedLabel })}
      rows={4}
      value={comment}
      onChange={onChange}
    />
  );
};

/**
 * Shared modal for task actions that cannot resolve on a click alone: a
 * transition flagged requiresComment, an (re)assign that needs its assignee, or
 * an incident resolve that also records a Root Cause.
 */
const TaskActionCommentModal: React.FC<TaskActionCommentModalProps> = ({
  open,
  title,
  actionLabel,
  subtitle,
  requiredMessage,
  commentLabel,
  showComment = true,
  showRootCause = false,
  showAssignee = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [rootCause, setRootCause] = useState<string>();
  const [assignee, setAssignee] = useState<EntityReference>();
  // Submit is disabled until every required field is filled, so a hint only
  // surfaces for a field already touched and left empty.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setComment('');
      setRootCause(undefined);
      setAssignee(undefined);
      setTouched({});
    }
  }, [open]);

  const {
    isCommentMissing,
    isRootCauseMissing,
    isAssigneeMissing,
    isIncomplete,
  } = useMemo(() => {
    const commentMissing =
      showComment && Boolean(requiredMessage) && !comment.trim();
    const rootCauseMissing = showRootCause && !rootCause;
    const assigneeMissing = showAssignee && !assignee;

    return {
      isCommentMissing: commentMissing,
      isRootCauseMissing: rootCauseMissing,
      isAssigneeMissing: assigneeMissing,
      isIncomplete: commentMissing || rootCauseMissing || assigneeMissing,
    };
  }, [
    showComment,
    requiredMessage,
    comment,
    showRootCause,
    rootCause,
    showAssignee,
    assignee,
  ]);

  const handleClose = useCallback(() => {
    if (!isLoading) {
      onCancel();
    }
  }, [isLoading, onCancel]);

  // The assignee picker's listbox is a portalled popover, so a press inside this
  // dialog never counts as an outside press and the list would stay open. Blur
  // the picker instead — react-aria closes the combobox on blur.
  const dismissOpenPicker = useCallback((event: React.PointerEvent) => {
    const picker = dialogRef.current?.querySelector(
      '[data-testid="task-action-assignee"]'
    );
    const active = document.activeElement as HTMLElement | null;
    if (
      picker &&
      active &&
      picker.contains(active) &&
      !picker.contains(event.target as Node)
    ) {
      active.blur();
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (isIncomplete) {
      return;
    }
    onConfirm({ comment: comment.trim(), rootCause, assignee });
  }, [isIncomplete, comment, rootCause, assignee, onConfirm]);

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <Modal>
        <Dialog showCloseButton width={512} onClose={handleClose}>
          <div ref={dialogRef} onPointerDownCapture={dismissOpenPicker}>
            <Dialog.Header>
              {/* min-w-0 all the way down, so a long subtitle truncates inside
                the dialog instead of stretching past its edge. */}
              <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
                <Typography size="text-lg" weight="semibold">
                  {title}
                </Typography>
                {subtitle && (
                  <div
                    className="tw:min-w-0 tw:overflow-hidden"
                    data-testid="task-action-subtitle">
                    {subtitle}
                  </div>
                )}
              </div>
            </Dialog.Header>

            <Dialog.Content>
              <div className="tw:flex tw:flex-col tw:gap-4">
                <TaskAssigneeField
                  isLoading={isLoading}
                  isMissing={isAssigneeMissing}
                  selected={assignee}
                  show={showAssignee}
                  t={t}
                  touched={Boolean(touched.assignee)}
                  onChange={(next) => {
                    setTouched((prev) => ({ ...prev, assignee: true }));
                    setAssignee(next);
                  }}
                />
                <TaskRootCauseField
                  isLoading={isLoading}
                  isMissing={isRootCauseMissing}
                  rootCause={rootCause}
                  show={showRootCause}
                  t={t}
                  touched={Boolean(touched.rootCause)}
                  onChange={(next) => {
                    setTouched((prev) => ({ ...prev, rootCause: true }));
                    setRootCause(next);
                  }}
                />
                <TaskCommentField
                  comment={comment}
                  commentLabel={commentLabel}
                  isLoading={isLoading}
                  isMissing={isCommentMissing}
                  requiredMessage={requiredMessage}
                  show={showComment}
                  t={t}
                  touched={Boolean(touched.comment)}
                  onChange={(next) => {
                    setTouched((prev) => ({ ...prev, comment: true }));
                    setComment(next);
                  }}
                />
              </div>
            </Dialog.Content>

            <div className="tw:flex tw:items-center tw:justify-end tw:gap-3 tw:p-6 tw:pb-4">
              <Button
                color="secondary"
                data-testid="task-action-comment-cancel"
                isDisabled={isLoading}
                size="md"
                onPress={handleClose}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="task-action-comment-confirm"
                isDisabled={isIncomplete}
                isLoading={isLoading}
                size="md"
                onPress={handleConfirm}>
                {actionLabel}
              </Button>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default TaskActionCommentModal;
