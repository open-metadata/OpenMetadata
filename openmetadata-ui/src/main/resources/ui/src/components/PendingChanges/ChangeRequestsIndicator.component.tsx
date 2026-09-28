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
  Popover,
  PopoverTrigger,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { startCase } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChangeRequest,
  ChangeRequestStatus,
  MutationOp,
  MutationOpType,
} from '../../generated/governance/changeRequest/changeRequest';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  getChangeRequestsForEntity,
  withdrawChangeRequest,
} from '../../rest/changeRequestsAPI';
import { PENDING_CHANGE_EVENT } from '../../rest/pendingChangeInterceptor';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

interface ChangeRequestsIndicatorProps {
  entityId: string;
}

const OPEN_STATUSES = new Set([
  ChangeRequestStatus.Pending,
  ChangeRequestStatus.Approved,
]);

const MAX_VALUE_LENGTH = 80;

type OpValue = { displayName?: string; name?: string; tagFQN?: string };

// A reference or tag reads by its name; anything else structured is shown compactly.
const labelOf = (value: unknown): string => {
  if (typeof value !== 'object' || value === null) {
    return String(value);
  }
  const reference = value as OpValue;

  return (
    reference.displayName ??
    reference.name ??
    reference.tagFQN ??
    JSON.stringify(value)
  );
};

const truncate = (text: string): string =>
  text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;

// Op values are JSON strings; rich text is reduced to plain text for the summary.
const describeValue = (json?: string): string => {
  const text = json ? labelOf(JSON.parse(json)) : '';

  return truncate(
    text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
};

const OpRow = ({ op }: { op: MutationOp }) => {
  const { t } = useTranslation();
  const kind = {
    [MutationOpType.Add]: t('label.added'),
    [MutationOpType.Remove]: t('label.removed'),
    [MutationOpType.Set]: t('label.updated'),
  }[op.op];

  return (
    <li
      className="tw:flex tw:flex-wrap tw:gap-1 tw:text-sm"
      data-testid={`change-op-${op.field}`}>
      <span className="tw:font-medium tw:text-primary">
        {startCase(op.field)}
      </span>
      <span className="tw:text-tertiary">{kind}</span>
      <span className="tw:text-secondary tw:break-all">
        {describeValue(op.value)}
      </span>
    </li>
  );
};

const RequestCard = ({
  request,
  isOwn,
  onWithdraw,
}: {
  request: ChangeRequest;
  isOwn: boolean;
  onWithdraw: (request: ChangeRequest) => void;
}) => {
  const { t } = useTranslation();
  const canWithdraw = isOwn && request.status === ChangeRequestStatus.Pending;

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-secondary tw:py-3 tw:last:border-b-0"
      data-testid={`change-request-${request.id}`}>
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span className="tw:text-sm tw:font-semibold tw:text-primary">
          {isOwn ? t('label.you') : request.requestedBy}
        </span>
        <Badge color="gray" size="sm">
          {t('label.revision-number', {
            number: request.activeRevisionNumber,
          })}
        </Badge>
      </div>
      {request.status === ChangeRequestStatus.Approved && (
        <Badge color="success" size="sm">
          {t('label.approved')}
        </Badge>
      )}
      <ul className="tw:flex tw:flex-col tw:gap-1">
        {(request.activeRevision?.ops ?? []).map((op) => (
          <OpRow key={`${op.field}-${op.op}-${op.key ?? ''}`} op={op} />
        ))}
      </ul>
      {canWithdraw && (
        <Button
          color="secondary"
          data-testid="withdraw-change-request"
          size="sm"
          onClick={() => onWithdraw(request)}>
          {t('label.withdraw')}
        </Button>
      )}
    </div>
  );
};

/**
 * Shows the change requests waiting for approval on an asset. The asset itself keeps serving its
 * published values; these are the proposals. Review happens on each request's task.
 */
const ChangeRequestsIndicator = ({
  entityId,
}: ChangeRequestsIndicatorProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);

  const fetchRequests = useCallback(async () => {
    if (!entityId) {
      return;
    }
    try {
      const all = await getChangeRequestsForEntity(entityId);
      setRequests(all.filter((request) => OPEN_STATUSES.has(request.status)));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [entityId]);

  useEffect(() => {
    fetchRequests();
    window.addEventListener(PENDING_CHANGE_EVENT, fetchRequests);

    return () =>
      window.removeEventListener(PENDING_CHANGE_EVENT, fetchRequests);
  }, [fetchRequests]);

  const handleWithdraw = async (request: ChangeRequest) => {
    try {
      await withdrawChangeRequest(request.id, request.activeRevisionNumber);
      showSuccessToast(t('message.change-request-withdrawn'));
      await fetchRequests();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  if (requests.length === 0) {
    return null;
  }

  const ordered = [...requests].sort(
    (a, b) =>
      Number(b.requestedBy === currentUser?.name) -
      Number(a.requestedBy === currentUser?.name)
  );

  return (
    <PopoverTrigger>
      <Button color="secondary" data-testid="pending-change-requests" size="sm">
        {t('label.pending-changes')}
        <Badge className="tw:ml-2" color="brand" size="sm">
          {requests.length}
        </Badge>
      </Button>
      <Popover
        className="tw:w-96 tw:max-h-120 tw:overflow-y-auto tw:px-4"
        placement="bottom end">
        {ordered.map((request) => (
          <RequestCard
            isOwn={request.requestedBy === currentUser?.name}
            key={request.id}
            request={request}
            onWithdraw={handleWithdraw}
          />
        ))}
      </Popover>
    </PopoverTrigger>
  );
};

export default ChangeRequestsIndicator;
