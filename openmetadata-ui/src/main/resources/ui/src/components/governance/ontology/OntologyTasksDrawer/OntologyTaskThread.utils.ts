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

import { OntologyReleaseReview } from '../../../../generated/api/data/ontologyReleaseReview';
import { Task } from '../../../../generated/entity/tasks/task';
import {
  EventType,
  OntologyReleaseEvent,
} from '../../../../generated/type/ontologyReleaseEvent';
import { getEntityName } from '../../../../utils/EntityNameUtils';

type ThreadEntry = {
  id: string;
  source: 'comment' | 'vote' | 'event';
  timestamp: number;
  actor: string;
  message?: string;
  decision?: 'Approved' | 'Rejected' | 'Pending';
  event?: OntologyReleaseEvent;
};

export const reviewDecisionAppearance = (
  status: 'Approved' | 'Rejected' | 'Pending'
) => {
  switch (status) {
    case 'Approved':
      return { color: 'success' as const, label: 'label.approved' };
    case 'Rejected':
      return { color: 'error' as const, label: 'label.rejected' };
    case 'Pending':
      return { color: 'warning' as const, label: 'label.pending' };
  }
};

export const buildThreadEntries = (
  task: Task,
  review: OntologyReleaseReview,
  events: readonly OntologyReleaseEvent[]
): ThreadEntry[] => {
  const rows = new Map<string, ThreadEntry>();
  for (const comment of task.comments ?? []) {
    rows.set('comment:' + comment.id, {
      id: 'comment:' + comment.id,
      source: 'comment',
      timestamp: comment.createdAt,
      actor: getEntityName(comment.author),
      message: comment.message,
    });
  }
  for (const { vote } of review.assignees) {
    if (!vote) {
      continue;
    }
    const id = [
      'vote',
      task.id,
      vote.assignee.type,
      vote.assignee.id,
      vote.timestamp,
      vote.decision,
    ].join(':');
    rows.set(id, {
      id,
      source: 'vote',
      timestamp: vote.timestamp,
      actor: getEntityName(vote.voter),
      message: vote.comment,
      decision: vote.decision,
    });
  }
  const addEvent = (event: OntologyReleaseEvent) => {
    let decision: 'Approved' | 'Rejected' | undefined;
    if (event.eventType === EventType.Approved) {
      decision = 'Approved';
    }
    if (event.eventType === EventType.Rejected) {
      decision = 'Rejected';
    }
    const latest = review.latestDecision;
    const finalVote =
      decision && latest?.decision === decision && event.taskId === task.id
        ? review.assignees
            .flatMap(({ vote }) =>
              vote &&
              [
                vote.decision === decision,
                vote.voter.id === latest.user.id,
                vote.timestamp <= latest.timestamp,
              ].every(Boolean)
                ? [vote]
                : []
            )
            .sort(
              (a, b) =>
                b.timestamp - a.timestamp ||
                (a.assignee.type + ':' + a.assignee.id <
                b.assignee.type + ':' + b.assignee.id
                  ? -1
                  : 1)
            )[0]
        : undefined;
    if (finalVote) {
      const id = [
        'vote',
        task.id,
        finalVote.assignee.type,
        finalVote.assignee.id,
        finalVote.timestamp,
        finalVote.decision,
      ].join(':');
      const row = rows.get(id);
      if (row) {
        row.event = event;
      }
    } else {
      const id = 'event:' + event.id;
      rows.set(id, {
        id,
        source: 'event',
        timestamp: event.createdAt,
        actor: event.createdBy,
        message: event.resolution?.comment,
        decision,
        event,
      });
    }
  };
  events.forEach(addEvent);
  const rank = { comment: 0, vote: 1, event: 2 };

  return [...rows.values()].sort((a, b) => {
    const chronological = a.timestamp - b.timestamp;
    if (chronological) {
      return chronological;
    }
    const sourceOrder = rank[a.source] - rank[b.source];
    if (sourceOrder) {
      return sourceOrder;
    }
    if (a.id === b.id) {
      return 0;
    }

    return a.id < b.id ? -1 : 1;
  });
};
