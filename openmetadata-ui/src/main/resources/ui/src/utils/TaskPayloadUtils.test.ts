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
import type { TagLabel } from '../generated/type/tagLabel';
import { TaskEntityType, type Task as TaskEntity } from '../rest/tasksAPI';
import { diffTagLabels, getNormalizedTaskPayload } from './TaskPayloadUtils';

const buildTask = (
  type: TaskEntityType,
  payload: Record<string, unknown>
): TaskEntity => ({ type, payload } as unknown as TaskEntity);

describe('Suggestion task with suggestionType Tag', () => {
  const tags = [{ tagFQN: 'Data Sensitivity.Confidential' }];

  it('reads the tags from suggestedValue instead of a description', () => {
    const result = getNormalizedTaskPayload(
      buildTask(TaskEntityType.Suggestion, {
        suggestionType: 'Tag',
        suggestedValue: JSON.stringify(tags),
      })
    );

    expect(result.suggestedTags).toEqual(tags);
    expect(result.newDescription).toBeUndefined();
    expect(result.isSuggestionEmpty).toBe(false);
  });

  // The server adds a Tag suggestion to the field's tags, so existing tags
  // stay and the suggested ones are what is new.
  it('adds the suggested tags to the current ones instead of dropping them', () => {
    const existing = { tagFQN: 'Tier.Tier1' };
    const result = getNormalizedTaskPayload(
      buildTask(TaskEntityType.Suggestion, {
        suggestionType: 'Tag',
        currentValue: JSON.stringify([existing]),
        suggestedValue: JSON.stringify(tags),
      })
    );

    expect(result.currentTags).toEqual([existing]);
    expect(result.suggestedTags).toEqual([existing, ...tags]);
  });

  it('keeps a description suggestion on the description path', () => {
    const result = getNormalizedTaskPayload(
      buildTask(TaskEntityType.Suggestion, {
        suggestionType: 'Description',
        suggestedValue: 'A customer address',
      })
    );

    expect(result.newDescription).toBe('A customer address');
    expect(result.suggestedValue).toBe('A customer address');
  });
});

describe('diffTagLabels', () => {
  it('matches tags by tagFQN, so an unchanged tag is neither removed nor added', () => {
    const diff = diffTagLabels(
      [{ tagFQN: 'Tier.Tier1' }] as TagLabel[],
      [{ tagFQN: 'Tier.Tier1' }, { tagFQN: 'PII.Sensitive' }] as TagLabel[]
    );

    expect(diff.filter((part) => part.removed)).toEqual([]);
    expect(
      diff.filter((part) => part.added).flatMap((part) => part.value)
    ).toEqual([{ tagFQN: 'PII.Sensitive' }]);
  });
});
