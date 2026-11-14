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
  ContextMemory,
  ContextMemoryStatus,
} from '../../../../generated/entity/context/contextMemory';
import { Task } from '../../../../generated/entity/tasks/task';
import {
  getClaimUpdatedAt,
  getConflictRecency,
  getDisputeReason,
  getReviewDisputes,
  withMemoryTitle,
} from './MemoryConflictReviews.utils';

const reference = (id: string) => ({ id, type: 'contextMemory', name: id });

const memory = (id: string, claimUpdatedAt?: number, updatedAt = 1) =>
  ({
    id,
    name: id,
    title: `Title of ${id}`,
    updatedAt,
    lastContentUpdatedAt: claimUpdatedAt,
    entityStatus: ContextMemoryStatus.Approved,
  } as ContextMemory);

describe('getReviewDisputes', () => {
  it('reads each disputed memory and when the conflict was detected', () => {
    const task = {
      payload: {
        disputes: [{ memory: reference('five'), detectedAt: 10 }],
      },
    } as unknown as Task;

    expect(getReviewDisputes(task)).toEqual([
      { memory: reference('five'), detectedAt: 10 },
    ]);
  });

  it('skips malformed entries and tolerates a missing payload', () => {
    const task = {
      payload: {
        disputes: [null, { memory: {} }, { reason: 'x' }, 'five'],
      },
    } as unknown as Task;

    expect(getReviewDisputes(task)).toEqual([]);
    expect(getReviewDisputes({} as Task)).toEqual([]);
  });
});

describe('getClaimUpdatedAt', () => {
  it('dates the claim by its content, falling back to the last write', () => {
    expect(getClaimUpdatedAt(memory('a', 5, 9))).toBe(5);
    expect(getClaimUpdatedAt(memory('a', undefined, 9))).toBe(9);
    expect(getClaimUpdatedAt(undefined)).toBeUndefined();
  });
});

describe('getConflictRecency', () => {
  it('marks the memory in review newer than every older claim', () => {
    const recency = getConflictRecency(memory('reviewed', 200), [
      memory('a', 100),
      memory('b', 150),
    ]);

    expect(recency).toEqual({
      reviewed: 'newer',
      disputed: { a: 'older', b: 'older' },
    });
  });

  it('marks the memory in review older when every claim it contradicts is newer', () => {
    expect(
      getConflictRecency(memory('reviewed', 100), [memory('a', 200)]).reviewed
    ).toBe('older');
  });

  it('says nothing about the reviewed side when the claims disagree or tie', () => {
    const mixed = getConflictRecency(memory('reviewed', 150), [
      memory('a', 100),
      memory('b', 200),
    ]);
    const tied = getConflictRecency(memory('reviewed', 100), [
      memory('a', 100),
    ]);

    expect(mixed.reviewed).toBeUndefined();
    expect(mixed.disputed).toEqual({ a: 'older', b: 'newer' });
    expect(tied).toEqual({ disputed: {} });
  });

  it('says nothing until the memory in review is loaded', () => {
    expect(getConflictRecency(undefined, [memory('a', 100)])).toEqual({
      disputed: {},
    });
  });
});

describe('getDisputeReason', () => {
  it('reads why they conflict from the memory in review', () => {
    const reviewed = {
      ...memory('reviewed'),
      disputes: [{ memory: reference('five'), reason: 'Five against three' }],
    } as ContextMemory;

    expect(getDisputeReason(reviewed, 'five')).toBe('Five against three');
    expect(getDisputeReason(reviewed, 'other')).toBeUndefined();
    expect(getDisputeReason(undefined, 'five')).toBeUndefined();
  });
});

describe('withMemoryTitle', () => {
  const review = {
    id: 'task-1',
    about: reference('chat-3a9c'),
  } as unknown as Task;

  it('names the memory a review is about by its title', () => {
    expect(withMemoryTitle(review, memory('chat-3a9c')).about).toEqual(
      expect.objectContaining({ displayName: 'Title of chat-3a9c' })
    );
  });

  it('keeps the review as it is until the memory is read', () => {
    expect(withMemoryTitle(review, undefined)).toBe(review);
  });
});
