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

/** What the task asks for, in one sentence naming the stage the asset is leaving. */
export const getMetadataCompletionInstruction = (
  payload: Partial<MetadataCompletionPayload>,
  t: Translate
): string =>
  payload.targetStage
    ? t('message.metadata-completion-move', {
        stage: payload.stage,
        targetStage: payload.targetStage,
      })
    : t('message.metadata-completion-leave', { stage: payload.stage });
