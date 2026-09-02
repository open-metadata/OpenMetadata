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
import { diffLines, type Change } from 'diff';
import { isEmpty } from 'lodash';
import type { TagLabel } from '../generated/type/tagLabel';
import { TaskEntityType, type Task as TaskEntity } from '../rest/tasksAPI';

export const getDescriptionDiff = (
  oldValue: string,
  newValue: string
): Change[] => {
  return diffLines(oldValue, newValue);
};

export interface NormalizedTaskPayload {
  fieldPath?: string;
  currentDescription?: string;
  newDescription?: string;
  currentTags: TagLabel[];
  suggestedTags: TagLabel[];
  suggestedValue?: string;
  isSuggestionEmpty: boolean;
}

const parseTaskTags = (value?: string | TagLabel[]): TagLabel[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    return JSON.parse(value) as TagLabel[];
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

  return [
    ...currentTags.filter(
      (tag) => !tagsToRemove.some((item) => item.tagFQN === tag.tagFQN)
    ),
    ...tagsToAdd,
  ];
};

const computeSuggestionState = (
  isTagTask: boolean,
  suggestedTags: TagLabel[],
  newDescription?: string
): { suggestedValue?: string; isSuggestionEmpty: boolean } => {
  if (isTagTask) {
    return {
      suggestedValue:
        suggestedTags.length > 0 ? JSON.stringify(suggestedTags) : undefined,
      isSuggestionEmpty: suggestedTags.length === 0,
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
  const isTagTask = task.type === TaskEntityType.TagUpdate;
  const fieldPath = payload?.fieldPath ?? payload?.field;
  const currentDescription =
    payload?.currentDescription ?? payload?.currentValue;
  const newDescription = payload?.newDescription ?? payload?.suggestedValue;

  const currentTags = parseTaskTags(
    payload?.currentTags ?? (payload?.currentValue as string | undefined)
  );
  const tagsToAdd = parseTaskTags(payload?.tagsToAdd as TagLabel[] | undefined);
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

  const { suggestedValue, isSuggestionEmpty } = computeSuggestionState(
    isTagTask,
    suggestedTags,
    newDescription
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
