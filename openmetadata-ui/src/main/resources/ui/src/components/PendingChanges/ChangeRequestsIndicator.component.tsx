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
import { Badge, Button } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChangeRequest,
  ChangeRequestStatus,
} from '../../generated/governance/changeRequest/changeRequest';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getChangeRequestsForEntity } from '../../rest/changeRequestsAPI';
import { PENDING_CHANGE_EVENT } from '../../rest/pendingChangeInterceptor';
import { showErrorToast } from '../../utils/ToastUtils';
import ReviewPendingChangesModal from './ReviewPendingChanges/ReviewPendingChangesModal.component';

interface ChangeRequestsIndicatorProps {
  entityId: string;
}

const OPEN_STATUSES = new Set([
  ChangeRequestStatus.Pending,
  ChangeRequestStatus.Approved,
]);

/**
 * Shows the change requests waiting for approval on an asset. The asset itself keeps serving its
 * published values; these are the proposals, opened for review in the pending changes modal.
 */
const ChangeRequestsIndicator = ({
  entityId,
}: ChangeRequestsIndicatorProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [isOpen, setIsOpen] = useState(false);

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

  const ordered = [...requests].sort(
    (a, b) =>
      Number(b.requestedBy === currentUser?.name) -
      Number(a.requestedBy === currentUser?.name)
  );

  return (
    <>
      <Button
        className="tw:shrink-0 tw:whitespace-nowrap"
        color="secondary"
        data-testid="pending-change-requests"
        iconTrailing={
          requests.length > 0 ? (
            <Badge color="brand" size="sm">
              {requests.length}
            </Badge>
          ) : undefined
        }
        size="sm"
        onClick={() => setIsOpen(true)}>
        {t('label.pending-changes')}
      </Button>
      {isOpen && (
        <ReviewPendingChangesModal
          requests={ordered}
          onChange={fetchRequests}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default ChangeRequestsIndicator;
