/*
 *  Copyright 2022 Collate.
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
import { diffArrays, diffLines, type Change } from 'diff';
import { isEmpty, uniqBy } from 'lodash';
import type { TagLabel } from '../generated/type/tagLabel';
import { TaskEntityType, type Task as TaskEntity } from '../rest/tasksAPI';
import { isTagsTaskType } from './TaskActionUtils';

export const getDescriptionDiff = (
  oldValue: string,
  newValue: string
): Change[] => {
  return diffLines(oldValue, newValue);
};

// Parsed tag labels are fresh objects, so compare them by tagFQN, not identity.
export const diffTagLabels = (
  currentTags: TagLabel[],
  suggestedTags: TagLabel[]
) =>
  diffArrays(currentTags, suggestedTags, {
    comparator: (left, right) => left.tagFQN === right.tagFQN,
  });

export interface NormalizedTaskPayload {
  fieldPath?: string;
  currentDescription?: string;
  newDescription?: string;
  currentTags: TagLabel[];
  suggestedTags: TagLabel[];
  suggestedValue?: string;
  isSuggestionEmpty: boolean;
}

export const parseTaskTags = (value?: string | TagLabel[]): TagLabel[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) ? (parsed as TagLabel[]) : [];
  } catch {
    return [];
  }
};

const computeSuggestedTags = (
  currentTags: TagLabel[],
  tagsToAdd: TagLabel[],
  tagsToRemove: TagLabel[],
  suggestedTagsFromLegacyPayload: TagLabel[]
): TagLabel[] => {
  const hasTagChanges =
    tagsToAdd.length > 0 || tagsToRemove.length > 0 || currentTags.length > 0;

  if (!hasTagChanges) {
    return suggestedTagsFromLegacyPayload;
  }

  return uniqBy(
    [
      ...currentTags.filter(
        (tag) => !tagsToRemove.some((item) => item.tagFQN === tag.tagFQN)
      ),
      ...tagsToAdd,
    ],
    'tagFQN'
  );
};

const computeSuggestionState = (
  isTagTask: boolean,
  suggestedTags: TagLabel[],
  newDescription?: string,
  hasTagOperation = false
): { suggestedValue?: string; isSuggestionEmpty: boolean } => {
  if (isTagTask) {
    return {
      suggestedValue:
        suggestedTags.length > 0 || hasTagOperation
          ? JSON.stringify(suggestedTags)
          : undefined,
      isSuggestionEmpty: suggestedTags.length === 0 && !hasTagOperation,
    };
  }

  return {
    suggestedValue: newDescription,
    isSuggestionEmpty: isEmpty(newDescription),
  };
};

export const getNormalizedTaskPayload = (
  task: TaskEntity
): NormalizedTaskPayload => {
  const payload = task.payload;
  const isTagTaskType = isTagsTaskType(task);
  const fieldPath = payload?.fieldPath;
  const currentDescription =
    payload?.currentDescription ?? payload?.currentValue;
  const newDescription = isTagTaskType
    ? undefined
    : payload?.newDescription ?? payload?.suggestedValue;

  const currentTags = parseTaskTags(
    payload?.currentTags ?? (payload?.currentValue as string | undefined)
  );
  // The server adds a Tag suggestion's tags to the field's current ones.
  const tagsToAdd = parseTaskTags(
    isTagTaskType && task.type === TaskEntityType.Suggestion
      ? payload?.suggestedValue
      : (payload?.tagsToAdd as TagLabel[] | undefined)
  );
  const tagsToRemove = parseTaskTags(
    payload?.tagsToRemove as TagLabel[] | undefined
  );
  const suggestedTagsFromLegacyPayload = parseTaskTags(payload?.suggestedValue);

  const suggestedTags = computeSuggestedTags(
    currentTags,
    tagsToAdd,
    tagsToRemove,
    suggestedTagsFromLegacyPayload
  );

  const hasTagOperation =
    tagsToAdd.length > 0 ||
    tagsToRemove.length > 0 ||
    suggestedTagsFromLegacyPayload.length > 0;

  const { suggestedValue, isSuggestionEmpty } = computeSuggestionState(
    isTagTaskType,
    suggestedTags,
    newDescription,
    isTagTaskType && hasTagOperation
  );

  return {
    fieldPath,
    currentDescription,
    newDescription,
    currentTags,
    suggestedTags,
    suggestedValue,
    isSuggestionEmpty,
  };
};
