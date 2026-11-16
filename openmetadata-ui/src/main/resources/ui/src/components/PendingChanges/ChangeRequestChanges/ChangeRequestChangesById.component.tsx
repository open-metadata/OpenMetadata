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
import { Badge, BadgeColors } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { groupBy } from 'lodash';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChangeOutcome,
  ChangeRequest,
  ChangeRequestStatus,
  MutationOp,
} from '../../../generated/governance/changeRequest/changeRequest';
import { getChangeRequest } from '../../../rest/changeRequestsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import ChangeRequestChanges from './ChangeRequestChanges.component';

const OUTCOME_COLORS: Record<ChangeOutcome, BadgeColors> = {
  [ChangeOutcome.Applied]: 'success',
  [ChangeOutcome.Rejected]: 'error',
  [ChangeOutcome.AlreadyPublished]: 'gray',
  [ChangeOutcome.NotAgreed]: 'warning',
  [ChangeOutcome.Superseded]: 'gray',
  [ChangeOutcome.Pending]: 'gray',
};

// A request decided as a whole reports no outcome per change; once it ends, every change shares
// the request's own result.
const ENDED_AS: Partial<Record<ChangeRequestStatus, ChangeOutcome>> = {
  [ChangeRequestStatus.Applied]: ChangeOutcome.Applied,
  [ChangeRequestStatus.Rejected]: ChangeOutcome.Rejected,
  [ChangeRequestStatus.Superseded]: ChangeOutcome.Superseded,
};

const outcomeOf = (request: ChangeRequest, op: MutationOp): ChangeOutcome =>
  op.outcome ?? ENDED_AS[request.status] ?? ChangeOutcome.Pending;

// Decided changes in a fixed order: what was published first, what was not after.
const DECIDED_ORDER = [
  ChangeOutcome.Applied,
  ChangeOutcome.AlreadyPublished,
  ChangeOutcome.Rejected,
  ChangeOutcome.NotAgreed,
  ChangeOutcome.Superseded,
];

// A request still under review: its decided changes have left the review.
const OPEN_STATUSES = new Set([
  ChangeRequestStatus.Pending,
  ChangeRequestStatus.Approved,
]);

/**
 * The changes a review task's change request proposes, at its active revision. While the request
 * is open, only the changes still under review; once it ends, every change grouped by what
 * happened to it, so a closed task still shows what was proposed and how each change ended. Read
 * again whenever {@code version} changes, so a decision on the task shows at once.
 */
const ChangeRequestChangesById = ({
  changeRequestId,
  version,
}: {
  changeRequestId: string;
  version?: number;
}) => {
  const { t } = useTranslation();
  const [request, setRequest] = useState<ChangeRequest>();

  useEffect(() => {
    getChangeRequest(changeRequestId)
      .then(setRequest)
      .catch((error: AxiosError) => showErrorToast(error));
  }, [changeRequestId, version]);

  if (!request) {
    return null;
  }

  const byOutcome = groupBy(request.activeRevision?.ops ?? [], (op) =>
    outcomeOf(request, op)
  );
  const pending = byOutcome[ChangeOutcome.Pending] ?? [];
  const decided = OPEN_STATUSES.has(request.status) ? [] : DECIDED_ORDER;

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      {pending.length > 0 && <ChangeRequestChanges ops={pending} />}
      {decided
        .filter((outcome) => byOutcome[outcome]?.length)
        .map((outcome) => (
          <div
            className="tw:flex tw:flex-col tw:gap-2"
            data-testid={`decided-changes-${outcome}`}
            key={outcome}>
            <Badge
              className="tw:self-start"
              color={OUTCOME_COLORS[outcome]}
              size="sm"
              type="color">
              {t(`label.change-outcome-${outcome}`)}
            </Badge>
            <ChangeRequestChanges ops={byOutcome[outcome]} />
          </div>
        ))}
    </div>
  );
};

export default ChangeRequestChangesById;
