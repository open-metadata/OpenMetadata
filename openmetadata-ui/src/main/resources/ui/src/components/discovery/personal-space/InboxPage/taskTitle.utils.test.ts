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

import { TFunction } from 'i18next';
import { Task } from '../../../../generated/entity/tasks/task';
import { getTaskTitle } from './taskTitle.utils';

const TASK_ID = 'TASK-19665';

// Only the keys en-us actually defines are translated; anything else echoes the
// key back, which is what i18next does for a missing key.
const MESSAGES: Record<string, string> = {
  'message.request-approval-message': 'Approval request for',
  'message.data-access-request-message': 'Data access request for',
};
const t = ((key: string) => MESSAGES[key] ?? key) as unknown as TFunction;

const task = (overrides: Partial<Task> = {}): Task =>
  ({
    taskId: TASK_ID,
    name: TASK_ID,
    type: 'RequestApproval',
    description: 'Approval required for crm_customers',
    about: {
      id: 'e1',
      type: 'table',
      name: 'crm_customers',
      displayName: 'CRM Customers',
    },
    ...overrides,
  } as unknown as Task);

describe('getTaskTitle', () => {
  it('prefers the display name', () => {
    expect(
      getTaskTitle(
        task({ displayName: 'Approve Revenue', name: 'raw-name' }),
        t
      )
    ).toBe('Approve Revenue');
  });

  it('falls back to the name when there is no display name', () => {
    expect(getTaskTitle(task({ name: 'raw-name' }), t)).toBe('raw-name');
  });

  it('keeps a name that only resembles the taskId', () => {
    expect(getTaskTitle(task({ name: `${TASK_ID} follow-up` }), t)).toBe(
      `${TASK_ID} follow-up`
    );
  });

  it('composes type + entity when the name is the taskId default', () => {
    expect(getTaskTitle(task(), t)).toBe('Approval request for CRM Customers');
  });

  it('composes type + entity when the display name is the taskId too', () => {
    expect(getTaskTitle(task({ displayName: TASK_ID }), t)).toBe(
      'Approval request for CRM Customers'
    );
  });

  it('composes from the entity name when it has no display name', () => {
    expect(
      getTaskTitle(
        task({
          type: 'DataAccessRequest',
          about: { id: 'e1', type: 'table', name: 'orders' },
        } as Partial<Task>),
        t
      )
    ).toBe('Data access request for orders');
  });

  it('falls back to the description when the task has no about entity', () => {
    expect(getTaskTitle(task({ about: undefined }), t)).toBe(
      'Approval required for crm_customers'
    );
  });

  it('never renders a missing message key, falling back to the description', () => {
    expect(getTaskTitle(task({ type: 'TierUpdate' } as Partial<Task>), t)).toBe(
      'Approval required for crm_customers'
    );
  });

  it('falls back to the task id when nothing else is available', () => {
    expect(
      getTaskTitle(task({ about: undefined, description: undefined }), t)
    ).toBe(TASK_ID);
  });

  it('keeps the name when the task has no taskId', () => {
    expect(getTaskTitle({ name: 'raw-name' } as Task, t)).toBe('raw-name');
  });
});
