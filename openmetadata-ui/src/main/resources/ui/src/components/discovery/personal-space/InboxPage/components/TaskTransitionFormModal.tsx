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
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Task,
  TaskAvailableTransition,
} from '../../../../../generated/entity/tasks/task';
import { TaskFormSchema } from '../../../../../rest/taskFormSchemasAPI';
import { TaskPayload } from '../../../../../rest/tasksAPI';
import { isDescriptionContentEmpty } from '../../../../../utils/BlockEditorPureUtils';
import {
  applyTaskFormSchemaDefaults,
  getEditableTaskPayload,
  getTaskTransitionFormSchema,
  getTaskTransitionUiSchema,
} from '../../../../../utils/TaskFormSchemaUtils';
import Loader from '../../../../common/Loader/Loader';

const TaskPayloadSchemaFields = lazy(
  () => import('../../../../../pages/TasksPage/shared/TaskPayloadSchemaFields')
);

export interface TaskTransitionFormModalProps {
  open: boolean;
  title: string;
  actionLabel: string;
  task: Task;
  schema?: TaskFormSchema;
  transition?: TaskAvailableTransition;
  isLoading?: boolean;
  onConfirm: (payload: TaskPayload) => void;
  onCancel: () => void;
}

/**
 * The form modal the inbox opens for a workflow transition whose
 * `transitionForms` schema declares required fields (e.g. a custom task's
 * `approve` requiring `targetField`/`proposedText`). It mirrors
 * `TaskTabNew`'s edit-task modal: the same `TaskPayloadSchemaFields` form,
 * seeded from the task payload + the transition's schema defaults, and the
 * same `required`-field guard `onEditAndSuggest` enforces before submit.
 *
 * It takes precedence over the comment modal (`TaskActionCommentModal`) for
 * any transition with required form fields, except an incident's root cause,
 * so a transition needing both a comment and other fields loses neither.
 */
const TaskTransitionFormModal: React.FC<TaskTransitionFormModalProps> = ({
  open,
  title,
  actionLabel,
  task,
  schema,
  transition,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  const transitionFormSchema = useMemo(
    () => getTaskTransitionFormSchema(schema, transition),
    [schema, transition]
  );
  const transitionUiSchema = useMemo(
    () => getTaskTransitionUiSchema(schema, transition),
    [schema, transition]
  );

  // Seed the form the way `TaskTabNew` does: the task's editable payload for
  // this transition's uiSchema, merged with the schema's property defaults so
  // fields with a `default` start populated.
  const initialPayload = useMemo(
    () =>
      applyTaskFormSchemaDefaults(
        getEditableTaskPayload(task, transitionUiSchema),
        transitionFormSchema
      ),
    [task, transitionFormSchema, transitionUiSchema]
  );

  const [payload, setPayload] = useState<TaskPayload>(initialPayload);

  // Reset the draft each time the modal opens (or the transition it is for
  // changes), so a reopened modal never carries the previous attempt's edits.
  useEffect(() => {
    if (open) {
      setPayload(initialPayload);
    }
  }, [open, initialPayload]);

  // A field is "missing" only when it is absent, null, or an empty string —
  // not when it is a valid falsy value. `!payload?.[field]` would treat `false`
  // (a required boolean) and `0` (a required number) as unfilled and keep the
  // confirm button disabled, so the resolver could never submit a legitimate
  // `false`/`0` answer.
  const isMissingRequired = useMemo(() => {
    const requiredFields = transitionFormSchema?.required;
    const isFieldMissing =
      Array.isArray(requiredFields) &&
      requiredFields.some((field) => {
        if (typeof field !== 'string') {
          return true;
        }
        const value = payload?.[field];

        return value === undefined || value === null || value === '';
      });
    // `requiresComment` adds an optional `comment` field; the server still
    // rejects the transition without one.
    const isCommentMissing =
      Boolean(transition?.requiresComment) &&
      isDescriptionContentEmpty(
        typeof payload?.comment === 'string' ? payload.comment : ''
      );

    return isFieldMissing || isCommentMissing;
  }, [transitionFormSchema, transition, payload]);

  const handleConfirm = () => {
    if (isLoading || isMissingRequired) {
      return;
    }
    onConfirm(payload);
  };

  const handleClose = () => {
    if (!isLoading) {
      onCancel();
    }
  };

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="task-transition-form-modal"
          dividers="scroll"
          title={title}
          width={768}
          onClose={handleClose}>
          <Suspense fallback={<Loader />}>
            <Dialog.Content>
              <TaskPayloadSchemaFields
                payload={payload}
                schema={transitionFormSchema}
                uiSchema={transitionUiSchema}
                onChange={setPayload}
              />
              {isMissingRequired && (
                <Typography
                  color="danger"
                  data-testid="task-transition-form-required-hint"
                  size="text-sm">
                  {t('message.field-text-is-required', {
                    fieldText: t('label.required-field-plural'),
                  })}
                </Typography>
              )}
            </Dialog.Content>
            <Dialog.Footer>
              <Button
                color="secondary"
                data-testid="task-transition-form-cancel"
                isDisabled={isLoading}
                onPress={handleClose}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="task-transition-form-confirm"
                isDisabled={isMissingRequired}
                isLoading={isLoading}
                onPress={handleConfirm}>
                {actionLabel}
              </Button>
            </Dialog.Footer>
          </Suspense>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default TaskTransitionFormModal;
