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
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMemoryStatus } from '../../../../generated/entity/context/contextMemory';

export interface MemoryStatusActionsProps {
  /** The decision being saved; both buttons wait while one is. */
  decidingStatus?: ContextMemoryStatus;
  isDisabled?: boolean;
  onDecide: (status: ContextMemoryStatus) => void;
}

/** Approve and Reject for a memory that awaits a person's decision. */
const MemoryStatusActions: FC<MemoryStatusActionsProps> = ({
  decidingStatus,
  isDisabled = false,
  onDecide,
}) => {
  const { t } = useTranslation();
  const isBusy = isDisabled || decidingStatus !== undefined;

  return (
    <>
      <Button
        color="secondary-destructive"
        data-testid="memory-reject-btn"
        isDisabled={isBusy}
        isLoading={decidingStatus === ContextMemoryStatus.Rejected}
        size="sm"
        onClick={() => onDecide(ContextMemoryStatus.Rejected)}>
        {t('label.reject')}
      </Button>
      <Button
        color="primary"
        data-testid="memory-approve-btn"
        iconLeading={Check}
        isDisabled={isBusy}
        isLoading={decidingStatus === ContextMemoryStatus.Approved}
        size="sm"
        onClick={() => onDecide(ContextMemoryStatus.Approved)}>
        {t('label.approve')}
      </Button>
    </>
  );
};

export default MemoryStatusActions;
