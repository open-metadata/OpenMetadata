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
import { Box } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { MemoryDerivation } from '../../../../generated/entity/context/memoryDerivation';
import { getShortRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { ProposalSource } from '../../../../utils/GlossaryReview/GlossaryReview.types';
import { getConfidencePercent } from '../../../../utils/GlossaryReview/GlossaryReview.utils';

export interface ProposalStatusBadgeProps {
  source: ProposalSource;
  /** Who proposed it, for a person's proposal. */
  author?: string;
  updatedAt?: number;
  derivation?: MemoryDerivation;
}

/** The status of a term awaiting review: who proposed it, and how sure an agent was. */
const ProposalStatusBadge = ({
  source,
  author,
  updatedAt,
  derivation,
}: ProposalStatusBadgeProps) => {
  const { t } = useTranslation();
  const isAi = source === 'ai';
  const confidence = getConfidencePercent(derivation);
  const note = [
    confidence === undefined
      ? undefined
      : t('label.percent-confidence', { percent: confidence }),
    getShortRelativeTime(updatedAt),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Box
      align="start"
      data-testid="proposal-status-badge"
      direction="col"
      gap={1}>
      <span
        className={classNames(
          'tw:inline-flex tw:items-center tw:rounded-md tw:border tw:border-dashed tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium',
          isAi
            ? 'tw:border-utility-purple-300 tw:bg-utility-purple-50 tw:text-utility-purple-700'
            : 'tw:border-utility-warning-300 tw:bg-utility-warning-50 tw:text-utility-warning-700'
        )}>
        {isAi
          ? t('label.proposed-by-ai')
          : t('label.proposed-by-name', { name: author })}
      </span>
      {note && <span className="tw:text-xs tw:text-tertiary">{note}</span>}
    </Box>
  );
};

export default ProposalStatusBadge;
