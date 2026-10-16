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
import { TaskEntityType, type Task as TaskEntity } from '../rest/tasksAPI';
import { getNormalizedTaskPayload } from './TaskPayloadUtils';

const buildTask = (
  type: TaskEntityType,
  payload: Record<string, unknown>
): TaskEntity => ({ type, payload } as unknown as TaskEntity);

describe('getNormalizedTaskPayload suggestedValue branch', () => {
  it('serializes the suggested tags for a tag task with tags', () => {
    const suggestedTags = [{ tagFQN: 'PII.Sensitive' }];
    const result = getNormalizedTaskPayload(
      buildTask(TaskEntityType.TagUpdate, { tagsToAdd: suggestedTags })
    );

    expect(result.suggestedValue).toBe(JSON.stringify(suggestedTags));
    expect(result.isSuggestionEmpty).toBe(false);
  });

  it('returns an undefined suggested value for a tag task with no tags', () => {
    const result = getNormalizedTaskPayload(
      buildTask(TaskEntityType.TagUpdate, {})
    );

    expect(result.suggestedValue).toBeUndefined();
    expect(result.isSuggestionEmpty).toBe(true);
  });

  it('uses the new description for a non-tag task', () => {
    const result = getNormalizedTaskPayload(
      buildTask(TaskEntityType.DescriptionUpdate, {
        newDescription: 'updated description',
      })
    );

    expect(result.suggestedValue).toBe('updated description');
    expect(result.isSuggestionEmpty).toBe(false);
  });
});

describe('TagUpdate remove-all-tags suggestion', () => {
  it('flags a remove-all-tags task as a NON-empty suggestion', () => {
    const currentTags = [
      { tagFQN: 'PII.Sensitive' },
      { tagFQN: 'PersonalData.Personal' },
    ];

    const result = getNormalizedTaskPayload(
      buildTask(TaskEntityType.TagUpdate, {
        fieldPath: 'columns.email.tags',
        currentTags,
        tagsToRemove: currentTags,
        tagsToAdd: [],
        operation: 'Replace',
      })
    );

    expect(result.suggestedTags).toEqual([]);
    expect(result.suggestedValue).toBe('[]');
    expect(result.isSuggestionEmpty).toBe(false);
  });

  it('preserves currentTags-only no-op rendering as a non-empty suggestion', () => {
    const result = getNormalizedTaskPayload(
      buildTask(TaskEntityType.TagUpdate, {
        fieldPath: 'columns.email.tags',
        currentTags: [{ tagFQN: 'PII.Sensitive' }],
        tagsToAdd: [],
        tagsToRemove: [],
        operation: 'Replace',
      })
    );

    expect(result.suggestedTags).toEqual([{ tagFQN: 'PII.Sensitive' }]);
    expect(result.suggestedValue).toBe(
      JSON.stringify([{ tagFQN: 'PII.Sensitive' }])
    );
    expect(result.isSuggestionEmpty).toBe(false);
  });
});
