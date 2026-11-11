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

import { render, screen, within } from '@testing-library/react';
import {
  AssigneeStatus,
  ReviewVoteDecision,
} from '../../../../generated/api/data/ontologyReleaseReview';
import {
  EventType,
  OntologyReleaseEvent,
} from '../../../../generated/type/ontologyReleaseEvent';
import { review, reviewer, task } from './OntologyTasksDrawer.mock';
import OntologyTaskThread from './OntologyTaskThread';
import {
  buildThreadEntries,
  reviewDecisionAppearance,
} from './OntologyTaskThread.utils';

it('orders records stably, preserves repeated comments and coalesces a later completion event', () => {
  const voted = {
    ...review,
    latestDecision: {
      decision: ReviewVoteDecision.Approved,
      timestamp: 15,
      user: reviewer,
    },
    assignees: [
      {
        assignee: reviewer,
        status: AssigneeStatus.Approved,
        vote: {
          assignee: reviewer,
          voter: reviewer,
          decision: ReviewVoteDecision.Approved,
          timestamp: 10,
          comment: 'Exact vote',
        },
      },
    ],
  };
  const commented = {
    ...task,
    comments: [
      { id: 'b', message: 'Repeated', author: reviewer, createdAt: 10 },
      { id: 'a', message: 'Repeated', author: reviewer, createdAt: 10 },
      { id: 'a', message: 'Repeated', author: reviewer, createdAt: 10 },
    ],
  };
  const event: OntologyReleaseEvent = {
    id: 'approved',
    eventType: EventType.Approved,
    taskId: task.id,
    releaseId: 'release',
    ontologyId: 'ontology',
    contentDigest: 'digest',
    createdAt: 20,
    createdBy: 'Reviewer',
  };
  const events = [
    {
      ...event,
      id: 'published',
      eventType: EventType.Activated,
      createdAt: 30,
    },
    event,
    { ...event, id: 'captured', eventType: EventType.Captured, createdAt: 1 },
  ];
  const rows = buildThreadEntries(commented, voted, events);

  expect(rows.map((row) => row.id)).toEqual([
    'event:captured',
    'comment:a',
    'comment:b',
    'vote:task:user:reviewer:10:Approved',
    'event:published',
  ]);
  expect(rows[3].event?.id).toBe('approved');

  render(
    <OntologyTaskThread events={events} review={voted} task={commented} />
  );

  expect(screen.getAllByText('Repeated')).toHaveLength(2);
  expect(
    within(screen.getByTestId('event:captured'))
      .getByText('label.captured')
      .closest('[class*="tw:size-max"]')
  ).toHaveClass('tw:bg-utility-gray-50');

  for (const id of ['comment:a', 'comment:b']) {
    expect(
      within(screen.getByTestId(id))
        .getByText('label.comment')
        .closest('[class*="tw:size-max"]')
    ).toHaveClass('tw:bg-utility-gray-50');
  }

  expect(screen.getAllByText('label.approved')).toHaveLength(1);
  expect(
    within(screen.getByTestId('vote:task:user:reviewer:10:Approved'))
      .getByText('label.approved')
      .closest('[class*="tw:size-max"]')
  ).toHaveClass('tw:bg-utility-success-50');
  expect(
    screen.getByText('label.published').closest('[class*="tw:size-max"]')
  ).toHaveClass('tw:bg-utility-blue-50');
});

it('retains unmatched rejection events and team votes without hiding partial decisions', () => {
  const team = { id: 'team', type: 'team', name: 'Team' };
  const voted = {
    ...review,
    assignees: [
      {
        assignee: team,
        status: AssigneeStatus.Approved,
        vote: {
          assignee: team,
          voter: reviewer,
          decision: ReviewVoteDecision.Approved,
          timestamp: 3,
        },
      },
      ...review.assignees,
    ],
  };
  const event: OntologyReleaseEvent = {
    id: 'rejected',
    eventType: EventType.Rejected,
    taskId: 'other-task',
    releaseId: 'release',
    ontologyId: 'ontology',
    contentDigest: 'digest',
    createdAt: 4,
    createdBy: 'Other',
    resolution: { comment: '  Verbatim reason  ' },
  };
  const rows = buildThreadEntries(task, voted, [event, event]);

  expect(rows).toHaveLength(2);
  expect(rows[0].decision).toBe('Approved');
  expect(rows[1].message).toBe('  Verbatim reason  ');

  render(
    <OntologyTaskThread events={[event, event]} review={voted} task={task} />
  );

  expect(
    within(screen.getByTestId('event:rejected'))
      .getByText('label.rejected')
      .closest('[class*="tw:size-max"]')
  ).toHaveClass('tw:bg-utility-error-50');
  expect(reviewDecisionAppearance('Rejected')).toEqual({
    color: 'error',
    label: 'label.rejected',
  });
  expect(reviewDecisionAppearance('Pending')).toEqual({
    color: 'warning',
    label: 'label.pending',
  });
});
