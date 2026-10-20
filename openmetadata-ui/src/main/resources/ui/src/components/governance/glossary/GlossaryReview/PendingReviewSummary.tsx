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
import { Divider } from '@openmetadata/ui-core-components';
import { AskCollateSparkle } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import {
  ProposalScope,
  useGlossaryProposals,
} from '../../../../hooks/governance/glossary/useGlossaryProposals';

export interface PendingReviewSummaryProps {
  scope?: ProposalScope;
}

/** How many proposals under a glossary or term wait for review, by who made them. */
const PendingReviewSummary = ({ scope }: PendingReviewSummaryProps) => {
  const { t } = useTranslation();
  const { counts } = useGlossaryProposals(scope);
  if (counts.all === 0) {
    return null;
  }

  return (
    <div
      className="tw:inline-flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:px-3 tw:py-1.5 tw:text-sm"
      data-testid="pending-review-summary">
      {counts.ai > 0 && (
        <span className="tw:inline-flex tw:items-center tw:gap-1 tw:font-medium tw:text-utility-purple-700">
          <AskCollateSparkle aria-hidden className="tw:size-3.5" />
          {t('label.count-from-ai', { count: counts.ai })}
        </span>
      )}
      {counts.ai > 0 && counts.person > 0 && (
        <Divider className="tw:h-3.5" orientation="vertical" />
      )}
      {counts.person > 0 && (
        <span className="tw:inline-flex tw:items-center tw:gap-1.5 tw:font-medium tw:text-utility-warning-700">
          <span className="tw:size-2 tw:rounded-full tw:bg-utility-warning-500" />
          {t('label.count-from-people', { count: counts.person })}
        </span>
      )}
      <span className="tw:text-tertiary">{t('message.awaiting-review')}</span>
    </div>
  );
};

export default PendingReviewSummary;
