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
import {
  getMemoryLinkName,
  getReviewDisputes,
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

    expect(disputes).toEqual([{ memory: { id: 'm-2' }, reason: '' }]);
  });

  it('has no disputes when the payload has none', () => {
    expect(getReviewDisputes(taskWith(undefined))).toEqual([]);
    expect(getReviewDisputes(taskWith({ disputes: 'x' }))).toEqual([]);
  });
});

describe('getMemoryLinkName', () => {
  it('prefers the name, then the fully qualified name', () => {
    expect(getMemoryLinkName({ id: '1', type: 't', name: 'a' })).toBe('a');
    expect(
      getMemoryLinkName({ id: '1', type: 't', fullyQualifiedName: 'b' })
    ).toBe('b');
    expect(getMemoryLinkName(undefined)).toBe('');
  });
});
