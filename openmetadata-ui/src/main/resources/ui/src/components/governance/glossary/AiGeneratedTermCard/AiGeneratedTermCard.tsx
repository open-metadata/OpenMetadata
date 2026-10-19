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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../../generated/entity/data/glossaryTerm';
import { getShortRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import AiGeneratedTermBadge from '../AiGeneratedTermBadge/AiGeneratedTermBadge';

export interface AiGeneratedTermCardProps {
  term: GlossaryTerm;
  canDecide: boolean;
  onDecide: (status: EntityStatus) => Promise<void>;
}

const AiGeneratedTermCard = ({
  term,
  canDecide,
  onDecide,
}: AiGeneratedTermCardProps) => {
  const { t } = useTranslation();
  const [pendingStatus, setPendingStatus] = useState<EntityStatus>();

  const decide = async (status: EntityStatus) => {
    setPendingStatus(status);
    try {
      await onDecide(status);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setPendingStatus(undefined);
    }
  };

  return (
    <div
      className="tw:rounded-xl tw:border tw:border-utility-purple-200 tw:bg-utility-purple-50 tw:px-3.5 tw:py-3"
      data-testid="ai-generated-term-card">
      <Box direction="col" gap={2}>
        <Box align="center" gap={2}>
          <AiGeneratedTermBadge />
          <Typography color="secondary" size="text-xs">
            {getShortRelativeTime(term.updatedAt)}
          </Typography>
        </Box>
        <Typography as="p" color="secondary" size="text-sm">
          {t('message.ai-generated-term-description')}
        </Typography>
        {canDecide ? (
          <Box gap={2}>
            <Button
              color="primary"
              data-testid="approve-ai-generated-term"
              isDisabled={pendingStatus !== undefined}
              isLoading={pendingStatus === EntityStatus.Approved}
              size="sm"
              onPress={() => decide(EntityStatus.Approved)}>
              {t('label.approve')}
            </Button>
            <Button
              color="secondary"
              data-testid="reject-ai-generated-term"
              isDisabled={pendingStatus !== undefined}
              isLoading={pendingStatus === EntityStatus.Rejected}
              size="sm"
              onPress={() => decide(EntityStatus.Rejected)}>
              {t('label.reject')}
            </Button>
          </Box>
        ) : (
          Boolean(term.reviewers?.length) && (
            <Typography color="secondary" size="text-xs">
              {t('message.ai-generated-term-reviewers-decide')}
            </Typography>
          )
        )}
      </Box>
    </div>
  );
};

export default AiGeneratedTermCard;
