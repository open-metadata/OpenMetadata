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
import {
  getTaskTitle,
  getTaskTitleParts,
  splitTaskTitleSearch,
} from './taskTitle.utils';

const TASK_ID = 'TASK-19665';

// Only the keys en-us actually defines are translated; anything else echoes the
// key back, which is what i18next does for a missing key.
const MESSAGES: Record<string, string> = {
  'message.request-approval-message': 'Approval request for',
  'message.data-access-request-message': 'Data access request for',
  'message.request-test-case-failure-resolution-message':
    'Request TestCase Failure Resolution for',
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

  // The server writes incident titles itself, from a test case display name
  // that is usually unset ("Test Case Incident - null").
  it('composes an incident title instead of the server-written one', () => {
    expect(
      getTaskTitle(
        task({
          type: 'TestCaseResolution',
          category: 'Incident',
          displayName: 'Test Case Incident - null',
          about: { id: 't1', type: 'testCase', name: 'orders_rows' },
        } as Partial<Task>),
        t
      )
    ).toBe('Request TestCase Failure Resolution for orders_rows');
  });

  it('names the test case of an incident that has no about entity', () => {
    expect(
      getTaskTitle(
        task({
          type: 'TestCaseResolution',
          category: 'Incident',
          about: undefined,
          description:
            'New incident for test case: svc.db.sch.orders.orders_rows',
        } as Partial<Task>),
        t
      )
    ).toBe('Request TestCase Failure Resolution for orders_rows');
  });

  // The asset type is drawn as a badge beside a composed title, not in it.
  it('returns the asset type of a composed title apart from its text', () => {
    expect(getTaskTitleParts(task(), t)).toEqual({
      title: 'Approval request for CRM Customers',
      entityType: 'table',
    });
  });

  it('carries no asset type for a title someone wrote', () => {
    expect(
      getTaskTitleParts(task({ displayName: 'Access to Sales Table' }), t)
    ).toEqual({ title: 'Access to Sales Table' });
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

  // A workflow's first save runs the description through the server's HTML
  // sanitizer, which stores "yesterday's" as "yesterday&#39;s".
  it('shows a description title as text, decoding what the server encoded', () => {
    expect(
      getTaskTitle(
        task({
          about: undefined,
          description:
            '<p>Dashboards show yesterday&#39;s numbers &amp; totals</p>',
        }),
        t
      )
    ).toBe("Dashboards show yesterday's numbers & totals");
  });

  it('joins a multi-paragraph description into one title line', () => {
    expect(
      getTaskTitle(
        task({
          about: undefined,
          description: '<p>Need access for Q3.</p><p>Owner approved.</p>',
        }),
        t
      )
    ).toBe('Need access for Q3. Owner approved.');
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

describe('splitTaskTitleSearch', () => {
  // The composed title's type words are not stored anywhere the server sees.
  it('reads a search that opens with a type title as that type', () => {
    expect(splitTaskTitleSearch('Request TestCase', t)).toEqual({
      types: ['TestCaseResolution'],
      text: '',
    });
  });

  it('sends the words after the type title to the server', () => {
    expect(
      splitTaskTitleSearch(
        'request testcase failure resolution for orders_row_count',
        t
      )
    ).toEqual({ types: ['TestCaseResolution'], text: 'orders_row_count' });
  });

  it('takes a half-typed last word as the start of the title word', () => {
    expect(splitTaskTitleSearch('Data access req', t)).toEqual({
      types: ['DataAccessRequest'],
      text: '',
    });
  });

  // Two types share the approval title, so both are meant.
  it('names every type that shares the title', () => {
    expect(splitTaskTitleSearch('approval request', t).types).toEqual([
      'GlossaryApproval',
      'RequestApproval',
    ]);
  });

  // One word ("Request") is too common to read as a type.
  it('leaves a single matching word as plain text', () => {
    expect(splitTaskTitleSearch('Request', t)).toEqual({
      types: [],
      text: 'Request',
    });
  });

  it('leaves a search that names no type as plain text', () => {
    expect(splitTaskTitleSearch('  orders_row_count  ', t)).toEqual({
      types: [],
      text: 'orders_row_count',
    });
  });

  // A missing translation echoes its key, which is no title to match.
  it('never matches an untranslated type title', () => {
    expect(splitTaskTitleSearch('message.update-tag-message', t).types).toEqual(
      []
    );
  });
});
