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
import { Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApprovalDecision } from '../../../generated/governance/changeRequest/approvalDecision';
import { ChangeLifecycleEvent } from '../../../generated/governance/changeRequest/changeLifecycleEvent';
import { ChangeRequest } from '../../../generated/governance/changeRequest/changeRequest';
import { ChangeRevision } from '../../../generated/governance/changeRequest/changeRevision';
import {
  getChangeRequestDecisions,
  getChangeRequestEvents,
  getChangeRequestRevisions,
} from '../../../rest/changeRequestsAPI';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

// Decisions made change by change name the changes they cover; the generated type does not list
// these fields yet.
interface ChangeLists {
  approvedChanges?: { field: string; key?: string }[];
  rejectedChanges?: { field: string; key?: string }[];
}

const describeRefs = (refs?: { field: string; key?: string }[]) =>
  (refs ?? [])
    .map((ref) => (ref.key ? `${ref.field} ${ref.key}` : ref.field))
    .join(', ');

const HistoryList = ({
  title,
  lines,
}: {
  title: string;
  lines: { id: string; text: string }[];
}) => (
  <div className="tw:flex tw:flex-col tw:gap-1">
    <Typography as="span" size="text-sm" weight="semibold">
      {title}
    </Typography>
    {lines.map((line) => (
      <Typography
        as="span"
        className="tw:text-tertiary"
        key={line.id}
        size="text-xs">
        {line.text}
      </Typography>
    ))}
  </div>
);

/** The request's revisions, review decisions and lifecycle events. */
export const RequestHistory = ({ request }: { request: ChangeRequest }) => {
  const { t } = useTranslation();
  const [revisions, setRevisions] = useState<ChangeRevision[]>([]);
  const [decisions, setDecisions] = useState<ApprovalDecision[]>([]);
  const [events, setEvents] = useState<ChangeLifecycleEvent[]>([]);

  useEffect(() => {
    Promise.all([
      getChangeRequestRevisions(request.id),
      getChangeRequestDecisions(request.id),
      getChangeRequestEvents(request.id),
    ])
      .then(([revisionList, decisionList, eventList]) => {
        setRevisions(revisionList);
        setDecisions(decisionList);
        setEvents(eventList);
      })
      .catch((error) => showErrorToast(error as AxiosError));
  }, [request.id, request.updatedAt]);

  return (
    <div
      className="tw:flex tw:w-96 tw:max-w-full tw:flex-col tw:gap-3"
      data-testid="change-request-history">
      <HistoryList
        lines={revisions.map((revision) => ({
          id: revision.id,
          text: `${t('label.revision-number', {
            number: revision.revisionNumber,
          })} · ${revision.status} · ${revision.ops.length} · ${formatDateTime(
            revision.createdAt
          )}`,
        }))}
        title={t('label.revision-plural')}
      />
      <HistoryList
        lines={decisions.map((decision) => {
          const lists = decision as ApprovalDecision & ChangeLists;

          return {
            id: decision.id,
            text: [
              decision.decidedBy,
              decision.decision,
              t('label.revision-number', { number: decision.revisionNumber }),
              describeRefs(lists.approvedChanges),
              describeRefs(lists.rejectedChanges),
              decision.comment,
            ]
              .filter(Boolean)
              .join(' · '),
          };
        })}
        title={t('label.decision-plural')}
      />
      <HistoryList
        lines={events.map((event) => ({
          id: event.id,
          text: [
            formatDateTime(event.timestamp),
            event.eventType,
            event.toStatus,
            event.actor,
            event.reason,
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
        title={t('label.event-plural')}
      />
    </div>
  );
};
