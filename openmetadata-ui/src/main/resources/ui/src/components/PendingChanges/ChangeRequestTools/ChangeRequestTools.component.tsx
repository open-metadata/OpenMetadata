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
  Badge,
  Button,
  Input,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApprovalDecision } from '../../../generated/governance/changeRequest/approvalDecision';
import { ChangeLifecycleEvent } from '../../../generated/governance/changeRequest/changeLifecycleEvent';
import {
  ChangeRequest,
  ChangeRequestStatus,
} from '../../../generated/governance/changeRequest/changeRequest';
import { ChangeRequestPreview } from '../../../generated/governance/changeRequest/changeRequestPreview';
import { ChangeRevision } from '../../../generated/governance/changeRequest/changeRevision';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  cancelChangeRequest,
  getChangeRequestDecisions,
  getChangeRequestEvents,
  getChangeRequestRevisions,
  overrideChangeRequest,
  previewChangeRequest,
} from '../../../rest/changeRequestsAPI';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ChangeRequestChanges from '../ChangeRequestChanges/ChangeRequestChanges.component';
import PreviewFields from './PreviewFields.component';

const OPEN_STATUSES = new Set([
  ChangeRequestStatus.Pending,
  ChangeRequestStatus.Approved,
]);

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
      className="tw:flex tw:flex-col tw:gap-3 tw:border-t tw:border-subtle tw:pt-4"
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

/** Publish without review, or cancel, a pending request. Admins only. */
export const AdminActions = ({
  request,
  onChange,
}: {
  request: ChangeRequest;
  onChange: () => Promise<void>;
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [reason, setReason] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  // An administrator cannot publish their own request without review; the server refuses it.
  const canOverride = currentUser?.name !== request.requestedBy;

  if (!OPEN_STATUSES.has(request.status)) {
    return null;
  }

  const run = async (action: () => Promise<ChangeRequest>) => {
    setIsBusy(true);
    try {
      const result = await action();
      showSuccessToast(`${t('label.status')}: ${result.status}`);
      await onChange();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="tw:flex tw:items-center tw:gap-2"
      data-testid="change-request-admin-actions">
      {canOverride && (
        <>
          <Input
            className="tw:flex-1"
            inputDataTestId="override-reason"
            placeholder={t('label.reason')}
            size="sm"
            value={reason}
            onChange={setReason}
          />
          <Button
            color="primary"
            data-testid="override-change-request"
            isDisabled={isBusy || reason.trim() === ''}
            size="sm"
            onClick={() =>
              run(() =>
                overrideChangeRequest(
                  request.id,
                  request.activeRevisionNumber,
                  reason.trim()
                )
              )
            }>
            {t('label.override')}
          </Button>
        </>
      )}
      <Button
        color="secondary"
        data-testid="cancel-change-request"
        isDisabled={isBusy}
        size="sm"
        onClick={() => run(() => cancelChangeRequest(request.id))}>
        {t('label.cancel-request')}
      </Button>
    </div>
  );
};

// The operations a JSON patch text holds; undefined while it is not a JSON array.
const operationsOf = (text: string): Operation[] | undefined => {
  try {
    const parsed: unknown = JSON.parse(text);

    return Array.isArray(parsed) ? (parsed as Operation[]) : undefined;
  } catch {
    return undefined;
  }
};

/** Whether a JSON patch to the asset would be held for approval, without saving it. */
enum PreviewMode {
  Fields = 'fields',
  Json = 'json',
}

export const PreviewPanel = ({
  entityType,
  entityId,
  entityFqn,
}: {
  entityType: string;
  entityId: string;
  entityFqn?: string;
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState(
    entityFqn ? PreviewMode.Fields : PreviewMode.Json
  );
  const [patch, setPatch] = useState('[]');
  const [fieldOperations, setFieldOperations] = useState<Operation[]>([]);
  const [preview, setPreview] = useState<ChangeRequestPreview>();
  const operations =
    mode === PreviewMode.Fields ? fieldOperations : operationsOf(patch);

  const runPreview = async () => {
    try {
      setPreview(
        await previewChangeRequest(entityType, entityId, operations ?? [])
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-3"
      data-testid="change-request-preview">
      <Typography as="span" size="text-sm" weight="semibold">
        {t('label.preview-change')}
      </Typography>
      <Typography as="p" className="tw:text-tertiary" size="text-sm">
        {t('message.preview-change-hint')}
      </Typography>
      {entityFqn && (
        <div className="tw:flex tw:gap-2">
          {[PreviewMode.Fields, PreviewMode.Json].map((option) => (
            <Button
              color={mode === option ? 'primary' : 'secondary'}
              data-testid={`preview-mode-${option}`}
              key={option}
              size="sm"
              onClick={() => setMode(option)}>
              {option === PreviewMode.Fields
                ? t('label.field-plural')
                : t('label.json-patch')}
            </Button>
          ))}
        </div>
      )}
      {mode === PreviewMode.Fields && entityFqn ? (
        <PreviewFields
          entityFqn={entityFqn}
          entityType={entityType}
          onPatch={setFieldOperations}
        />
      ) : (
        <TextArea
          aria-label={t('label.json-patch')}
          rows={8}
          textAreaClassName="tw:font-mono tw:text-xs"
          value={patch}
          onChange={setPatch}
        />
      )}
      <Button
        className="tw:self-start"
        color="primary"
        data-testid="run-preview"
        isDisabled={!operations?.length}
        size="sm"
        onClick={runPreview}>
        {t('label.preview')}
      </Button>
      {preview && (
        <div className="tw:flex tw:flex-col tw:gap-2">
          <Badge
            color={preview.requiresApproval ? 'warning' : 'success'}
            size="sm"
            type="color">
            {preview.requiresApproval
              ? t('label.requires-approval')
              : t('label.saves-directly')}
          </Badge>
          <ChangeRequestChanges ops={preview.ops} />
        </div>
      )}
    </div>
  );
};
