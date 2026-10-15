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
import { Badge, Typography } from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { LifecycleMove } from '../../../../generated/governance/workflows/elements/nodes/userTask/userApprovalTask';

interface LifecycleApprovalCardProps {
  move: LifecycleMove;
}

/** A lifecycle approval asks to move the asset to its next stage, not to accept field edits. */
const LifecycleApprovalCard = ({ move }: LifecycleApprovalCardProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-secondary tw:p-4"
      data-testid="lifecycle-approval-card">
      <Typography
        as="p"
        className="tw:text-sm tw:font-semibold tw:text-primary">
        {t('label.lifecycle-approval-needed')}
      </Typography>
      <div className="tw:flex tw:items-center tw:gap-2">
        <Badge color="gray" size="md" type="color">
          {move.stage}
        </Badge>
        <ArrowRight aria-hidden className="tw:size-4 tw:text-fg-quaternary" />
        <Badge color="brand" size="md" type="color">
          {move.targetStage}
        </Badge>
      </div>
      <Typography as="p" className="tw:text-xs tw:text-tertiary">
        {t('message.lifecycle-approval-move', {
          stage: move.stage,
          targetStage: move.targetStage,
        })}
      </Typography>
    </div>
  );
};

export default LifecycleApprovalCard;
