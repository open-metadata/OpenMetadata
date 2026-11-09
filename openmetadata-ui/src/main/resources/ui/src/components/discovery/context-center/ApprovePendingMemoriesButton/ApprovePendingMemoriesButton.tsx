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

import { Button } from '@openmetadata/ui-core-components';
import { Check } from '@openmetadata/ui-core-components/icons';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ContextMemory,
  ContextMemoryStatus,
} from '../../../../generated/entity/context/contextMemory';
import { updateContextMemory } from '../../../../rest/contextMemoryAPI';
import { getMemoryStatusPatch } from '../../../../utils/ContextCenterPureUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';

export interface ApprovePendingMemoriesButtonProps {
  isAdmin?: boolean;
  /** While the list loads, the memories it holds are not the ones shown next. */
  isLoading: boolean;
  memories: ContextMemory[];
  /** Refreshes the list and its counts once every approval has settled. */
  onApproved: () => Promise<void>;
}

/** An admin approves the Unprocessed memories listed; a Draft one is under conflict review. */
const ApprovePendingMemoriesButton: FC<ApprovePendingMemoriesButtonProps> = ({
  isAdmin = false,
  isLoading,
  memories,
  onApproved,
}) => {
  const { t } = useTranslation();
  const [isApproving, setIsApproving] = useState(false);
  const pendingMemories = useMemo(
    () =>
      memories.filter(
        (memory) => memory.entityStatus === ContextMemoryStatus.Unprocessed
      ),
    [memories]
  );

  // Each memory is approved on its own, so one refused write leaves the others approved.
  const handleApprove = useCallback(async () => {
    setIsApproving(true);
    try {
      const results = await Promise.allSettled(
        pendingMemories.map((memory) =>
          updateContextMemory(
            memory.id,
            getMemoryStatusPatch(memory, ContextMemoryStatus.Approved)
          )
        )
      );
      const failedCount = results.filter(
        (result) => result.status === 'rejected'
      ).length;
      const approvedCount = results.length - failedCount;
      if (approvedCount > 0) {
        showSuccessToast(t('message.memories-approved', { approvedCount }));
      }
      if (failedCount > 0) {
        showErrorToast(t('message.memories-not-approved', { failedCount }));
      }
      await onApproved();
    } finally {
      setIsApproving(false);
    }
  }, [onApproved, pendingMemories, t]);

  if (!isAdmin || isLoading || pendingMemories.length === 0) {
    return null;
  }

  return (
    <Button
      color="secondary"
      data-testid="approve-pending-memories-btn"
      iconLeading={Check}
      isDisabled={isApproving}
      isLoading={isApproving}
      size="md"
      onClick={handleApprove}>
      {t('label.approve-pending-memories', {
        pendingCount: pendingMemories.length,
      })}
    </Button>
  );
};

export default ApprovePendingMemoriesButton;
