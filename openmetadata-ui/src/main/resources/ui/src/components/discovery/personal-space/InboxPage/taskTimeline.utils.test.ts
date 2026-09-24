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

import { Task, TaskCategory } from '../../../../generated/entity/tasks/task';
import { buildTaskTimeline } from './taskTimeline.utils';

const buildTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 'task-1',
    createdBy: { id: 'u1', name: 'alice' },
    createdAt: 100,
    status: 'Open',
    ...overrides,
  } as unknown as Task);

describe('buildTaskTimeline', () => {
  it('always opens with the creation event', () => {
    const [first] = buildTaskTimeline(buildTask());

    expect(first).toMatchObject({
      kind: 'event',
      id: 'created',
      textKey: 'message.task-event-created',
      tone: 'default',
    });
  });

  it('reads an incident as opened and tones it as an alert', () => {
    const [first] = buildTaskTimeline(
      buildTask({ category: TaskCategory.Incident })
    );

    expect(first).toMatchObject({
      textKey: 'message.task-event-incident-opened',
      icon: 'incident',
      tone: 'error',
    });
  });

  it('orders events and comments oldest first', () => {
    const entries = buildTaskTimeline(
      buildTask({
        createdAt: 100,
        comments: [
          { id: 'c2', message: 'later', createdAt: 300 },
          { id: 'c1', message: 'earlier', createdAt: 200 },
        ],
      } as unknown as Partial<Task>)
    );

    expect(entries.map((entry) => entry.id)).toEqual([
      'created',
      'comment-c1',
      'comment-c2',
    ]);
  });

  it('tones a rejection as an error and names who rejected it', () => {
    const entries = buildTaskTimeline(
      buildTask({
        status: 'Rejected',
        resolution: {
          resolvedBy: { id: 'u2', name: 'bob' },
          resolvedAt: 500,
        },
      } as unknown as Partial<Task>)
    );
    const resolved = entries.find((entry) => entry.id === 'resolved');

    expect(resolved).toMatchObject({
      textKey: 'message.task-event-rejected',
      tone: 'error',
      actor: { name: 'bob' },
    });
  });

  it('keeps an expiry neutral — nobody rejected it', () => {
    const entries = buildTaskTimeline(
      buildTask({
        status: 'Expired',
        resolution: { resolvedAt: 900 },
      } as unknown as Partial<Task>)
    );

    expect(entries.find((entry) => entry.id === 'resolved')).toMatchObject({
      textKey: 'message.task-event-expired',
      tone: 'default',
    });
  });

  it('omits the resolution event while the task is still open', () => {
    const entries = buildTaskTimeline(buildTask());

    expect(entries.some((entry) => entry.id === 'resolved')).toBe(false);
  });

  // An approved-and-closed task stamps both `approvedBy` and a resolution; the
  // two describe the same moment and must not render as two events.
  it('does not repeat the approval when the outcome already says approved', () => {
    const entries = buildTaskTimeline(
      buildTask({
        status: 'Approved',
        approvedBy: { id: 'u2', name: 'bob' },
        approvedAt: 400,
        resolution: {
          resolvedBy: { id: 'u2', name: 'bob' },
          resolvedAt: 400,
        },
      } as unknown as Partial<Task>)
    );

    expect(
      entries.filter(
        (entry) =>
          entry.kind === 'event' &&
          entry.textKey === 'message.task-event-approved'
      )
    ).toHaveLength(1);
  });

  // A granted access request was approved first and granted later: both steps
  // are real, so both belong on the timeline.
  it('keeps the approval alongside a later grant', () => {
    const entries = buildTaskTimeline(
      buildTask({
        status: 'Granted',
        approvedBy: { id: 'u2', name: 'bob' },
        approvedAt: 400,
        resolution: {
          resolvedBy: { id: 'u3', name: 'carol' },
          resolvedAt: 800,
        },
      } as unknown as Partial<Task>)
    );

    expect(entries.map((entry) => entry.id)).toEqual([
      'created',
      'approved',
      'resolved',
    ]);
  });

  describe('assignment', () => {
    const assigned = buildTask({
      createdAt: 100,
      assignees: [{ id: 'a1', name: 'bob' }],
      comments: [{ id: 'c1', message: 'hi', createdAt: 50 }],
    } as unknown as Partial<Task>);

    it('follows creation, since that is when assignment almost always happens', () => {
      const ids = buildTaskTimeline(assigned).map((entry) => entry.id);

      expect(ids.indexOf('assigned-a1')).toBe(ids.indexOf('created') + 1);
    });

    // Nothing records when the holder was given the task, so no time is shown.
    it('carries no timestamp of its own', () => {
      const event = buildTaskTimeline(assigned).find(
        (entry) => entry.id === 'assigned-a1'
      );

      expect(event).toMatchObject({
        kind: 'event',
        textKey: 'message.task-event-assigned',
      });
      expect(event?.timestamp).toBeUndefined();
    });

    it('is omitted when nobody holds the task', () => {
      expect(
        buildTaskTimeline(buildTask()).some((entry) =>
          entry.id.startsWith('assigned-')
        )
      ).toBe(false);
    });
  });
});
