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
import { TASK_ENTITY_TYPES } from '../../../../constants/Task.constant';
import { TaskType } from '../../../../generated/entity/tasks/task';
import { MetadataCompletionPayload } from '../../../../generated/type/metadataCompletionPayload';
import { NATIVE_FIELDS_BY_ENTITY_TYPE } from '../../../../pages/IntakeForms/intakeFormFields';
import { Task } from '../../../../rest/tasksAPI';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const EXTENSION_PREFIX = 'extension.';

const FIELD_LABEL_KEYS: Record<string, string> = {
  ...Object.fromEntries(
    Object.values(NATIVE_FIELDS_BY_ENTITY_TYPE)
      .flat()
      .map(({ path, labelKey }) => [path, labelKey])
  ),
  description: 'label.description',
  owners: 'label.owner-plural',
  'metricExpression.code': 'label.expression',
};

/** A required field's name as the asset's page shows it; a custom property keeps its own name. */
export const getRequiredFieldLabel = (path: string, t: Translate): string => {
  const labelKey = FIELD_LABEL_KEYS[path];
  if (labelKey) {
    return t(labelKey);
  }

  return path.startsWith(EXTENSION_PREFIX)
    ? path.slice(EXTENSION_PREFIX.length)
    : path;
};

export const getMetadataCompletionPayload = (
  task: Pick<Task, 'payload'>
): Partial<MetadataCompletionPayload> =>
  (task.payload ?? {}) as Partial<MetadataCompletionPayload>;

/** A Revise and resubmit task: the stage's approval was rejected and the asset is to be revised. */
export const isRevisionTask = (payload: Partial<MetadataCompletionPayload>) =>
  Boolean(payload.revision);

/** A Metadata Completion task asking for a revision; it is completed by editing the asset. */
export const isRevisionRequest = (
  task: Pick<Task, 'payload'> & { type?: string }
) =>
  task.type === TaskType.MetadataCompletion &&
  isRevisionTask(getMetadataCompletionPayload(task));

/** The message key naming a task in titles: a revision names itself, not missing metadata. */
export const getTaskTypeMessageKey = (
  task: Pick<Task, 'payload'> & { type?: string }
): string | undefined =>
  isRevisionRequest(task)
    ? 'message.revise-and-resubmit-message'
    : (TASK_ENTITY_TYPES as Record<string, string>)[task.type ?? ''];

/** What the task asks for, in one sentence naming the stage the asset is leaving. */
export const getMetadataCompletionInstruction = (
  payload: Partial<MetadataCompletionPayload>,
  t: Translate
): string => {
  if (isRevisionTask(payload)) {
    return t('message.metadata-completion-revision', { stage: payload.stage });
  }

  return payload.targetStage
    ? t('message.metadata-completion-move', {
        stage: payload.stage,
        targetStage: payload.targetStage,
      })
    : t('message.metadata-completion-leave', { stage: payload.stage });
};
