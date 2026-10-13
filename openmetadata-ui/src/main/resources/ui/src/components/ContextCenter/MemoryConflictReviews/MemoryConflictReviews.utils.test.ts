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
import { Task } from '../../../generated/entity/tasks/task';
import { MemoryConflictReviewDispute } from './MemoryConflictReviews.types';
import {
  getConflictRecency,
  getReviewDisputes,
  getReviewedClaim,
  getReviewedMemoryTitle,
  withMemoryTitle,
} from './MemoryConflictReviews.utils';

const taskWith = (payload: unknown) =>
  ({ id: 'task-1', payload } as unknown as Task);

describe('getReviewDisputes', () => {
  it('reads each disputed memory and its reason', () => {
    const disputes = getReviewDisputes(
      taskWith({
        disputes: [
          { memory: { id: 'm-1', name: 'five-orders' }, reason: 'Disagree' },
        ],
      })
    );

    expect(disputes).toEqual([
      { memory: { id: 'm-1', name: 'five-orders' }, reason: 'Disagree' },
    ]);
  });

  it('reads the claim recorded for each disputed memory', () => {
    const [dispute] = getReviewDisputes(
      taskWith({
        disputes: [
          {
            memory: { id: 'm-1' },
            reason: 'Disagree',
            claim: { id: 'm-1', answer: 'Five orders.' },
          },
        ],
      })
    );

    expect(dispute.claim).toEqual({ id: 'm-1', answer: 'Five orders.' });
  });

  it('skips malformed entries and keeps a dispute without a reason', () => {
    const disputes = getReviewDisputes(
      taskWith({
        disputes: [
          null,
          { reason: 'no memory' },
          { memory: { name: 'no-id' } },
          { memory: { id: 'm-2' } },
        ],
      })
    );

    expect(disputes).toEqual([
      { memory: { id: 'm-2' }, reason: '', claim: undefined },
    ]);
  });

  it('has no disputes when the payload has none', () => {
    expect(getReviewDisputes(taskWith(undefined))).toEqual([]);
    expect(getReviewDisputes(taskWith({ disputes: 'x' }))).toEqual([]);
  });
});

describe('getReviewedMemoryTitle', () => {
  it('reads the title the server recorded on the task', () => {
    expect(
      getReviewedMemoryTitle(
        taskWith({ memoryTitle: 'Customers need three orders' })
      )
    ).toBe('Customers need three orders');
  });

  it('has no title when the task records none', () => {
    expect(getReviewedMemoryTitle(taskWith(undefined))).toBeUndefined();
    expect(
      getReviewedMemoryTitle(taskWith({ memoryTitle: '  ' }))
    ).toBeUndefined();
    expect(
      getReviewedMemoryTitle(taskWith({ memoryTitle: 3 }))
    ).toBeUndefined();
  });
});

describe('getReviewedClaim', () => {
  it('reads the claim of the memory in review', () => {
    expect(
      getReviewedClaim(taskWith({ claim: { id: 'm-3', answer: 'Three.' } }))
    ).toEqual({ id: 'm-3', answer: 'Three.' });
  });

  it('has no claim when the task records none', () => {
    expect(getReviewedClaim(taskWith({}))).toBeUndefined();
    expect(
      getReviewedClaim(taskWith({ claim: { answer: 'x' } }))
    ).toBeUndefined();
  });
});

describe('getConflictRecency', () => {
  const disputeAt = (
    id: string,
    contentUpdatedAt?: number
  ): MemoryConflictReviewDispute => ({
    memory: { id, type: 'contextMemory' },
    reason: '',
    claim: { id, contentUpdatedAt },
  });

  it('marks the memory in review newer than every claim it contradicts', () => {
    expect(
      getConflictRecency({ id: 'r', contentUpdatedAt: 300 }, [
        disputeAt('a', 100),
        disputeAt('b', 200),
      ])
    ).toEqual({ reviewed: 'newer', disputed: { a: 'older', b: 'older' } });
  });

  it('marks a revalidated memory older than the claim that replaced it', () => {
    expect(
      getConflictRecency({ id: 'r', contentUpdatedAt: 100 }, [
        disputeAt('a', 300),
      ])
    ).toEqual({ reviewed: 'older', disputed: { a: 'newer' } });
  });

  it('labels no side when the order is mixed or unknown', () => {
    expect(
      getConflictRecency({ id: 'r', contentUpdatedAt: 200 }, [
        disputeAt('a', 100),
        disputeAt('b', 300),
      ])
    ).toEqual({ disputed: { a: 'older', b: 'newer' } });
    expect(getConflictRecency(undefined, [disputeAt('a', 100)])).toEqual({
      disputed: {},
    });
    expect(
      getConflictRecency({ id: 'r', contentUpdatedAt: 200 }, [disputeAt('a')])
    ).toEqual({ disputed: {} });
  });
});

describe('withMemoryTitle', () => {
  it('names the memory a review is about by its title', () => {
    const review = {
      ...taskWith({ memoryTitle: 'Customers need three orders' }),
      about: { id: 'm-3', type: 'contextMemory', name: 'chat-3a9c' },
    } as Task;

    expect(withMemoryTitle(review).about?.displayName).toBe(
      'Customers need three orders'
    );
    expect(review.about?.displayName).toBeUndefined();
  });

  it('leaves a review without a recorded title as it is', () => {
    const review = taskWith({});

    expect(withMemoryTitle(review)).toBe(review);
  });
});
