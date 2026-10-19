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

import { Task, TaskCategory } from '../generated/entity/tasks/task';
import {
  countMyTaskBuckets,
  filterMyTasks,
  getBulkTaskAction,
  MyTaskBucket,
} from './myTaskBuckets';

const task = (id: string, category: TaskCategory) => ({ category, id } as Task);

const INCIDENT = task('i1', TaskCategory.Incident);
const ACCESS = task('a1', TaskCategory.DataAccess);
const APPROVAL = task('p1', TaskCategory.Approval);
const REVIEW = task('r1', TaskCategory.Review);
const METADATA = task('m1', TaskCategory.MetadataUpdate);
const CUSTOM = task('c1', TaskCategory.Custom);

describe('myTaskBuckets', () => {
  it('counts each bucket over the loaded tasks and takes All from the server', () => {
    expect(
      countMyTaskBuckets(
        [INCIDENT, ACCESS, APPROVAL, REVIEW, METADATA, CUSTOM],
        40
      )
    ).toEqual({
      [MyTaskBucket.ALL]: 40,
      [MyTaskBucket.INCIDENTS]: 1,
      [MyTaskBucket.ACCESS]: 1,
      [MyTaskBucket.APPROVALS]: 3,
    });
  });

  // Custom tasks have no chip of their own, so only All may show them.
  it('shows custom tasks under All only', () => {
    const tasks = [CUSTOM, APPROVAL];

    expect(filterMyTasks(tasks, MyTaskBucket.ALL)).toEqual(tasks);
    expect(filterMyTasks(tasks, MyTaskBucket.APPROVALS)).toEqual([APPROVAL]);
  });

  it('offers Grant and Deny for a selection of access requests only', () => {
    expect(getBulkTaskAction([ACCESS])).toEqual({
      approveLabelKey: 'label.grant',
      kind: 'resolve',
      rejectLabelKey: 'label.deny',
    });
  });

  it('offers Approve and Reject once approvals are in the selection', () => {
    expect(getBulkTaskAction([ACCESS, APPROVAL, REVIEW])).toEqual({
      approveLabelKey: 'label.approve',
      kind: 'resolve',
      rejectLabelKey: 'label.reject',
    });
  });

  // An incident needs a root cause and a custom task its form, so neither may
  // be resolved blind from the card.
  it.each([
    ['an incident', [APPROVAL, INCIDENT]],
    ['a custom task', [ACCESS, CUSTOM]],
    ['nothing', []],
  ])(
    'sends the viewer to the tasks page when the selection holds %s',
    (_, tasks) => {
      expect(getBulkTaskAction(tasks)).toEqual({ kind: 'open' });
    }
  );
});
